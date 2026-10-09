import { describe, expect, it, vi } from 'vitest'
import { applyEffects, loot } from '../../src/engine/eventResolver'
import { deadlineExtractionChance, runGreedCheck } from '../../src/engine/greedCheck'
import { getTotalItemValue } from '../../src/engine/homeStash'
import { createInitialState } from '../../src/engine/initialState'
import { advanceRaidActivity, startRaidActivity } from '../../src/engine/raidActivities'
import { raidExposure, raidLootValueMultiplier, raidLootWeightMultiplier, raidRiskMultiplier } from '../../src/engine/raidPacing'
import { createRNG } from '../../src/engine/rng'
import { processTick } from '../../src/engine/tick'
import type { GameState } from '../../src/engine/types'

function raidAt(remaining: number): GameState {
  const initial = createInitialState(0)
  return {
    ...initial,
    raid: { ...initial.raid, phase: 'RAIDING', phaseTicksRemaining: remaining, dangerLevel: 'Low', zone: 'damp_battlegrounds' },
  }
}

describe('raid exposure risk/reward', () => {
  it('bounds exposure to raid time without changing the named danger level or item catalog', () => {
    expect(raidExposure(createInitialState(0).raid)).toBe(0)
    expect(raidExposure(raidAt(80).raid)).toBe(0)
    expect(raidExposure(raidAt(60).raid)).toBe(0)
    expect(raidExposure(raidAt(30).raid)).toBe(0.5)
    expect(raidExposure(raidAt(-10).raid)).toBe(1)
    expect(raidRiskMultiplier(raidAt(0).raid)).toBe(1.5)
    expect(raidLootValueMultiplier(raidAt(0).raid)).toBe(1.5)
    expect(raidLootWeightMultiplier(raidAt(0).raid, 100, 100)).toBe(3)
    expect(raidLootWeightMultiplier(raidAt(0).raid, 0, 0)).toBe(1)
  })

  it('awards higher actual diary item value later, not just a larger backpack counter', () => {
    const template = { id: 'test_pacing_loot', weight: 1, text: '', effects: { backpackValue: 1000 } }
    const early = applyEffects(raidAt(60), template, createRNG(1)).state
    const late = applyEffects(raidAt(10), template, createRNG(1)).state
    expect(getTotalItemValue(late.raid.backpack)).toBeGreaterThan(getTotalItemValue(early.raid.backpack))
    for (const item of late.raid.backpack) {
      expect(item.value).toBe(loot.find(entry => entry.id === item.itemId)?.value)
    }
  })

  it('increases completed SEARCH and robot loot expected value with matched seeds', () => {
    function sample(remaining: number, robot: boolean) {
      let total = 0
      for (let seed = 1; seed <= 1000; seed += 1) {
        const initial = raidAt(remaining)
        const rng = createRNG(seed)
        const started = startRaidActivity(initial, robot
          ? { activityId: 'robot_encounter_standard', robotId: 'tank_overcompensation' }
          : { activityId: 'search_quick_value_1' }, rng, 0)
        if (!started?.state.raid.activeRaidActivity) throw new Error('Pacing fixture activity did not start')
        const active = started.state.raid.activeRaidActivity
        const state = {
          ...started.state,
          raid: {
            ...started.state.raid,
            activeRaidActivity: { ...active, ticksRemaining: 1, robotHp: robot ? 1 : undefined },
          },
        }
        const result = advanceRaidActivity(state, rng, 30_000)
        expect(result.activityEvents.some(event => event.status === 'completed')).toBe(true)
        total += getTotalItemValue(result.state.raid.backpack)
      }
      return total / 1000
    }
    expect(sample(10, false)).toBeGreaterThanOrEqual(sample(60, false) * 1.05)
    expect(sample(10, true)).toBeGreaterThanOrEqual(sample(60, true) * 1.02)
  })

  it('increases ambient downing pressure as time passes', () => {
    const rng = createRNG(1)
    vi.spyOn(rng, 'next').mockReturnValue(0.008)
    expect(runGreedCheck({ ...raidAt(60).raid, dangerLevel: 'Medium' }, rng, {}).outcome).toBe('PUSH_DEEPER')
    expect(runGreedCheck({ ...raidAt(10).raid, dangerLevel: 'Medium' }, rng, {}).outcome).toBe('DOWNED')
  })
})

describe('deadline extraction during combat', () => {
  function combatAt(remaining: number): GameState {
    const initial = raidAt(remaining)
    const started = startRaidActivity(initial,
      { activityId: 'robot_encounter_standard', robotId: 'anxietick' }, createRNG(1), 0)
    if (!started) throw new Error('Combat fixture did not start')
    return started.state
  }

  it('can interrupt combat and recharge before the countdown margin runs out', () => {
    const initial = combatAt(9)
    initial.raid.activeShieldRecharge = {
      itemId: 'fizz_cell', name: 'Fizz Cell', totalCharge: 20, chargeRemaining: 20, totalTicks: 5, ticksRemaining: 5,
    }
    const rng = createRNG(1)
    vi.spyOn(rng, 'next').mockReturnValue(0.3)
    const result = processTick(initial, rng, 30_000)
    expect(result.state.raid.extracting).toMatchObject({ ticksRemaining: 4, totalTicks: 4 })
    expect(result.state.raid.activeRaidActivity).toBeNull()
    expect(result.state.raid.activeShieldRecharge).toBeNull()
    expect(result.activityEvents.some(event => event.activity === 'ROBOT_ENCOUNTER')).toBe(false)
    expect(result.activityEvents.some(event => event.activity === 'EXTRACTION' && event.status === 'started')).toBe(true)
    expect(result.events.find(event => event.id === 'condition_extracting_started')?.text)
      .toContain('Exit window closing.')
    expect(initial.raid.extracting).toBeNull()
  })

  it('still allows a greedy Raider to ignore urgency and lose to timeout', () => {
    const rng = createRNG(1)
    vi.spyOn(rng, 'next').mockReturnValue(0.99)
    const result = processTick(combatAt(1), rng, 30_000)
    expect(result.state.raid.phase).toBe('KNOCKED_OUT')
    expect(result.state.raid.extracting).toBeNull()
  })

  it('reserves the longer hostile-zone countdown rather than assuming four ticks', () => {
    const initial = combatAt(17)
    initial.raid.zone = 'the_breach'
    const rng = createRNG(1)
    vi.spyOn(rng, 'next').mockReturnValue(0.08)
    const result = processTick(initial, rng, 30_000)
    expect(result.state.raid.extracting).toMatchObject({ ticksRemaining: 6, totalTicks: 6 })
    expect(result.events.find(event => event.id === 'condition_extracting_started')?.text).toContain('6 ticks')
  })

  it.each([
    { action: 'pendingCalm', greed: 50, expectedGreed: 38 },
    { action: 'pendingPressure', greed: 50, expectedGreed: 58 },
    { action: 'pendingCalm', greed: 5, expectedGreed: 0 },
    { action: 'pendingPressure', greed: 97, expectedGreed: 100 },
  ] as const)('applies $action once with feedback when urgency interrupts combat at greed $greed', ({ action, greed, expectedGreed }) => {
    const initial = { ...combatAt(9), [action]: true }
    initial.raid.greedLevel = greed
    const rng = createRNG(1)
    vi.spyOn(rng, 'next').mockReturnValue(0.3)
    const result = processTick(initial, rng, 30_000)
    expect(result.state.raid.extracting).not.toBeNull()
    expect(result.state.raid.greedLevel).toBe(expectedGreed)
    expect(result.state[action]).toBe(false)
    expect(result.events.some(event => event.id === (action === 'pendingCalm' ? 'handler_calm' : 'handler_pressure'))).toBe(true)
    expect(initial.raid.greedLevel).toBe(greed)
    expect(initial[action]).toBe(true)
    const next = processTick(result.state, rng, 60_000)
    expect(next.state.raid.greedLevel).toBe(expectedGreed)
    expect(next.events.some(event => event.id === 'handler_calm' || event.id === 'handler_pressure')).toBe(false)
  })

  it.each([
    { action: 'pendingCalm', expectedGreed: 38, extracts: true },
    { action: 'pendingPressure', expectedGreed: 58, extracts: false },
  ] as const)('uses $action-adjusted greed for the combat deadline roll', ({ action, expectedGreed, extracts }) => {
    const initial = { ...combatAt(9), [action]: true }
    initial.raid.greedLevel = 50
    const unadjustedChance = deadlineExtractionChance({ ...initial.raid, phaseTicksRemaining: 8 }, 4)
    const adjustedChance = deadlineExtractionChance({
      ...initial.raid, phaseTicksRemaining: 8, greedLevel: expectedGreed,
    }, 4)
    const roll = (unadjustedChance + adjustedChance) / 2
    const rng = createRNG(1)
    vi.spyOn(rng, 'next').mockReturnValueOnce(roll).mockReturnValue(0.3)
    const result = processTick(initial, rng, 30_000)
    expect(result.state.raid.extracting !== null).toBe(extracts)
    expect(result.state.raid.greedLevel).toBe(expectedGreed)
    expect(result.state[action]).toBe(false)
  })

  it.each([
    { action: 'pendingCalm', expectedGreed: 38 },
    { action: 'pendingPressure', expectedGreed: 58 },
  ] as const)('applies $action exactly once in the regular greed check', ({ action, expectedGreed }) => {
    const initial = { ...raidAt(9), [action]: true }
    initial.raid.greedLevel = 50
    const rng = createRNG(1)
    vi.spyOn(rng, 'next').mockReturnValue(0.3)
    const result = processTick(initial, rng, 30_000)
    expect(result.state.raid.extracting).not.toBeNull()
    expect(result.state.raid.greedLevel).toBe(expectedGreed)
    expect(result.state[action]).toBe(false)
  })

  it('does not interrupt early combat or an already-running downed/extraction race', () => {
    const early = processTick(combatAt(40), createRNG(1), 30_000)
    expect(early.state.raid.extracting).toBeNull()
    expect(early.activityEvents.some(event => event.activity === 'ROBOT_ENCOUNTER')).toBe(true)
    const state = raidAt(4)
    state.raid.extracting = { ticksRemaining: 2, totalTicks: 4 }
    state.raid.downed = { ticksRemaining: 2, totalTicks: 2 }
    state.raider.hp = 0
    const next = processTick(state, createRNG(1), 30_000).state
    expect(next.raid.extracting?.ticksRemaining).toBe(1)
    expect(next.raid.downed?.ticksRemaining).toBe(1)
  })

  it('usually starts extraction with countdown margin even at maximum greed', () => {
    let onTime = 0
    let ignored = 0
    for (let seed = 1; seed <= 1000; seed += 1) {
      const rng = createRNG(seed)
      let started = false
      for (let remaining = 16; remaining > 4; remaining -= 1) {
        if (rng.next() < deadlineExtractionChance({ ...raidAt(remaining).raid, greedLevel: 100 })) {
          started = true
          break
        }
      }
      if (started) onTime += 1
      else ignored += 1
    }
    expect(onTime / 1000).toBeGreaterThanOrEqual(0.95)
    // The formula, not this finite cohort, preserves a nonzero chance of misses.
    expect(ignored).toBeLessThanOrEqual(50)
  })
})
