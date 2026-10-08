import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useHandlerActions } from '../../src/composables/useHandlerActions'
import { catchUp, MAX_CATCHUP_TICKS, TICK_INTERVAL_MS } from '../../src/engine/catchUp'
import { getTotalItemValue } from '../../src/engine/homeStash'
import { createInitialState } from '../../src/engine/initialState'
import {
  consumeSelectedPreparationLoadouts, getHealingPurchaseCost, getShieldRechargerPurchaseCost,
  purchaseHealingItem, purchaseShieldRecharger, setSelectedHealingLoadout, setSelectedShieldRechargerLoadout,
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
    state.raid.phaseTicksRemaining <= 6
    || (state.raid.backpackValue > 0 && (
      state.raider.hp <= state.raider.maxHp * 0.5
      || state.raid.phaseTicksRemaining <= PHASE_DURATIONS.RAIDING - 20
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

function securedWealth(state: GameState): number {
  return getTotalItemValue(state.homeStash) + state.coins
}

function simulate(initial: GameState, seed: number, policy: Policy, singleRaid: boolean) {
  const stateRef = { value: structuredClone(initial) }
  const rngRef = { current: createRNG(seed) }
  const lastTickAt = { value: 0 }
  const totals = metrics()
  const actions = useHandlerActions(
    stateRef, rngRef, lastTickAt,
    () => stateRef.value.pendingCalm || stateRef.value.pendingPressure || stateRef.value.raid.forceExtract,
    () => undefined, () => { throw new Error('Audit must not reset the save') }, () => undefined,
  )
  const startingWealth = securedWealth(initial)
  for (let tick = 1; tick <= MAX_CATCHUP_TICKS; tick += 1) {
    const before = stateRef.value
    const now = tick * TICK_INTERVAL_MS
    const result = processTick(before, rngRef.current, now)
    stateRef.value = result.state
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
    applyPolicy(stateRef, actions, policy, totals)
  }
  totals.extracts = stateRef.value.stats.extracts.total - initial.stats.extracts.total
  totals.failures = stateRef.value.stats.deaths.total - initial.stats.deaths.total
  totals.securedValue = securedWealth(stateRef.value) - startingWealth
  if (singleRaid && totals.extracts + totals.failures !== 1) throw new Error(`Unresolved audit raid: ${seed}`)
  return { state: stateRef.value, seed: rngRef.current.getSeed(), totals }
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
})
