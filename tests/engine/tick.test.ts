/**
 * Deterministic snapshot tests for the tick engine.
 * Fixed seed + fresh state → run N ticks → assert the event id sequence is stable.
 */

import { describe, it, expect, vi } from 'vitest'
import { createRNG } from '../../src/engine/rng'
import type { RNG } from '../../src/engine/rng'
import { downedActivityEvent, maybeAwardLootBonusConsumables, processTick } from '../../src/engine/tick'
import { createInitialState } from '../../src/engine/initialState'
import { getRaiderLevelFromXp, xpRequiredForLevel } from '../../src/engine/raiderLevel'
import { skillDefinitionById } from '../../src/engine/skills'
import { startRaidActivity } from '../../src/engine/raidActivities'

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
    const extractionCompleted = result.state.activityLog.find(event => event.activityId === 'current_extraction' && event.status === 'completed')
    expect(extractionCompleted).toBeDefined()
    expect(extractionCompleted?.id).toBe('activity_extraction_current_extraction_completed')
    expect(extractionCompleted?.activityName).toBe('Extraction Thread')
    expect(extractionCompleted?.text).toBe('Extraction thread closed. Raider made it back with the bag and several legal questions.')
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
        phase: 'RAIDING' as const,
        phaseTicksRemaining: 30,
        extracting: { ticksRemaining: 1 },
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
        phase: 'RAIDING' as const,
        phaseTicksRemaining: 30,
        extracting: { ticksRemaining: 1 },
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
        phase: 'RAIDING' as const,
        phaseTicksRemaining: 30,
        extracting: { ticksRemaining: 1 },
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
        phase: 'RAIDING' as const,
        phaseTicksRemaining: 30,
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
  expect(result.state.raid.phase).toBe('RAIDING')
  expect(result.state.raid.downed).not.toBeNull()
  expect(result.events.some(e => e.id === 'condition_downed_started')).toBe(true)

  // Ride out DOWNED → KNOCKED_OUT → HUB: loot must be lost, HP restored, death counted
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
          quantity: 1,
        },
        backpackValue: 20
      },
    }

    const rng = createRNG(FIXED_SEED)
    const firstTick = processTick(state, rng, 0)
    expect(firstTick.state.raid.phase).toBe('RAIDING')
    expect(firstTick.state.raid.downed).not.toBeNull()

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
    expect(result.state.raid.phase).toBe('RAIDING')
    expect(result.state.raid.downed).not.toBeNull()
    expect(result.state.raider.hp).toBe(0)
    expect(result.events.some(e => e.id === 'condition_downed_started')).toBe(true)
    expect(result.events.find(e => e.id === 'condition_downed_started')?.conditions).toEqual(['DOWNED'])
    const downedStarted = result.activityEvents.find(event => event.activityId === 'downed_recovery' && event.status === 'started')
    expect(downedStarted?.activityName).toBe('Downed Thread')
    expect(downedStarted?.text).toBe('Downed thread opened. 2 ticks before the zone writes the ending.')
  })

  it('logs why the raider was downed when robot combat causes it', () => {
    const rng = createRNG(FIXED_SEED)
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raider: { ...initial.raider, hp: 40 },
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        phaseTicksRemaining: 30,
        dangerLevel: 'High' as const,
        shield: null,
        activeRaidActivity: {
          id: 'robot_encounter_standard',
          name: 'Robot Encounter: Roomba Prime',
          kind: 'ROBOT_ENCOUNTER' as const,
          ticksRemaining: 1,
          totalTicks: 1,
          robotId: 'roomba_prime',
          robotHp: 999,
          robotMaxHp: 999,
          weaponId: 'tea_kettle',
          weaponName: 'Tea Kettle',
          raiderDamageMin: 0,
          raiderDamageMax: 0,
          robotDamageMultiplier: 50,
          raiderAction: 'fighting' as const,
        },
      },
    }

    const result = processTick(state, rng, 0)
    const downedEvent = result.events.find(event => event.id === 'condition_downed_started')

    expect(result.state.raid.downed?.reason).toMatchObject({
      kind: 'robot',
      robotId: 'roomba_prime',
      robotName: 'Roomba Prime',
    })
    expect(downedEvent?.text).toContain('Roomba Prime downed the Raider')
    expect(result.activityEvents.find(event => event.activityId === 'downed_recovery' && event.status === 'started')).toBeDefined()
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
    const eventIds = result.events.map(event => event.id)

    expect(eventIds).toContain('condition_extracting_started')
    expect(eventIds).not.toContain('condition_downed_started')
    expect(result.state.raid.extracting).not.toBeNull()
    expect(result.events.find(event => event.id === 'condition_extracting_started')?.conditions).toEqual(['EXTRACTING'])
    expect(result.activityEvents.find(event => event.activityId === 'current_extraction' && event.status === 'started')?.text).toBe('Extraction thread opened. LZ timer: 4 ticks.')
  })

  it('starts extraction with zone duration from extraction activity content', () => {
    function extractionTicksForZone(zone: string): number | undefined {
      const initial = createInitialState(0)
      const result = processTick({
        ...initial,
        raid: {
          ...initial.raid,
          phase: 'RAIDING' as const,
          phaseTicksRemaining: 30,
          zone,
          forceExtract: true,
          greedLevel: 0,
        },
      }, createRNG(FIXED_SEED), 0)

      return result.state.raid.extracting?.ticksRemaining
    }

    expect(extractionTicksForZone('forgotten_fields')).toBe(3)
    expect(extractionTicksForZone('the_breach')).toBe(6)
  })

  it('lets extraction completion beat an expiring DOWNED timer', () => {
    const rng = createRNG(FIXED_SEED)
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raider: { ...initial.raider, hp: 0 },
      raid: {
        ...initial.raid,
        zone: 'damp_battlegrounds',
        dangerLevel: 'High' as const,
        phase: 'RAIDING' as const,
        phaseTicksRemaining: 0,
        extracting: { ticksRemaining: 1 },
        downed: { ticksRemaining: 1 },
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
    const eventIds = result.events.map(event => event.id)

    expect(result.state.raid.phase).toBe('HUB')
    expect(result.state.raider.extractCount).toBe(1)
    expect(result.state.raider.deathCount).toBe(0)
    expect(result.state.homeStash).toEqual([
      {
        itemId: 'water_bottle',
        name: 'Water Bottle',
        value: 5,
        rarity: 1,
        quantity: 1,
      },
    ])
    expect(eventIds).toContain('phase_RAIDING_to_HUB')
    expect(eventIds).not.toContain('phase_RAIDING_to_KNOCKED_OUT')
  })

  it('completes extraction to HUB even when outcome odds would have selected a complication', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        zone: 'the_breach',
        dangerLevel: 'High' as const,
        phase: 'RAIDING' as const,
        phaseTicksRemaining: 30,
        extracting: { ticksRemaining: 1 },
        backpack: [
          {
            itemId: 'scrap_metal_basic',
            name: 'Basic Scrap Metal',
            value: 8,
            rarity: 1,
            quantity: 2,
          },
        ],
        backpackValue: 16,
      },
    }
    const outcomeSelectingRng = {
      next: vi.fn<() => number>().mockReturnValue(0),
      weightedPick: <T,>(items: readonly T[]) => items[0],
      pick: <T,>(items: readonly T[]) => items[0],
      int: (_min: number, max: number) => max,
      clone: () => outcomeSelectingRng as unknown as RNG,
      getSeed: () => 0,
    } as unknown as RNG

    const result = processTick(state, outcomeSelectingRng, 0)

    expect(result.state.raid.phase).toBe('HUB')
    expect(result.state.raid.extracting).toBeNull()
    expect(result.state.raid.activeRaidActivity).toBeNull()
    expect(result.state.raid.backpack).toEqual([])
    expect(result.state.homeStash).toEqual([
      {
        itemId: 'scrap_metal_basic',
        name: 'Basic Scrap Metal',
        value: 8,
        rarity: 1,
        quantity: 2,
      },
    ])
    expect(result.events.map(event => event.id)).toContain('phase_RAIDING_to_HUB')
    expect(result.activityEvents.map(event => event.activityId)).not.toContain('extraction_complication_close_call')
  })

  it('does not tag failed extraction activity entries as still extracting', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        phaseTicksRemaining: 30,
        extracting: { ticksRemaining: 3 },
      },
    }
    const failExtractionRng = {
      next: vi.fn<() => number>().mockReturnValue(0.99),
      weightedPick: <T extends { id?: string }>(items: readonly T[]) => items.find(item => item.id === 'extract_beacon_jammed') ?? items[0],
      pick: <T,>(items: readonly T[]) => items[0],
      int: (_min: number, max: number) => max,
      clone: () => failExtractionRng as unknown as RNG,
      getSeed: () => 0,
    } as unknown as RNG

    const result = processTick(state, failExtractionRng, 0)
    const failedExtraction = result.activityEvents.find(event => event.activityId === 'current_extraction' && event.status === 'failed')

    expect(result.state.raid.extracting).toBeNull()
    expect(failedExtraction).toBeDefined()
    expect(failedExtraction?.conditions).toBeUndefined()
  })

  it('uses distinct activity log ids for lifecycle extraction and extraction hazard activities', () => {
    const rng = createRNG(FIXED_SEED)
    const initial = createInitialState(0)
    const hazard = startRaidActivity(
      {
        ...initial,
        raid: {
          ...initial.raid,
          phase: 'RAIDING' as const,
          extracting: { ticksRemaining: 2 },
        },
      },
      { activityId: 'extraction_hazard_damage', kind: 'EXTRACTION', hazardDamage: 10 },
      rng,
      0,
    )
    expect(hazard).not.toBeNull()

    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        extracting: { ticksRemaining: 1 },
      },
    }

    const result = processTick(state, rng, 0)
    const extractionEventIds = [
      hazard!.activityEvent.id,
      ...result.activityEvents
        .filter(event => event.activity === 'EXTRACTION' && event.status === 'completed')
        .map(event => event.id),
    ]

    expect(extractionEventIds).toContain('activity_extraction_current_extraction_completed')
    expect(extractionEventIds).toContain('activity_extraction_extraction_hazard_damage_completed')
    expect(new Set(extractionEventIds).size).toBe(extractionEventIds.length)
  })

  it('includes both log conditions while extraction and DOWNED overlap', () => {
    const rng = createRNG(FIXED_SEED)
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raider: { ...initial.raider, hp: 0 },
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        phaseTicksRemaining: 30,
        extracting: { ticksRemaining: 2 },
        downed: { ticksRemaining: 2 },
      },
    }

    const result = processTick(state, rng, 0)
    const conditionEvent = result.events.find(event => event.phase === 'RAIDING' && event.conditions !== undefined)

    expect(result.state.raid.phase).toBe('RAIDING')
    expect(result.state.raid.extracting).not.toBeNull()
    expect(result.state.raid.downed).not.toBeNull()
    expect(conditionEvent?.conditions).toEqual(['EXTRACTING', 'DOWNED'])
  })

  it('includes EXTRACTING on the DOWNED-start log line when downed starts during extraction', () => {
    const rng = createRNG(FIXED_SEED)
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raider: { ...initial.raider, hp: 0 },
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        phaseTicksRemaining: 30,
        extracting: { ticksRemaining: 2 },
      },
    }

    const result = processTick(state, rng, 0)
    const downedEvent = result.events.find(event => event.id === 'condition_downed_started')

    expect(result.state.raid.phase).toBe('RAIDING')
    expect(result.state.raid.extracting).not.toBeNull()
    expect(result.state.raid.downed).not.toBeNull()
    expect(downedEvent?.conditions).toEqual(['EXTRACTING', 'DOWNED'])
  })

  it('keeps HP at 0 while the raider remains DOWNED', () => {
    const rng = createRNG(FIXED_SEED)
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raider: { ...initial.raider, hp: 42 },
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        phaseTicksRemaining: 30,
        downed: { ticksRemaining: 2 },
      },
    }

    const result = processTick(state, rng, 0)

    expect(result.state.raid.phase).toBe('RAIDING')
    expect(result.state.raid.downed?.ticksRemaining).toBe(1)
    expect(result.state.raider.hp).toBe(0)
    expect(result.activityEvents.find(event => event.activityId === 'downed_recovery' && event.status === 'progress')?.text).toBe('Downed thread: 1 tick left for a miracle or medically questionable idea.')
  })

  it('uses JSON-backed DOWNED failure activity text when the downed timer expires', () => {
    const rng = createRNG(FIXED_SEED)
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raider: { ...initial.raider, hp: 0 },
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        phaseTicksRemaining: 30,
        downed: { ticksRemaining: 1 },
      },
    }

    const result = processTick(state, rng, 0)

    expect(result.state.raid.phase).toBe('KNOCKED_OUT')
    expect(result.activityEvents.find(event => event.activityId === 'downed_recovery' && event.status === 'failed')?.text).toBe('Downed thread failed. Recovery team is preparing the apology clipboard.')
  })

  it('only tags active DOWNED activity statuses with the DOWNED condition', () => {
    expect(downedActivityEvent('started', 0, 0, 2).conditions).toEqual(['DOWNED'])
    expect(downedActivityEvent('progress', 0, 0, 1).conditions).toEqual(['DOWNED'])
    expect(downedActivityEvent('completed', 0, 0).conditions).toBeUndefined()
    expect(downedActivityEvent('failed', 0, 0).conditions).toBeUndefined()
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
        phase: 'RAIDING' as const,
        phaseTicksRemaining: 30,
        extracting: { ticksRemaining: 1 },
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
        phase: 'RAIDING' as const,
        phaseTicksRemaining: 30,
        extracting: { ticksRemaining: 1 },
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

  it('advances shield recharge as ambient state without activity-log entries', () => {
    const rng = createRNG(FIXED_SEED)
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        phaseTicksRemaining: 30,
        shield: {
          ...initial.raid.shield!,
          charge: 10,
          durability: 80,
        },
        activeShieldRecharge: {
          itemId: 'fizz_cell',
          name: 'Fizz Cell',
          totalCharge: 30,
          chargeRemaining: 30,
          totalTicks: 2,
          ticksRemaining: 2,
        },
        activeRaidActivity: {
          id: 'shield_recharge_fizz_cell',
          kind: 'SHIELD_RECHARGE' as const,
          ticksRemaining: 2,
          totalTicks: 2,
        },
      },
    }

    const progress = processTick(state, rng, 0)

    expect(progress.state.raid.activeShieldRecharge).not.toBeNull()
  expect(progress.state.raid.activeRaidActivity?.kind).not.toBe('SHIELD_RECHARGE')
    expect(progress.activityEvents.some(event => event.activity === 'SHIELD_RECHARGE')).toBe(false)

    const completed = processTick({
      ...progress.state,
      raid: {
        ...progress.state.raid,
        activeRaidActivity: null,
      },
    }, rng, 5000)

    expect(completed.state.raid.activeShieldRecharge).toBeNull()
    expect(completed.activityEvents.some(event => event.activity === 'SHIELD_RECHARGE')).toBe(false)
    expect(completed.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'shield_recharger_fizz_cell_completed',
      }),
    ]))
    expect(completed.state.activityLog.some(event => event.activity === 'SHIELD_RECHARGE')).toBe(false)
  })

  it('advances active robot encounter activities through processTick', () => {
    const rng = createRNG(FIXED_SEED)
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        phaseTicksRemaining: 30,
        dangerLevel: 'Low' as const,
        activeRaidActivity: {
          id: 'robot_encounter_standard',
          kind: 'ROBOT_ENCOUNTER' as const,
          ticksRemaining: 6,
          totalTicks: 6,
          robotId: 'anxietick',
          robotHp: 1,
          robotMaxHp: 12,
          weaponId: 'tea_kettle',
          weaponName: 'Tea Kettle',
          raiderDamageMin: 3,
          raiderDamageMax: 6,
          raiderAction: 'fighting' as const,
        },
      },
    }

    const result = processTick(state, rng, 0)

    expect(result.state.raid.activeRaidActivity).toBeNull()
    expect(result.state.stats.robotDefeats.anxietick).toBe(1)
    expect(result.activityEvents).toEqual([
      expect.objectContaining({
        activityId: 'robot_encounter_standard_anxietick',
        activity: 'ROBOT_ENCOUNTER',
        status: 'completed',
      }),
    ])
    expect(result.state.activityLog.at(-1)).toMatchObject({
      id: 'activity_robot_encounter_robot_encounter_standard_anxietick_completed',
      activityId: 'robot_encounter_standard_anxietick',
    })
  })

  it('advances non-blocking search activities while still allowing diary events', () => {
    const rng = createRNG(FIXED_SEED)
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        phaseTicksRemaining: 30,
        dangerLevel: 'Low' as const,
        activeRaidActivity: {
          id: 'search_black_box_cache',
          kind: 'SEARCH' as const,
          ticksRemaining: 2,
          totalTicks: 3,
          lootTableId: 'scrap_components',
          raiderAction: 'searching' as const,
        },
      },
    }

    const result = processTick(state, rng, 0)

    expect(result.activityEvents).toEqual([
      expect.objectContaining({
        activityId: 'search_black_box_cache',
        activity: 'SEARCH',
        status: 'progress',
      }),
    ])
    expect(result.events.length).toBeGreaterThan(0)
    expect(result.state.raid.activeRaidActivity).toMatchObject({
      id: 'search_black_box_cache',
      ticksRemaining: 1,
    })
  })
})
