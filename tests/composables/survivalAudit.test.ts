import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useHandlerActions } from '../../src/composables/useHandlerActions'
import { catchUp, MAX_CATCHUP_TICKS, TICK_INTERVAL_MS } from '../../src/engine/catchUp'
import { getTotalItemValue } from '../../src/engine/homeStash'
import { createInitialState } from '../../src/engine/initialState'
import {
  consumeSelectedPreparationLoadouts, getHealingPurchaseCost, getShieldRechargerPurchaseCost,
  purchaseHealingItem, purchaseShieldRecharger, setSelectedHealingLoadout, setSelectedShieldRechargerLoadout,
  equipWeapon, purchaseWeapon, repairWeapon,
} from '../../src/engine/loadout'
import { PHASE_DURATIONS } from '../../src/engine/raidStateMachine'
import { getRevivalSignalCost } from '../../src/engine/raiderLevel'
import { createRNG } from '../../src/engine/rng'
import { SIGNAL_COSTS } from '../../src/engine/signal'
import { processTick } from '../../src/engine/tick'
import type { DangerLevel, GameState } from '../../src/engine/types'
import { findWeapon } from '../../src/engine/weapons'

type Policy = 'unattended' | 'support' | 'support_extract'
const DANGERS: DangerLevel[] = ['Low', 'Medium', 'High']
const POLICIES: Policy[] = ['unattended', 'support', 'support_extract']
const RAID_SEEDS = 120
const SESSION_SEEDS = 24
const PREPARATION_COST = 240
const EXTRACTION_TIMINGS = { early: 20, mid: 36, deep: 50, overextended: 58 } as const

interface Metrics {
  ticks: number
  raidingTicks: number
  extracts: number
  failures: number
  securedValue: number
  preparationSpent: number
  medsUsed: number
  medReplacementValue: number
  rechargersUsed: number
  rechargerReplacementValue: number
  signalSpent: number
  amplifiersUsed: number
  extractionCalls: number
  weaponLossValue: number
  downings: number
  ambientDownings: number
  downingsWithoutRescue: number
  knockoutsFromTimeout: number
  knockoutsFromDowned: number
  rechargePausedCombatTicks: number
}

function metrics(): Metrics {
  return {
    ticks: 0, raidingTicks: 0, extracts: 0, failures: 0, securedValue: 0, preparationSpent: 0,
    medsUsed: 0, medReplacementValue: 0, rechargersUsed: 0, rechargerReplacementValue: 0,
    signalSpent: 0, amplifiersUsed: 0, extractionCalls: 0, weaponLossValue: 0,
    downings: 0, ambientDownings: 0, downingsWithoutRescue: 0,
    knockoutsFromTimeout: 0, knockoutsFromDowned: 0, rechargePausedCombatTicks: 0,
  }
}

function requireTransaction(result: { state: GameState } | null): GameState {
  if (!result) throw new Error('Audit preparation transaction was rejected')
  return result.state
}

function raidStart(dangerLevel: DangerLevel, prepared = false): GameState {
  let state = createInitialState(0)
  if (prepared) {
    state = { ...state, coins: PREPARATION_COST }
    state = requireTransaction(purchaseHealingItem(state, 'bandage_blue', 3, 0))
    state = requireTransaction(purchaseHealingItem(state, 'panic_paddles', 1, 0))
    state = requireTransaction(purchaseShieldRecharger(state, 'fizz_cell', 2, 0))
    state = requireTransaction(setSelectedHealingLoadout(state, [
      { itemId: 'bandage_blue', quantity: 3 }, { itemId: 'panic_paddles', quantity: 1 },
    ], 0))
    state = requireTransaction(setSelectedShieldRechargerLoadout(state, [{ itemId: 'fizz_cell', quantity: 2 }], 0))
    state = consumeSelectedPreparationLoadouts(state)
  }
  return {
    ...state,
    raid: {
      ...state.raid, phase: 'RAIDING', phaseTicksRemaining: PHASE_DURATIONS.RAIDING,
      zone: 'damp_battlegrounds', dangerLevel,
    },
  }
}

function applyPolicy(
  stateRef: { value: GameState },
  actions: ReturnType<typeof useHandlerActions>,
  policy: Policy,
  totals: Metrics,
  extractionTick = 20,
  deadlineFallback = true,
) {
  if (policy === 'unattended' || stateRef.value.raid.phase !== 'RAIDING') return
  const perform = (action: () => void) => {
    const before = stateRef.value
    action()
    if (stateRef.value === before) throw new Error('Audit policy attempted a rejected Handler action')
  }
  const affordSignal = (cost: number) => {
    if (stateRef.value.signal.current < cost && stateRef.value.signalAmplifiers > 0) {
      perform(actions.applySignalAmplifier)
      totals.amplifiersUsed += 1
    }
    return stateRef.value.signal.current >= cost
  }
  let state = stateRef.value
  if (state.raid.downed) {
    const med = state.raid.healingItems.find(item => (item.reviveAmount ?? 0) > 0)
    if (med) {
      perform(() => actions.applyHealingItem(med.itemId))
      totals.medsUsed += 1
      totals.medReplacementValue += getHealingPurchaseCost(med.itemId)
    } else {
      const cost = getRevivalSignalCost(state.raider.levelXp)
      if (affordSignal(cost)) {
        perform(actions.revive)
        totals.signalSpent += cost
      } else {
        return
      }
    }
  }
  state = stateRef.value
  if (state.raider.hp <= state.raider.maxHp * 0.75) {
    const med = [...state.raid.healingItems]
      .filter(item => item.healAmount > 0 && (item.reviveAmount ?? 0) === 0)
      .sort((a, b) => a.healAmount - b.healAmount || a.itemId.localeCompare(b.itemId))[0]
    if (med) {
      perform(() => actions.applyHealingItem(med.itemId))
      totals.medsUsed += 1
      totals.medReplacementValue += getHealingPurchaseCost(med.itemId)
    }
  }
  state = stateRef.value
  // Decide extraction before starting a recharge it would immediately interrupt.
  const wantsExtraction = policy === 'support_extract' && (
    (deadlineFallback && state.raid.phaseTicksRemaining <= 6)
    || (state.raid.backpackValue > 0 && (
      state.raider.hp <= state.raider.maxHp * 0.5
      || state.raid.phaseTicksRemaining <= PHASE_DURATIONS.RAIDING - extractionTick
    ))
  )
  if (wantsExtraction && !state.raid.extracting && !state.raid.forceExtract
    && !state.pendingCalm && !state.pendingPressure && affordSignal(SIGNAL_COSTS.CALL_EXTRACT)) {
    perform(actions.callExtract)
    totals.extractionCalls += 1
    totals.signalSpent += SIGNAL_COSTS.CALL_EXTRACT
    return
  }
  state = stateRef.value
  const shield = state.raid.shield
  if (shield && shield.durability > 0 && shield.charge <= shield.maxCharge * 0.5
    && !state.raid.extracting && !state.raid.forceExtract && !state.raid.activeShieldRecharge) {
    const recharger = [...state.raid.backpack]
      .filter(item => item.kind === 'shield_recharger' && (item.shieldChargeAmount ?? 0) > 0)
      .sort((a, b) => (a.shieldChargeAmount ?? 0) - (b.shieldChargeAmount ?? 0) || a.itemId.localeCompare(b.itemId))[0]
    if (recharger) {
      perform(() => actions.applyShieldRecharger(recharger.itemId))
      totals.rechargersUsed += 1
      totals.rechargerReplacementValue += getShieldRechargerPurchaseCost(recharger.itemId)
    }
  }
}

interface EconomyMetrics {
  grossSecured: number
  supplyPurchases: number
  weaponPurchases: number
  repairs: number
  deployedSupplyReplacement: number
  successfulHauls: number[]
  successfulRaidTicks: number[]
}

function stockValue(state: GameState): number {
  return state.purchasedHealingItems.reduce((sum, item) => sum + item.quantity * getHealingPurchaseCost(item.itemId), 0)
    + state.purchasedShieldRechargers.reduce((sum, item) => sum + item.quantity * getShieldRechargerPurchaseCost(item.itemId), 0)
}

// Replacement-value proxy, not a weapon sale price; damaged weapons carry a repair liability.
function equipmentValue(state: GameState): number {
  return state.ownedWeapons.reduce((sum, owned) => {
    const weapon = findWeapon(owned.weaponId)
    if (!weapon) throw new Error(`Unknown audit weapon ${owned.weaponId}`)
    return sum + Math.max(0, weapon.value - (owned.durability < weapon.durabilityMax ? weapon.repairCost : 0))
  }, 0)
}

function retainedWealth(state: GameState): number {
  return securedWealth(state) + stockValue(state) + equipmentValue(state)
}

function prepareEconomy(state: GameState, now: number, economy: EconomyMetrics): GameState {
  if (state.raid.phase !== 'HUB') return state
  let next = state
  const commit = (result: { state: GameState } | null, category: 'supplyPurchases' | 'weaponPurchases' | 'repairs') => {
    const updated = requireTransaction(result)
    economy[category] += next.coins - updated.coins
    next = updated
  }
  const weapon = findWeapon('aspperigo')
  if (!weapon) throw new Error('Missing audit weapon')
  let owned = next.ownedWeapons.find(item => item.weaponId === weapon.id)
  if (!owned && next.coins >= weapon.value) {
    commit(purchaseWeapon(next, weapon.id, now), 'weaponPurchases')
    owned = next.ownedWeapons.find(item => item.weaponId === weapon.id)
  }
  if (owned) {
    if (owned.durability < weapon.durabilityMax && next.coins >= weapon.repairCost) {
      commit(repairWeapon(next, weapon.id, now), 'repairs')
    }
    next = requireTransaction(equipWeapon(next, weapon.id, now))
  }
  for (const [id, quantity] of [['bandage_blue', 3], ['panic_paddles', 1]] as const) {
    const available = next.purchasedHealingItems.find(item => item.itemId === id)?.quantity ?? 0
    const wanted = Math.min(quantity - available, Math.floor(next.coins / getHealingPurchaseCost(id)))
    if (wanted > 0) commit(purchaseHealingItem(next, id, wanted, now), 'supplyPurchases')
  }
  const available = next.purchasedShieldRechargers.find(item => item.itemId === 'fizz_cell')?.quantity ?? 0
  const wanted = Math.min(2 - available, Math.floor(next.coins / getShieldRechargerPurchaseCost('fizz_cell')))
  if (wanted > 0) commit(purchaseShieldRecharger(next, 'fizz_cell', wanted, now), 'supplyPurchases')
  next = requireTransaction(setSelectedHealingLoadout(next, next.purchasedHealingItems.map(item => ({
    itemId: item.itemId, quantity: item.quantity,
  })), now))
  return requireTransaction(setSelectedShieldRechargerLoadout(next, next.purchasedShieldRechargers.map(item => ({
    itemId: item.itemId, quantity: item.quantity,
  })), now))
}

function securedWealth(state: GameState): number {
  return getTotalItemValue(state.homeStash) + state.coins
}

function simulate(initial: GameState, seed: number, policy: Policy, singleRaid: boolean, extractionTick?: number, paidPreparation = false) {
  const stateRef = { value: structuredClone(initial) }
  const rngRef = { current: createRNG(seed) }
  const lastTickAt = { value: 0 }
  const totals = metrics()
  const economy: EconomyMetrics = {
    grossSecured: 0, supplyPurchases: 0, weaponPurchases: 0, repairs: 0,
    deployedSupplyReplacement: 0, successfulHauls: [], successfulRaidTicks: [],
  }
  const actions = useHandlerActions(
    stateRef, rngRef, lastTickAt,
    () => stateRef.value.pendingCalm || stateRef.value.pendingPressure || stateRef.value.raid.forceExtract,
    () => undefined, () => { throw new Error('Audit must not reset the save') }, () => undefined,
  )
  const startingWealth = securedWealth(initial)
  const startingRetained = retainedWealth(initial)
  if (paidPreparation) stateRef.value = prepareEconomy(stateRef.value, 0, economy)
  for (let tick = 1; tick <= MAX_CATCHUP_TICKS; tick += 1) {
    const before = stateRef.value
    const now = tick * TICK_INTERVAL_MS
    const result = processTick(before, rngRef.current, now)
    stateRef.value = result.state
    const tickGain = securedWealth(result.state) - securedWealth(before)
    economy.grossSecured += tickGain
    if (result.state.stats.extracts.total > before.stats.extracts.total) {
      economy.successfulHauls.push(tickGain)
      economy.successfulRaidTicks.push(PHASE_DURATIONS.RAIDING - before.raid.phaseTicksRemaining + 1)
    }
    if (before.raid.phase === 'HUB' && result.state.raid.phase === 'DEPLOYING') {
      economy.deployedSupplyReplacement += before.raid.selectedHealingLoadout.reduce(
        (sum, item) => sum + item.quantity * getHealingPurchaseCost(item.itemId), 0,
      ) + before.raid.selectedShieldRechargerLoadout.reduce(
        (sum, item) => sum + item.quantity * getShieldRechargerPurchaseCost(item.itemId), 0,
      )
    }
    lastTickAt.value = now
    totals.ticks += 1
    if (before.raid.phase === 'RAIDING') totals.raidingTicks += 1
    if (before.raid.activeShieldRecharge && before.raid.activeRaidActivity?.kind === 'ROBOT_ENCOUNTER'
      && result.activityEvents.some(event => event.activity === 'ROBOT_ENCOUNTER')) {
      totals.rechargePausedCombatTicks += 1
    }
    if (result.events.some(event => event.id === 'condition_downed_started')) {
      totals.downings += 1
      if (result.state.raid.downed?.reason?.kind === 'ambient_pressure') totals.ambientDownings += 1
      const canRescue = result.state.raid.healingItems.some(item => (item.reviveAmount ?? 0) > 0)
        || result.state.signal.current >= getRevivalSignalCost(result.state.raider.levelXp)
        || result.state.signalAmplifiers > 0
      if (!canRescue) totals.downingsWithoutRescue += 1
    }
    if (result.events.some(event => event.id === 'phase_RAIDING_to_KNOCKED_OUT')) {
      if (result.activityEvents.some(event => event.activity === 'DOWNED' && event.status === 'failed')) {
        totals.knockoutsFromDowned += 1
      } else {
        totals.knockoutsFromTimeout += 1
      }
    }
    for (const event of result.events) {
      if (event.id.startsWith('weapon_lost_')) {
        const weapon = findWeapon(event.id.slice('weapon_lost_'.length))
        if (!weapon) throw new Error(`Audit cannot price lost weapon: ${event.id}`)
        totals.weaponLossValue += weapon.value
      }
    }
    if (singleRaid && (result.state.stats.extracts.total > 0 || result.state.stats.deaths.total > 0)) break
    vi.spyOn(Date, 'now').mockReturnValue(now + 1)
    applyPolicy(stateRef, actions, policy, totals, extractionTick, extractionTick !== EXTRACTION_TIMINGS.overextended)
    if (paidPreparation && tick < MAX_CATCHUP_TICKS && before.raid.phase !== 'HUB' && stateRef.value.raid.phase === 'HUB') {
      for (const item of [...stateRef.value.homeStash]) actions.sellHomeStashItem(item.itemId)
      stateRef.value = prepareEconomy(stateRef.value, now + 1, economy)
    }
  }
  totals.extracts = stateRef.value.stats.extracts.total - initial.stats.extracts.total
  totals.failures = stateRef.value.stats.deaths.total - initial.stats.deaths.total
  totals.securedValue = securedWealth(stateRef.value) - startingWealth
  if (singleRaid && totals.extracts + totals.failures !== 1) throw new Error(`Unresolved audit raid: ${seed}`)
  const purchaseSpend = economy.supplyPurchases + economy.weaponPurchases + economy.repairs
  expect(totals.securedValue).toBe(economy.grossSecured - purchaseSpend)
  const retainedGain = retainedWealth(stateRef.value) - startingRetained
  const sustainableProxy = economy.grossSecured - economy.deployedSupplyReplacement - economy.repairs
    + equipmentValue(stateRef.value) - equipmentValue(initial) - economy.weaponPurchases
  return { state: stateRef.value, seed: rngRef.current.getSeed(), totals, economy, retainedGain, sustainableProxy }
}

function summarize(label: string, results: ReturnType<typeof simulate>[], preparationSpent = 0) {
  const sum = results.reduce((total, result) => {
    for (const key of Object.keys(total) as (keyof Metrics)[]) total[key] += result.totals[key]
    return total
  }, metrics())
  sum.preparationSpent = preparationSpent * results.length
  const hours = sum.ticks * TICK_INTERVAL_MS / 3_600_000
  const resolved = sum.extracts + sum.failures
  return {
    label, runs: results.length, ...sum,
    extractionRate: sum.extracts / resolved,
    failureRate: sum.failures / resolved,
    securedValuePerHour: sum.securedValue / hours,
    netAfterPreparationPerHour: (sum.securedValue - sum.preparationSpent) / hours,
    raidingMinutesPerRun: sum.raidingTicks * TICK_INTERVAL_MS / 60_000 / results.length,
  }
}

describe('survival audit baseline (no balance thresholds)', () => {
  beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(0))
  afterEach(() => vi.restoreAllMocks())

  it('replays attended policies deterministically through the real action boundary', () => {
    const initial = raidStart('High', true)
    const saved = structuredClone(initial)
    expect(simulate(initial, 17, 'support_extract', true)).toEqual(simulate(initial, 17, 'support_extract', true))
    expect(initial).toEqual(saved)
    expect(initial.coins).toBe(0)
    expect(initial.raid.healingItems.reduce((sum, item) => sum + item.quantity, 0)).toBe(4)
    expect(initial.raid.backpackValue).toBe(0)
  })

  it('counts secured wealth including pocket/overflow coins, not an unextracted backpack', () => {
    const state = createInitialState(0)
    state.raid.backpack = [{ itemId: 'water_bottle', name: 'Water Bottle', rarity: 1, value: 999, quantity: 1 }]
    state.raid.backpackValue = 999
    expect(securedWealth(state)).toBe(0)
    state.homeStash = [{ itemId: 'water_bottle', name: 'Water Bottle', rarity: 1, value: 12, quantity: 2 }]
    state.coins = 17
    expect(securedWealth(state)).toBe(41)
  })

  it('retains unspent stock and equipment without double charging purchases or ignoring wear', () => {
    const initial = { ...createInitialState(0), coins: 500 }
    const economy: EconomyMetrics = {
      grossSecured: 0, supplyPurchases: 0, weaponPurchases: 0, repairs: 0,
      deployedSupplyReplacement: 0, successfulHauls: [], successfulRaidTicks: [],
    }
    const prepared = prepareEconomy(initial, 0, economy)
    expect(economy.supplyPurchases).toBe(PREPARATION_COST)
    expect(economy.weaponPurchases).toBe(65)
    expect(retainedWealth(prepared)).toBe(retainedWealth(initial))
    const worn = {
      ...prepared,
      ownedWeapons: prepared.ownedWeapons.map(item => item.weaponId === 'aspperigo'
        ? { ...item, durability: item.durability - 1 } : item),
    }
    expect(retainedWealth(worn)).toBe(retainedWealth(initial) - 18)
    const repaired = prepareEconomy(worn, 1, economy)
    expect(economy.repairs).toBe(18)
    expect(retainedWealth(repaired)).toBe(retainedWealth(worn))
    expect(simulate(initial, 17, 'support_extract', false, 50, true))
      .toEqual(simulate(initial, 17, 'support_extract', false, 50, true))
  })

  it('reports fixed cohorts and verifies eight-hour unattended catch-up parity', () => {
    const report: ReturnType<typeof summarize>[] = []
    for (const danger of DANGERS) {
      for (const prepared of [false, true]) {
        for (const policy of POLICIES) {
          const results = Array.from({ length: RAID_SEEDS }, (_, i) => simulate(raidStart(danger, prepared), i + 1, policy, true))
          const summary = summarize(`${danger}/${prepared ? 'prepared' : 'found_only'}/${policy}`, results, prepared ? PREPARATION_COST : 0)
          expect(summary.extracts + summary.failures).toBe(RAID_SEEDS)
          expect(summary.knockoutsFromDowned + summary.knockoutsFromTimeout).toBe(summary.failures)
          expect(summary.extractionRate + summary.failureRate).toBeCloseTo(1)
          if (policy === 'unattended') {
            expect(summary.medsUsed + summary.rechargersUsed + summary.signalSpent + summary.amplifiersUsed).toBe(0)
          }
          report.push(summary)
        }
      }
    }
    for (const policy of POLICIES) {
      const results = Array.from({ length: SESSION_SEEDS }, (_, i) => {
        const initial = createInitialState(0)
        const result = simulate(initial, i + 1, policy, false)
        if (policy === 'unattended') {
          const rng = createRNG(i + 1)
          const offline = catchUp(initial, rng, 0, MAX_CATCHUP_TICKS * TICK_INTERVAL_MS)
          expect(result.state).toEqual(offline.state)
          expect(result.seed).toBe(rng.getSeed())
          expect(result.totals.securedValue).toBe(offline.summary.itemsGained)
          expect(result.totals.extracts).toBe(offline.summary.extracts)
          // Catch-up also counts a loss whose recovery bookkeeping is still pending.
          expect(result.totals.failures + (result.state.raid.phase === 'KNOCKED_OUT' ? 1 : 0))
            .toBe(offline.summary.deaths)
        }
        return result
      })
      report.push(summarize(`8h/natural_zones/${policy}`, results))
    }
    if (process.env.SURVIVAL_AUDIT_REPORT === '1') console.log(JSON.stringify(report, null, 2))
  }, 120_000)

  it('compares extraction timings with an affordable preparation loop and reconciled accounting', () => {
    const report = []
    for (const prepared of [false, true]) {
      for (const timing of ['unattended', 'early', 'mid', 'deep', 'overextended'] as const) {
        const results = Array.from({ length: SESSION_SEEDS }, (_, i) => {
          const initial = { ...createInitialState(0), coins: 500 }
          const tick = timing === 'unattended' ? undefined : EXTRACTION_TIMINGS[timing]
          return simulate(initial, i + 1, timing === 'unattended' ? 'unattended' : 'support_extract', false, tick, prepared)
        })
        const hourly = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / (SESSION_SEEDS * 8)
        const sorted = results.map(result => result.retainedGain / 8).sort((a, b) => a - b)
        const hauls = results.flatMap(result => result.economy.successfulHauls)
        const raidTicks = results.flatMap(result => result.economy.successfulRaidTicks)
        const extracts = results.reduce((sum, result) => sum + result.totals.extracts, 0)
        const failures = results.reduce((sum, result) => sum + result.totals.failures, 0)
        report.push({
          preparation: prepared ? 'paid' : 'found_only', timing,
          extractionRate: extracts / (extracts + failures),
          grossSecuredPerHour: hourly(results.map(result => result.economy.grossSecured)),
          retainedNetPerHour: hourly(results.map(result => result.retainedGain)),
          sustainableReplacementProxyPerHour: hourly(results.map(result => result.sustainableProxy)),
          medianRetainedNetPerHour: (sorted[11] + sorted[12]) / 2,
          p10RetainedNetPerHour: sorted[Math.ceil(sorted.length * 0.1) - 1],
          meanSuccessfulHaul: hauls.reduce((sum, value) => sum + value, 0) / hauls.length,
          meanSuccessfulRaidingMinutes: raidTicks.reduce((sum, value) => sum + value, 0) / raidTicks.length / 2,
          supplyPurchasesPerHour: hourly(results.map(result => result.economy.supplyPurchases)),
          weaponPurchasesPerHour: hourly(results.map(result => result.economy.weaponPurchases)),
          repairsPerHour: hourly(results.map(result => result.economy.repairs)),
          weaponLossValuePerHour: hourly(results.map(result => result.totals.weaponLossValue)),
          deployedSupplyReplacementPerHour: hourly(results.map(result => result.economy.deployedSupplyReplacement)),
        })
        for (const result of results) {
          expect(result.state.coins).toBeGreaterThanOrEqual(0)
          expect(result.totals.ticks).toBe(MAX_CATCHUP_TICKS)
        }
        for (const value of Object.values(report.at(-1)!)) {
          if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true)
        }
      }
    }
    if (process.env.SURVIVAL_ECONOMY_REPORT === '1') console.log(JSON.stringify(report, null, 2))
  }, 120_000)
})
