/**
 * Catch-up tests:
 * - Elapsed time → expected tick count
 * - 8-hour cap enforced
 * - Away summary counts deaths and extracts correctly
 */

import { describe, it, expect } from 'vitest'
import { createRNG } from '../../src/engine/rng'
import { catchUp, TICK_INTERVAL_MS, MAX_CATCHUP_TICKS } from '../../src/engine/catchUp'
import { createInitialState } from '../../src/engine/initialState'

describe('catchUp', () => {
  it('returns 0 ticks when no time elapsed', () => {
    const state = createInitialState(1000)
    const rng = createRNG(1)
    const result = catchUp(state, rng, 1000, 1000)
    expect(result.summary.ticksReplayed).toBe(0)
  })

  it('computes correct tick count from elapsed time', () => {
    const state = createInitialState(0)
    const rng = createRNG(1)
    const elapsed = 3 * TICK_INTERVAL_MS  // exactly 3 ticks
    const result = catchUp(state, rng, 0, elapsed)
    expect(result.summary.ticksReplayed).toBe(3)
  })

  it('floors partial ticks', () => {
    const state = createInitialState(0)
    const rng = createRNG(1)
    const elapsed = 2.7 * TICK_INTERVAL_MS
    const result = catchUp(state, rng, 0, elapsed)
    expect(result.summary.ticksReplayed).toBe(2)
  })

  it('caps at MAX_CATCHUP_TICKS (8 hours)', () => {
    const state = createInitialState(0)
    const rng = createRNG(1)
    const hours24 = 24 * 60 * 60 * 1000
    const result = catchUp(state, rng, 0, hours24)
    expect(result.summary.ticksReplayed).toBe(MAX_CATCHUP_TICKS)
  })

  it('MAX_CATCHUP_TICKS corresponds to 8 hours', () => {
    const hours8ms = 8 * 60 * 60 * 1000
    const expected = Math.floor(hours8ms / TICK_INTERVAL_MS)
    expect(MAX_CATCHUP_TICKS).toBe(expected)
  })

  it('advances the tick counter by ticksReplayed', () => {
    const state = createInitialState(0)
    const rng = createRNG(42)
    const elapsed = 10 * TICK_INTERVAL_MS
    const result = catchUp(state, rng, 0, elapsed)
    expect(result.state.tick).toBe(state.tick + 10)
  })

  it('summary includes non-empty lines', () => {
    const state = createInitialState(0)
    const rng = createRNG(7)
    const elapsed = 5 * TICK_INTERVAL_MS
    const result = catchUp(state, rng, 0, elapsed)
    expect(result.summary.lines.length).toBeGreaterThan(0)
  })

  it('uses actual replayed comms in the summary lines', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phaseTicksRemaining: 1,
      },
    }
    const result = catchUp(state, createRNG(3), 0, TICK_INTERVAL_MS)

    expect(result.summary.lines.some(line => line.includes('Gear packed. Pod hatch sealed.'))).toBe(true)
  })

  it('returns replayed events for external publishing', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phaseTicksRemaining: 1,
      },
    }

    const result = catchUp(state, createRNG(3), 0, TICK_INTERVAL_MS)

    expect(result.events[0].id).toBe('phase_HUB_to_DEPLOYING')
    expect(result.events.some(event => event.phase === 'DEPLOYING')).toBe(true)
  })

  it('timestamps replayed events at elapsed tick times', () => {
    const lastTickAt = 1000
    const result = catchUp(
      createInitialState(lastTickAt),
      createRNG(1),
      lastTickAt,
      lastTickAt + TICK_INTERVAL_MS,
    )

    expect(result.state.log[0].timestamp).toBe(lastTickAt + TICK_INTERVAL_MS)
  })

  it('is deterministic: same inputs → same output', () => {
    const state = createInitialState(0)
    const elapsed = 8 * TICK_INTERVAL_MS

    const result1 = catchUp(state, createRNG(55), 0, elapsed)
    const result2 = catchUp(state, createRNG(55), 0, elapsed)

    expect(result1.state.tick).toBe(result2.state.tick)
    expect(result1.summary.ticksReplayed).toBe(result2.summary.ticksReplayed)
  })

  it('reports only newly failed raids as away deaths', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raider: { ...initial.raider, hp: 0 },
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        phaseTicksRemaining: 30,
      },
    }

    const result = catchUp(state, createRNG(42), 0, 3 * TICK_INTERVAL_MS)

    expect(result.summary.deaths).toBe(1)
    expect(result.summary.lines.some(line => line.includes('1 death'))).toBe(true)
  })

  it('does not count a pre-existing KNOCKED_OUT recovery as a new away death', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'KNOCKED_OUT' as const,
        phaseTicksRemaining: 1,
      },
    }

    const result = catchUp(state, createRNG(9), 0, TICK_INTERVAL_MS)

    expect(result.state.raider.deathCount).toBe(initial.raider.deathCount + 1)
    expect(result.summary.deaths).toBe(0)
    expect(result.summary.lines.some(line => line.includes('no new deaths'))).toBe(true)
  })

  it('reports loot value gained from items moved into the home stash', () => {
    const rng = createRNG(1)
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        phaseTicksRemaining: 30,
        extracting: { ticksRemaining: 1 },
        backpack: [
          {
            itemId: 'water_bottle',
            name: 'Water Bottle',
            value: 5,
            rarity: 1,
            quantity: 2,
          },
        ],
        backpackValue: 10,
      },
    }

    const result = catchUp(state, rng, 0, TICK_INTERVAL_MS)

    expect(result.summary.extracts).toBe(1)
    expect(result.summary.itemsGained).toBe(10)
  })
})
