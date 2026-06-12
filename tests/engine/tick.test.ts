/**
 * Deterministic snapshot tests for the tick engine.
 * Fixed seed + fresh state → run N ticks → assert the event id sequence is stable.
 */

import { describe, it, expect } from 'vitest'
import { createRNG } from '../../src/engine/rng'
import { processTick } from '../../src/engine/tick'
import { createInitialState } from '../../src/engine/initialState'

const FIXED_SEED = 42

function runTicks(n: number, seed = FIXED_SEED) {
  const rng = createRNG(seed)
  let state = createInitialState(1000000)
  const allEvents: string[] = []

  for (let i = 0; i < n; i++) {
    const result = processTick(state, rng, 1000000 + i * 5000)
    result.events.forEach(e => allEvents.push(e.id))
    state = result.state
  }

  return { state, allEvents }
}

describe('deterministic snapshot', () => {
  it('produces the same event sequence for the same seed', () => {
    const { allEvents: run1 } = runTicks(20)
    const { allEvents: run2 } = runTicks(20)
    expect(run1).toEqual(run2)
  })

  it('produces a different event sequence for a different seed', () => {
    const { allEvents: run1 } = runTicks(20, 42)
    const { allEvents: run2 } = runTicks(20, 99)
    // Not guaranteed to differ on every event, but the sequences should diverge
    expect(run1.join(',')).not.toEqual(run2.join(','))
  })

  it('emits at least one event per tick', () => {
    const rng = createRNG(FIXED_SEED)
    let state = createInitialState(0)

    for (let i = 0; i < 10; i++) {
      const result = processTick(state, rng, i * 5000)
      expect(result.events.length).toBeGreaterThan(0)
      state = result.state
    }
  })

  it('starts in HUB phase', () => {
    const state = createInitialState(0)
    expect(state.raid.phase).toBe('HUB')
  })

  it('eventually transitions out of HUB to DEPLOYING', () => {
    const rng = createRNG(FIXED_SEED)
    let state = createInitialState(0)
    const phases = new Set<string>()

    for (let i = 0; i < 15; i++) {
      const result = processTick(state, rng, i * 5000)
      state = result.state
      phases.add(state.raid.phase)
    }

    expect(phases.has('DEPLOYING') || phases.has('RAIDING')).toBe(true)
  })

  it('increments tick counter each processTick call', () => {
    const rng = createRNG(FIXED_SEED)
    let state = createInitialState(0)

    for (let i = 0; i < 5; i++) {
      const result = processTick(state, rng, i * 5000)
      expect(result.state.tick).toBe(state.tick + 1)
      state = result.state
    }
  })

  it('does not mutate the input state', () => {
    const rng = createRNG(FIXED_SEED)
    const state = createInitialState(0)
    const tickBefore = state.tick
    const phaseBefore = state.raid.phase

    processTick(state, rng, 0)

    expect(state.tick).toBe(tickBefore)
    expect(state.raid.phase).toBe(phaseBefore)
  })
})
