import { describe, expect, it, vi } from 'vitest'
import { advanceRaidActivity, DEFAULT_RAIDER_WEAPON, startRaidActivity } from '../../src/engine/raidActivities'
import { createInitialState } from '../../src/engine/initialState'
import { xpRequiredForLevel } from '../../src/engine/raiderLevel'
import type { RNG } from '../../src/engine/rng'

function fixedRng(): RNG {
  return {
    next: vi.fn<() => number>().mockReturnValue(0.5),
    weightedPick: <T,>(items: readonly T[]) => items[0],
    pick: <T,>(items: readonly T[]) => items[0],
    int: vi.fn<(min: number, max: number) => number>().mockImplementation((_min, max) => max),
    clone: () => fixedRng(),
    getSeed: () => 0,
  }
}

function createActiveRobotState(params: {
  robotId: string
  dangerLevel?: 'Low' | 'Medium' | 'High'
  hp?: number
  mood?: number
  levelXp?: number
  shielded?: boolean
  robotDamageMultiplier?: number
  ticksRemaining?: number
  robotHp?: number
  raiderDamage?: number
}): ReturnType<typeof createInitialState> {
  const initial = createInitialState(0)
  return {
    ...initial,
    raider: {
      ...initial.raider,
      hp: params.hp ?? initial.raider.hp,
      mood: params.mood ?? initial.raider.mood,
      levelXp: params.levelXp ?? initial.raider.levelXp,
    },
    raid: {
      ...initial.raid,
      phase: 'RAIDING' as const,
      dangerLevel: params.dangerLevel ?? 'Low',
      shield: params.shielded === false ? null : initial.raid.shield,
      activeRaidActivity: {
        id: 'robot_encounter_standard',
        kind: 'ROBOT_ENCOUNTER' as const,
        ticksRemaining: params.ticksRemaining ?? 1,
        totalTicks: params.ticksRemaining ?? 1,
        robotId: params.robotId,
        robotHp: params.robotHp ?? 999,
        robotMaxHp: params.robotHp ?? 999,
        weaponId: DEFAULT_RAIDER_WEAPON.id,
        weaponName: DEFAULT_RAIDER_WEAPON.name,
        raiderDamageMin: params.raiderDamage ?? 0,
        raiderDamageMax: params.raiderDamage ?? 0,
        robotDamageMultiplier: params.robotDamageMultiplier,
        raiderAction: 'fighting' as const,
      },
    },
  }
}

describe('raid activities', () => {
  it('starts a JSON-backed robot encounter with Tea Kettle as the default weapon', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        dangerLevel: 'Low' as const,
      },
    }

    const result = startRaidActivity(
      state,
      { activityId: 'robot_encounter_standard', kind: 'ROBOT_ENCOUNTER', robotId: 'anxietick' },
      fixedRng(),
      0,
    )

    expect(result).not.toBeNull()
    expect(result!.state.raid.activeRaidActivity).toMatchObject({
      id: 'robot_encounter_standard',
      name: 'Robot Encounter: Anxietick',
      kind: 'ROBOT_ENCOUNTER',
      robotId: 'anxietick',
      robotHp: 12,
      robotMaxHp: 12,
      weaponId: DEFAULT_RAIDER_WEAPON.id,
      weaponName: DEFAULT_RAIDER_WEAPON.name,
      raiderDamageMin: DEFAULT_RAIDER_WEAPON.damageMin,
      raiderDamageMax: DEFAULT_RAIDER_WEAPON.damageMax,
    })
    expect(result!.activityEvent).toMatchObject({
      id: 'activity_robot_encounter_robot_encounter_standard_anxietick_started',
      activityId: 'robot_encounter_standard_anxietick',
      activityName: 'Robot Encounter: Anxietick',
      activity: 'ROBOT_ENCOUNTER',
      status: 'started',
    })
    expect(result!.activityEvent.text).toContain('Tea Kettle')
  })

  it('selects a robot from the event robot pool when no fixed robotId is provided', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        dangerLevel: 'Medium' as const,
        zone: 'arc_ruins',
        greedLevel: 20,
      },
    }

    const result = startRaidActivity(
      state,
      {
        activityId: 'robot_encounter_standard',
        kind: 'ROBOT_ENCOUNTER',
        robotPool: {
          dangerLevel: 'Medium',
          zone: 'arc_ruins',
          deadliness: ['dangerous'],
          minGreed: 20,
        },
      },
      fixedRng(),
      0,
    )

    expect(result).not.toBeNull()
    expect(result!.state.raid.activeRaidActivity).toMatchObject({
      kind: 'ROBOT_ENCOUNTER',
      robotId: 'walker_texas_malfunction',
    })
    expect(result!.activityEvent.activityId).toBe('robot_encounter_standard_walker_texas_malfunction')
  })

  it('blocks robot pool selection when zone or danger gates do not match', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        dangerLevel: 'Low' as const,
        zone: 'forgotten_fields',
        greedLevel: 20,
      },
    }

    const result = startRaidActivity(
      state,
      {
        activityId: 'robot_encounter_standard',
        kind: 'ROBOT_ENCOUNTER',
        robotPool: {
          dangerLevel: 'Medium',
          zone: 'arc_ruins',
          deadliness: ['dangerous'],
          minGreed: 20,
        },
      },
      fixedRng(),
      0,
    )

    expect(result).toBeNull()
  })

  it('starts a JSON-backed search activity', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
      },
    }

    const result = startRaidActivity(
      state,
      { activityId: 'search_black_box_cache', kind: 'SEARCH', lootTableId: 'scrap_components' },
      fixedRng(),
      0,
    )

    expect(result).not.toBeNull()
    expect(result!.state.raid.activeRaidActivity).toMatchObject({
      id: 'search_black_box_cache',
      name: 'Black-Box Cache Search',
      kind: 'SEARCH',
      ticksRemaining: 3,
      lootTableId: 'scrap_components',
      raiderAction: 'searching',
    })
    expect(result!.activityEvent).toMatchObject({
      id: 'activity_search_search_black_box_cache_started',
      activityId: 'search_black_box_cache',
      activity: 'SEARCH',
      status: 'started',
    })
  })

  it('completes medical search with a current-raid healing item', () => {
    const initial = createInitialState(0)
    const started = startRaidActivity(
      {
        ...initial,
        raid: {
          ...initial.raid,
          phase: 'RAIDING' as const,
          zone: 'damp_battlegrounds',
          dangerLevel: 'Low' as const,
        },
      },
      { activityId: 'search_medical_pouch', kind: 'SEARCH', healingItem: true },
      fixedRng(),
      0,
    )

    expect(started).not.toBeNull()

    const progress = advanceRaidActivity(started!.state, fixedRng(), 30_000)
    const completed = advanceRaidActivity(progress.state, fixedRng(), 60_000)

    expect(completed.blocking).toBe(false)
    expect(completed.state.raid.activeRaidActivity).toBeNull()
    expect(completed.state.raid.backpack).toEqual([])
    expect(completed.state.raid.healingItems).toEqual([
      expect.objectContaining({
        itemId: 'bandage_white',
        name: 'White Bandage',
        quantity: 1,
      }),
    ])
    expect(completed.activityEvents).toEqual([
      expect.objectContaining({
        activityId: 'search_medical_pouch',
        activity: 'SEARCH',
        status: 'completed',
      }),
    ])
    expect(completed.activityEvents[0].text).toContain('White Bandage')
  })

  it('completes shield recharger search with backpack shield loot', () => {
    const initial = createInitialState(0)
    const started = startRaidActivity(
      {
        ...initial,
        raid: {
          ...initial.raid,
          phase: 'RAIDING' as const,
        },
      },
      { activityId: 'search_shield_recharger_crate', kind: 'SEARCH', shieldRecharger: true },
      fixedRng(),
      0,
    )

    expect(started).not.toBeNull()

    const progress = advanceRaidActivity(started!.state, fixedRng(), 30_000)
    const completed = advanceRaidActivity(progress.state, fixedRng(), 60_000)

    expect(completed.blocking).toBe(false)
    expect(completed.state.raid.activeRaidActivity).toBeNull()
    expect(completed.state.raid.healingItems).toEqual([])
    expect(completed.state.raid.backpack).toEqual([
      expect.objectContaining({
        itemId: 'fizz_cell',
        name: 'Fizz Cell',
        kind: 'shield_recharger',
        shieldChargeAmount: 20,
        quantity: 1,
      }),
    ])
    expect(completed.activityEvents).toEqual([
      expect.objectContaining({
        activityId: 'search_shield_recharger_crate',
        activity: 'SEARCH',
        status: 'completed',
      }),
    ])
    expect(completed.activityEvents[0].text).toContain('Fizz Cell')
  })

  it('completes water bottle search with backpack water loot', () => {
    const initial = createInitialState(0)
    const started = startRaidActivity(
      {
        ...initial,
        raid: {
          ...initial.raid,
          phase: 'RAIDING' as const,
          zone: 'damp_battlegrounds',
          dangerLevel: 'Low' as const,
        },
      },
      { activityId: 'search_water_bottle_stash', kind: 'SEARCH', lootTableId: 'water_bottles' },
      fixedRng(),
      0,
    )

    expect(started).not.toBeNull()

    const progress = advanceRaidActivity(started!.state, fixedRng(), 30_000)
    const completed = advanceRaidActivity(progress.state, fixedRng(), 60_000)

    expect(completed.blocking).toBe(false)
    expect(completed.state.raid.activeRaidActivity).toBeNull()
    expect(completed.state.raid.backpack).toEqual([
      expect.objectContaining({
        itemId: 'water_bottle_classic',
        name: 'Water Bottle (Classic)',
        quantity: 2,
      }),
    ])
    expect(completed.activityEvents).toEqual([
      expect.objectContaining({
        activityId: 'search_water_bottle_stash',
        activity: 'SEARCH',
        status: 'completed',
      }),
    ])
    expect(completed.activityEvents[0].text).toContain('Water Bottle (Classic)')
  })

  it('blocks activity definitions when zone gates do not match', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        zone: 'forgotten_fields',
        dangerLevel: 'Low' as const,
      },
    }

    const result = startRaidActivity(
      state,
      { activityId: 'search_water_bottle_stash', kind: 'SEARCH', lootTableId: 'water_bottles' },
      fixedRng(),
      0,
    )

    expect(result).toBeNull()
  })

  it('blocks activity definitions when danger gates do not match', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        zone: 'damp_battlegrounds',
        dangerLevel: 'High' as const,
      },
    }

    const result = startRaidActivity(
      state,
      { activityId: 'search_water_bottle_stash', kind: 'SEARCH', lootTableId: 'water_bottles' },
      fixedRng(),
      0,
    )

    expect(result).toBeNull()
  })

  it('resolves extraction hazard damage through the activity log', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        extracting: { ticksRemaining: 3 },
      },
    }

    const result = startRaidActivity(
      state,
      { activityId: 'extraction_hazard_damage', kind: 'EXTRACTION', hazardDamage: 10 },
      fixedRng(),
      0,
    )

    expect(result).not.toBeNull()
    expect(result!.state.raider.hp).toBe(94)
    expect(result!.state.raid.shield?.charge).toBe(30)
    expect(result!.state.raid.activeRaidActivity).toBeNull()
    expect(result!.activityEvent).toMatchObject({
      id: 'activity_extraction_extraction_hazard_damage_completed',
      activityId: 'extraction_hazard_damage',
      activity: 'EXTRACTION',
      status: 'completed',
    })
    expect(result!.activityEvent.text).toContain('Shield lost 10 charge')
    expect(result!.activityEvent.text).toContain('6 HP damage landed')
  })

  it('advances search progress and completes with loot', () => {
    const initial = createInitialState(0)
    const started = startRaidActivity(
      {
        ...initial,
        raid: {
          ...initial.raid,
          phase: 'RAIDING' as const,
        },
      },
      { activityId: 'search_black_box_cache', kind: 'SEARCH', lootTableId: 'scrap_components' },
      fixedRng(),
      0,
    )

    expect(started).not.toBeNull()

    const progress = advanceRaidActivity(started!.state, fixedRng(), 30_000)

    expect(progress.blocking).toBe(false)
    expect(progress.state.raid.activeRaidActivity).toMatchObject({
      id: 'search_black_box_cache',
      ticksRemaining: 2,
    })
    expect(progress.activityEvents).toEqual([
      expect.objectContaining({
        activityId: 'search_black_box_cache',
        activity: 'SEARCH',
        status: 'progress',
      }),
    ])

    const secondProgress = advanceRaidActivity(progress.state, fixedRng(), 60_000)
    const completed = advanceRaidActivity(secondProgress.state, fixedRng(), 90_000)

    expect(completed.blocking).toBe(false)
    expect(completed.state.raid.activeRaidActivity).toBeNull()
    expect(completed.state.raid.backpack).toEqual([
      expect.objectContaining({
        itemId: 'scrap_metal_basic',
        name: 'Basic Scrap Metal',
        quantity: 2,
      }),
    ])
    expect(completed.activityEvents).toEqual([
      expect.objectContaining({
        activityId: 'search_black_box_cache',
        activity: 'SEARCH',
        status: 'completed',
      }),
    ])
  })

  it('completes newly mapped apparel searches with bundled loot', () => {
    const initial = createInitialState(0)
    const started = startRaidActivity(
      {
        ...initial,
        raid: {
          ...initial.raid,
          phase: 'RAIDING' as const,
        },
      },
      { activityId: 'search_apparel_duffel', kind: 'SEARCH' },
      fixedRng(),
      0,
    )

    expect(started).not.toBeNull()

    const progress = advanceRaidActivity(started!.state, fixedRng(), 30_000)
    const completed = advanceRaidActivity(progress.state, fixedRng(), 60_000)

    expect(completed.state.raid.activeRaidActivity).toBeNull()
    expect(completed.state.raid.backpack).toEqual([
      expect.objectContaining({
        itemId: 'left_boot',
        name: 'Left Boot',
        quantity: 2,
      }),
    ])
    expect(completed.activityEvents[0].text).toContain('2x Left Boot')
  })

  it('keeps robot encounters active past old tick counters while robot HP remains', () => {
    const result = advanceRaidActivity(createActiveRobotState({
      robotId: 'anxietick',
      robotHp: 50,
      raiderDamage: 1,
      ticksRemaining: 1,
    }), fixedRng(), 0)

    expect(result.state.raid.activeRaidActivity).toMatchObject({
      kind: 'ROBOT_ENCOUNTER',
      robotId: 'anxietick',
      robotHp: 49,
      ticksRemaining: 0,
    })
    expect(result.robotSurvivedId).toBeUndefined()
  })

  it('returns a robot downed reason when robot combat incapacitates the Raider', () => {
    const result = advanceRaidActivity(createActiveRobotState({
      robotId: 'roomba_prime',
      dangerLevel: 'High',
      hp: 40,
      shielded: false,
      robotDamageMultiplier: 50,
    }), fixedRng(), 0)

    expect(result.state.raider.hp).toBe(0)
    expect(result.state.raid.activeRaidActivity).toBeNull()
    expect(result.downedReason).toMatchObject({
      kind: 'robot',
      robotId: 'roomba_prime',
      robotName: 'Roomba Prime',
    })
    expect(result.downedReason?.text).toContain('Roomba Prime downed the Raider')
  })

  it('advances robot HP by Tea Kettle damage and completes with robot loot', () => {
    const initial = createInitialState(0)
    const started = startRaidActivity(
      {
        ...initial,
        raid: {
          ...initial.raid,
          phase: 'RAIDING' as const,
          dangerLevel: 'Low' as const,
        },
      },
      { activityId: 'robot_encounter_standard', kind: 'ROBOT_ENCOUNTER', robotId: 'anxietick' },
      fixedRng(),
      0,
    )

    expect(started).not.toBeNull()

    const progress = advanceRaidActivity(started!.state, fixedRng(), 30_000)

    expect(progress.blocking).toBe(true)
    expect(progress.state.raid.activeRaidActivity).toMatchObject({
      robotId: 'anxietick',
      robotHp: 6,
      robotMaxHp: 12,
    })
    expect(progress.activityEvents).toEqual([
      expect.objectContaining({
        activityId: 'robot_encounter_standard_anxietick',
        activity: 'ROBOT_ENCOUNTER',
        status: 'progress',
      }),
    ])
    expect(progress.activityEvents[0].text).toContain('Tea Kettle')

    const completed = advanceRaidActivity(progress.state, fixedRng(), 60_000)

    expect(completed.blocking).toBe(true)
    expect(completed.robotDefeatedId).toBe('anxietick')
    expect(completed.state.raid.activeRaidActivity).toBeNull()
    expect(completed.state.raid.backpack).toEqual([
      expect.objectContaining({
        itemId: 'anxietick_gear',
        name: 'Anxietick Gear',
        quantity: 1,
      }),
    ])
    expect(completed.activityEvents).toEqual([
      expect.objectContaining({
        activityId: 'robot_encounter_standard_anxietick',
        activity: 'ROBOT_ENCOUNTER',
        status: 'completed',
      }),
    ])
  })

  it('applies mood resilience to robot activity retaliation', () => {
    const neutral = advanceRaidActivity(createActiveRobotState({ robotId: 'roomba_prime', shielded: false }), fixedRng(), 0)
    const upbeat = advanceRaidActivity(createActiveRobotState({ robotId: 'roomba_prime', mood: 5, shielded: false }), fixedRng(), 0)

    expect(upbeat.state.raider.hp).toBeGreaterThan(neutral.state.raider.hp)
    expect(upbeat.activityEvents[0].text).toContain('Resilience mitigated')
  })

  it('adds Raider Level title-band resilience to mood resilience', () => {
    const lowLevel = advanceRaidActivity(createActiveRobotState({ robotId: 'tank_overcompensation', dangerLevel: 'High', mood: 5, shielded: false, robotDamageMultiplier: 5 }), fixedRng(), 0)
    const maxLevel = advanceRaidActivity(createActiveRobotState({ robotId: 'tank_overcompensation', dangerLevel: 'High', mood: 5, levelXp: xpRequiredForLevel(75), shielded: false, robotDamageMultiplier: 5 }), fixedRng(), 0)

    expect(maxLevel.state.raider.hp).toBeGreaterThan(lowLevel.state.raider.hp)
    expect(maxLevel.activityEvents[0].text).toContain('Resilience mitigated')
  })

  it('scales robot activity retaliation by danger level', () => {
    const medium = advanceRaidActivity(createActiveRobotState({ robotId: 'tank_overcompensation', dangerLevel: 'Medium', shielded: false }), fixedRng(), 0)
    const high = advanceRaidActivity(createActiveRobotState({ robotId: 'tank_overcompensation', dangerLevel: 'High', shielded: false }), fixedRng(), 0)

    expect(high.state.raider.hp).toBeLessThan(medium.state.raider.hp)
  })

  it('applies activity damage multipliers only while the robot survives the round', () => {
    const failed = advanceRaidActivity(createActiveRobotState({ robotId: 'tattletale', shielded: false, robotDamageMultiplier: 7 }), fixedRng(), 0)
    const defeated = advanceRaidActivity(createActiveRobotState({ robotId: 'anxietick', robotHp: 1, robotDamageMultiplier: 10, raiderDamage: 6 }), fixedRng(), 0)

    expect(failed.state.raider.hp).toBeLessThan(advanceRaidActivity(createActiveRobotState({ robotId: 'tattletale', shielded: false }), fixedRng(), 0).state.raider.hp)
    expect(defeated.robotDefeatedId).toBe('anxietick')
    expect(defeated.state.raider.hp).toBe(100)
  })

  it('preserves nonlethal floors for lower-tier robots while deadly robots can down wounded raiders', () => {
    const moderate = advanceRaidActivity(createActiveRobotState({ robotId: 'tattletale', dangerLevel: 'High', hp: 40, shielded: false, robotDamageMultiplier: 50 }), fixedRng(), 0)
    const deadly = advanceRaidActivity(createActiveRobotState({ robotId: 'roomba_prime', dangerLevel: 'High', hp: 40, shielded: false, robotDamageMultiplier: 50 }), fixedRng(), 0)

    expect(moderate.state.raider.hp).toBeGreaterThanOrEqual(1)
    expect(moderate.activityEvents[0].text).toContain('Nonlethal floor prevented')
    expect(deadly.state.raider.hp).toBe(0)
  })
})