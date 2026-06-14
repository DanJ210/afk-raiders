import { describe, expect, it } from 'vitest'
import { createInitialState } from '../../src/engine/initialState'
import { processTick } from '../../src/engine/tick'
import { createRNG } from '../../src/engine/rng'
import { TICK_INTERVAL_MS } from '../../src/engine/catchUp'
import type { GameState } from '../../src/engine/types'

type RaidOutcome = 'EXTRACTED' | 'DOWNED'

interface RaidSimulationResult {
  outcome: RaidOutcome
  raidingTicks: number
}

function createRaidStart(): GameState {
  const state = createInitialState(0)
  return {
    ...state,
    raid: {
      ...state.raid,
      zone: 'damp_battlegrounds',
      timeOfDay: 'Day',
      phase: 'RAIDING',
      phaseTicksRemaining: 120,
    },
  }
}

function simulateRaid(seed: number): RaidSimulationResult {
  const rng = createRNG(seed)
  let state = createRaidStart()
  let raidingTicks = 0

  for (let tick = 0; tick < 1_200; tick += 1) {
    if (state.raid.phase === 'RAIDING') {
      raidingTicks += 1
    }
    state = processTick(state, rng, tick * TICK_INTERVAL_MS).state

    if (state.raider.extractCount > 0) return { outcome: 'EXTRACTED', raidingTicks }
    if (state.raider.deathCount > 0) return { outcome: 'DOWNED', raidingTicks }
  }

  throw new Error(`raid did not resolve for seed ${seed}`)
}

describe('raid balance', () => {
  it('keeps raids running longer with greed-driven exits disabled', () => {
    const outcomes = Array.from({ length: 200 }, (_, index) => simulateRaid(index + 1))
    const extracts = outcomes.filter(result => result.outcome === 'EXTRACTED').length
    const extractionRate = extracts / outcomes.length
    const averageRaidingTicks = outcomes.reduce((sum, result) => sum + result.raidingTicks, 0) / outcomes.length

    expect(extractionRate).toBeGreaterThanOrEqual(0.85)
    expect(averageRaidingTicks).toBeGreaterThanOrEqual(80)
    expect(outcomes.every(result => result.raidingTicks >= 20)).toBe(true)
  })
})
