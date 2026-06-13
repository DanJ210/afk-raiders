import { describe, expect, it } from 'vitest'
import { createInitialState } from '../../src/engine/initialState'
import { processTick } from '../../src/engine/tick'
import { createRNG } from '../../src/engine/rng'
import type { GameState } from '../../src/engine/types'

type RaidOutcome = 'EXTRACTED' | 'DOWNED'

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

function simulateRaid(seed: number): RaidOutcome {
  const rng = createRNG(seed)
  let state = createRaidStart()

  for (let tick = 0; tick < 240; tick += 1) {
    state = processTick(state, rng, tick * 15_000).state

    if (state.raider.extractCount > 0) return 'EXTRACTED'
    if (state.raider.deathCount > 0) return 'DOWNED'
  }

  throw new Error(`raid did not resolve for seed ${seed}`)
}

describe('raid balance', () => {
  it('lands near the target 75% successful extraction rate across seeded raids', () => {
    const outcomes = Array.from({ length: 200 }, (_, index) => simulateRaid(index + 1))
    const extracts = outcomes.filter(outcome => outcome === 'EXTRACTED').length
    const extractionRate = extracts / outcomes.length

    expect(extractionRate).toBeGreaterThanOrEqual(0.70)
    expect(extractionRate).toBeLessThanOrEqual(0.80)
  })
})
