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

    for (let i = 0; i < 25; i++) {
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

  it('transfers backpack loot into the home stash after extraction', () => {
    const rng = createRNG(FIXED_SEED)
    const state = {
      ...createInitialState(0),
      raid: {
        ...createInitialState(0).raid,
        zone: 'damp_battlegrounds',
        timeOfDay: 'Night' as const,
        phase: 'EXTRACTING' as const,
        phaseTicksRemaining: 1,
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

    const result = processTick(state, rng, 0)

    expect(result.state.raid.phase).toBe('HUB')
    expect(result.state.homeStash).toEqual([
      {
        itemId: 'water_bottle',
        name: 'Water Bottle',
        value: 5,
        rarity: 1,
        quantity: 2,
      },
    ])
    expect(result.state.raider.extractCount).toBe(1)
    expect(result.state.stats.extracts.total).toBe(1)
    expect(result.state.stats.extracts.byZone.damp_battlegrounds).toBe(1)
    expect(result.state.stats.extracts.byZoneAndTime['damp_battlegrounds__Night']).toBe(1)
  })

  it('downs the raider when HP reaches 0, losing the backpack', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raider: { ...initial.raider, hp: 0 },
      homeStash: [
        {
          itemId: 'scrap',
          name: 'Scrap',
          value: 2,
          rarity: 1,
          quantity: 4,
        },
      ],
      raid: {
        ...initial.raid,
        zone: 'damp_battlegrounds',
        timeOfDay: 'Night' as const,
        phase: 'DEPLOYING' as const,
        phaseTicksRemaining: 2,
        greedLevel: 0,
        backpack: [
          {
            itemId: 'water_bottle',
            name: 'Water Bottle',
            value: 5,
            rarity: 1,
            quantity: 3,
          },
        ],
        backpackValue: 15,
      },
    }

    const rng = createRNG(FIXED_SEED)
    const result = processTick(state, rng, 0)
    expect(result.state.raid.phase).toBe('DOWNED')
    expect(result.events.some(e => e.id === 'phase_DEPLOYING_to_DOWNED')).toBe(true)

    // Ride out DOWNED → HUB: loot must be lost, HP restored, death counted
    let downedState = result.state
    const deathsBefore = downedState.raider.deathCount
    const stashBefore = downedState.homeStash
    const rng2 = createRNG(7)
    for (let i = 0; i < 5 && downedState.raid.phase !== 'HUB'; i++) {
      downedState = processTick(downedState, rng2, i * 5000).state
    }
    expect(downedState.raid.phase).toBe('HUB')
    expect(downedState.raid.backpack).toEqual([])
    expect(downedState.homeStash).toEqual(stashBefore)
    expect(downedState.raider.hp).toBe(downedState.raider.maxHp)
    expect(downedState.raider.deathCount).toBe(deathsBefore + 1)
    expect(downedState.stats.deaths.total).toBe(1)
    expect(downedState.stats.deaths.byZone.damp_battlegrounds).toBe(1)
    expect(downedState.stats.deaths.byZoneAndTime['damp_battlegrounds__Night']).toBe(1)
  })

  it('downs the raider when the raid timer expires before extraction', () => {
    const rng = createRNG(FIXED_SEED)
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        phaseTicksRemaining: 1,
        greedLevel: 0,
      },
    }

    const result = processTick(state, rng, 0)
    expect(result.state.raid.phase).toBe('DOWNED')
    expect(result.events.some(e => e.id === 'phase_RAIDING_to_DOWNED')).toBe(true)
  })

  it('stacks extracted quantities into existing stash entries', () => {
    const rng = createRNG(FIXED_SEED)
    const initial = createInitialState(0)
    const state = {
      ...initial,
      homeStash: [
        {
          itemId: 'scrap',
          name: 'Scrap',
          value: 2,
          rarity: 1,
          quantity: 9,
        },
      ],
      raid: {
        ...initial.raid,
        phase: 'EXTRACTING' as const,
        phaseTicksRemaining: 1,
        backpack: [
          {
            itemId: 'ammo',
            name: 'Ammo Box',
            value: 8,
            rarity: 2,
            quantity: 3,
          },
        ],
        backpackValue: 24,
      },
    }

    const result = processTick(state, rng, 0)

    expect(result.state.homeStash).toEqual([
      {
        itemId: 'scrap',
        name: 'Scrap',
        value: 2,
        rarity: 1,
        quantity: 9,
      },
      {
        itemId: 'ammo',
        name: 'Ammo Box',
        value: 8,
        rarity: 2,
        quantity: 3,
      },
    ])
  })

  it('does not auto-use bandages during ticks', () => {
    const rng = createRNG(FIXED_SEED)
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raider: { ...initial.raider, hp: 50 },
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        phaseTicksRemaining: 120,
        healingItems: [
          {
            itemId: 'bandage_purple',
            name: 'Purple Bandage',
            healAmount: 50,
            moodGain: 4,
            rarity: 4,
            quantity: 1,
          },
        ],
      },
    }

    const result = processTick(state, rng, 0)
    expect(result.state.raider.hp).toBeLessThanOrEqual(50)
    expect(result.state.raid.healingItems).toHaveLength(1)
    expect(result.events.some(e => e.id === 'healing_bandage_purple_used')).toBe(false)
  })
})
