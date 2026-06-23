/**
 * Deterministic snapshot tests for the tick engine.
 * Fixed seed + fresh state → run N ticks → assert the event id sequence is stable.
 */

import { describe, it, expect, vi } from 'vitest'
import { createRNG } from '../../src/engine/rng'
import type { RNG } from '../../src/engine/rng'
import { maybeAwardLootBonusConsumables, processTick } from '../../src/engine/tick'
import { createInitialState } from '../../src/engine/initialState'
import { getRaiderLevelFromXp, xpRequiredForLevel } from '../../src/engine/raiderLevel'
import { skillDefinitionById } from '../../src/engine/skills'

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
  it('can award both a healing item and shield recharger as independent loot bonuses', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
      },
    }

    const fakeRng = {
      next: vi
        .fn<() => number>()
        .mockReturnValueOnce(0.01)
        .mockReturnValueOnce(0.01),
      weightedPick: <T,>(items: readonly T[]) => items[0],
      pick: <T,>(items: readonly T[]) => items[0],
      int: () => 1,
      clone: () => { throw new Error('unused in test') },
      getSeed: () => 0,
    } as unknown as RNG

    const result = maybeAwardLootBonusConsumables(state, fakeRng, 0)

    expect(result.state.raid.healingItems).toHaveLength(1)
    expect(result.state.raid.backpack).toHaveLength(1)
    expect(result.state.raid.backpack[0].kind).toBe('shield_recharger')
    expect(result.events).toHaveLength(2)
    expect(result.events[0].id).toMatch(/^healing_.*_found$/)
    expect(result.events[1].id).toMatch(/^shield_recharger_.*_found$/)
  })

  it('rolls healing and shield recharger loot bonuses independently', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
      },
    }

    const fakeRng = {
      next: vi
        .fn<() => number>()
        .mockReturnValueOnce(0.99)
        .mockReturnValueOnce(0.01),
      weightedPick: <T,>(items: readonly T[]) => items[0],
      pick: <T,>(items: readonly T[]) => items[0],
      int: () => 1,
      clone: () => { throw new Error('unused in test') },
      getSeed: () => 0,
    } as unknown as RNG

    const result = maybeAwardLootBonusConsumables(state, fakeRng, 0)

    expect(result.state.raid.healingItems).toHaveLength(0)
    expect(result.state.raid.backpack).toHaveLength(1)
    expect(result.events).toHaveLength(1)
    expect(result.events[0].id).toMatch(/^shield_recharger_.*_found$/)
  })

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
      raider: {
        ...createInitialState(0).raider,
        mood: -4,
      },
      raid: {
        ...createInitialState(0).raid,
        zone: 'damp_battlegrounds',
        dangerLevel: 'Medium' as const,
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
    expect(result.state.raider.mood).toBeGreaterThan(-4)
    expect(result.state.stats.extracts.total).toBe(1)
    expect(result.state.stats.extracts.byZone.damp_battlegrounds).toBe(1)
    expect(result.state.stats.extracts.byZoneAndDanger['damp_battlegrounds__Medium']).toBe(1)
  })

  it('awards autonomous skill practice and level-up comms on extraction', () => {
    const rng = createRNG(FIXED_SEED)
    const initial = createInitialState(0)
    const cardioLevelOneXp = skillDefinitionById('cardio').xpThresholds[0]
    const state = {
      ...initial,
      raider: {
        ...initial.raider,
        hp: 40,
        skills: {
          ...initial.raider.skills,
          cardio: {
            ...initial.raider.skills.cardio,
            xp: cardioLevelOneXp - 1,
          },
        },
      },
      raid: {
        ...initial.raid,
        zone: 'damp_battlegrounds',
        dangerLevel: 'High' as const,
        phase: 'EXTRACTING' as const,
        phaseTicksRemaining: 1,
        backpack: [
          {
            itemId: 'water_bottle',
            name: 'Water Bottle',
            value: 5,
            rarity: 1,
            quantity: 4,
          },
        ],
        backpackValue: 20,
      },
    }

    const result = processTick(state, rng, 0)

    expect(result.state.raider.skills.cardio.level).toBe(1)
    expect(result.state.raider.skills.hoarding.xp).toBeGreaterThan(0)
    expect(result.state.raider.skills.hiding_in_lockers.xp).toBeGreaterThan(0)
    expect(result.events.some(event => event.id === 'skill_cardio_level_1')).toBe(true)
  })

  it('awards Raider Level XP and level-up comms on extraction', () => {
    const rng = createRNG(FIXED_SEED)
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raider: {
        ...initial.raider,
        levelXp: xpRequiredForLevel(2) - 1,
      },
      raid: {
        ...initial.raid,
        zone: 'damp_battlegrounds',
        dangerLevel: 'Medium' as const,
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

    expect(result.state.raider.levelXp).toBeGreaterThanOrEqual(xpRequiredForLevel(2))
    expect(getRaiderLevelFromXp(result.state.raider.levelXp)).toBe(2)
    expect(result.events.some(event => event.id === 'raider_level_2')).toBe(true)
  })

  it('awards base Raider Level XP for a successful extraction even without loot', () => {
    const rng = createRNG(FIXED_SEED)
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        zone: 'damp_battlegrounds',
        dangerLevel: 'Low' as const,
        phase: 'EXTRACTING' as const,
        phaseTicksRemaining: 1,
        backpack: [],
        backpackValue: 0,
      },
    }

    const result = processTick(state, rng, 0)

    expect(result.state.raider.levelXp).toBeGreaterThan(0)
    expect(result.state.raider.levelXp).toBeLessThanOrEqual(25)
  })

  it('pays the Raider Level extraction stipend from unlocked title bands', () => {
    const rng = createRNG(FIXED_SEED)
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raider: {
        ...initial.raider,
        levelXp: xpRequiredForLevel(10),
      },
      raid: {
        ...initial.raid,
        zone: 'damp_battlegrounds',
        dangerLevel: 'Low' as const,
        phase: 'EXTRACTING' as const,
        phaseTicksRemaining: 1,
        backpack: [
          {
            itemId: 'water_bottle',
            name: 'Water Bottle',
            value: 5,
            rarity: 1,
            quantity: 1,
          },
        ],
        backpackValue: 5,
      },
    }

    const result = processTick(state, rng, 0)

    expect(result.state.coins).toBe(1)
    expect(result.events.some(event => event.id === 'raider_level_extraction_stipend')).toBe(true)
  })

  it('downs the raider when HP reaches 0, losing the backpack', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raider: { ...initial.raider, hp: 0, mood: -5 },
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
        dangerLevel: 'Medium' as const,
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
    expect(downedState.raider.mood).toBeGreaterThan(-5)
    expect(downedState.raider.deathCount).toBe(deathsBefore + 1)
    expect(downedState.stats.deaths.total).toBe(1)
    expect(downedState.stats.deaths.byZone.damp_battlegrounds).toBe(1)
    expect(downedState.stats.deaths.byZoneAndDanger['damp_battlegrounds__Medium']).toBe(1)
  })

  it('saves exactly one hidden-pocket item when a failed raid clears the backpack', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raider: { ...initial.raider, hp: 0 },
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        phaseTicksRemaining: 2,
        backpack: [
          {
            itemId: 'water_bottle',
            name: 'Water Bottle',
            value: 5,
            rarity: 1,
            quantity: 4,
          },
        ],
        hiddenPocket: {
          itemId: 'water_bottle',
          name: 'Water Bottle',
          value: 5,
          rarity: 1,
        },
        backpackValue: 20,
      },
    }

    const rng = createRNG(FIXED_SEED)
    const firstTick = processTick(state, rng, 0)
    expect(firstTick.state.raid.phase).toBe('DOWNED')

    let downedState = firstTick.state
    for (let i = 0; i < 5 && downedState.raid.phase !== 'HUB'; i++) {
      downedState = processTick(downedState, rng, i * 5000 + 1000).state
    }

    expect(downedState.raid.phase).toBe('HUB')
    expect(downedState.raid.backpack).toEqual([])
    expect(downedState.raid.hiddenPocket).toBeNull()
    expect(downedState.homeStash).toEqual([
      {
        itemId: 'water_bottle',
        name: 'Water Bottle',
        value: 5,
        rarity: 1,
        quantity: 1,
      },
    ])
  })

  it('downs the raider when the raid timer expires before extraction', () => {
    const rng = createRNG(FIXED_SEED)
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raider: { ...initial.raider, hp: 73 },
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        phaseTicksRemaining: 1,
        greedLevel: 0,
      },
    }

    const result = processTick(state, rng, 0)
    expect(result.state.raid.phase).toBe('DOWNED')
    expect(result.state.raider.hp).toBe(0)
    expect(result.events.some(e => e.id === 'phase_RAIDING_to_DOWNED')).toBe(true)
  })

  it('honors Call Extract when the raid timer expires on the next tick', () => {
    const rng = createRNG(FIXED_SEED)
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raider: { ...initial.raider, hp: initial.raider.maxHp },
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        phaseTicksRemaining: 1,
        forceExtract: true,
        greedLevel: 0,
      },
    }

    const result = processTick(state, rng, 0)

    expect(result.events.some(e => e.id === 'phase_RAIDING_to_EXTRACTING')).toBe(true)
    expect(result.events.some(e => e.id === 'phase_RAIDING_to_DOWNED')).toBe(false)
    expect(result.state.raid.phase).not.toBe('DOWNED')
    expect(result.state.raider.hp).toBeGreaterThan(0)
  })

  it('keeps HP at 0 while the raider remains DOWNED', () => {
    const rng = createRNG(FIXED_SEED)
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raider: { ...initial.raider, hp: 42 },
      raid: {
        ...initial.raid,
        phase: 'DOWNED' as const,
        phaseTicksRemaining: 2,
      },
    }

    const result = processTick(state, rng, 0)

    expect(result.state.raid.phase).toBe('DOWNED')
    expect(result.state.raider.hp).toBe(0)
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

  it('extracts unused shield rechargers into the home stash like other backpack loot', () => {
    const rng = createRNG(FIXED_SEED)
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'EXTRACTING' as const,
        phaseTicksRemaining: 1,
        backpack: [
          {
            itemId: 'fizz_cell',
            name: 'Fizz Cell',
            value: 12,
            rarity: 1,
            quantity: 2,
            kind: 'shield_recharger' as const,
            shieldChargeAmount: 20,
          },
        ],
        backpackValue: 24,
      },
    }

    const result = processTick(state, rng, 0)

    expect(result.state.raid.phase).toBe('HUB')
    expect(result.state.homeStash).toEqual([
      {
        itemId: 'fizz_cell',
        name: 'Fizz Cell',
        value: 12,
        rarity: 1,
        quantity: 2,
        kind: 'shield_recharger',
        shieldChargeAmount: 20,
      },
    ])
  })
})
