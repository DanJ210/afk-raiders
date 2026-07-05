import { describe, expect, it, vi } from 'vitest'
import { advanceRaidActivity, DEFAULT_RAIDER_WEAPON, raidActivities, startRaidActivity } from '../../src/engine/raidActivities'
import { createInitialState } from '../../src/engine/initialState'
import { xpRequiredForLevel } from '../../src/engine/raiderLevel'
import { createRNG } from '../../src/engine/rng'
import type { RNG } from '../../src/engine/rng'
import { findWeapon } from '../../src/engine/weapons'

function fixedRng(): RNG {
  return {
    next: vi.fn<() => number>().mockReturnValue(0.5),
    weightedPick: <T,>(items: readonly T[]) => items[0],
    pick: <T,>(items: readonly T[]) => items[0],
    int: vi.fn<(min: number, max: number) => number>().mockImplementation((_min, max) => max),
    clone: () => fixedRng(),
    getSeed: () => 0,
  } as unknown as RNG
}

function fixedRngPickLast(): RNG {
  return {
    next: vi.fn<() => number>().mockReturnValue(0.5),
    weightedPick: <T,>(items: readonly T[]) => items[items.length - 1],
    pick: <T,>(items: readonly T[]) => items[items.length - 1],
    int: vi.fn<(min: number, max: number) => number>().mockImplementation((_min, max) => max),
    clone: () => fixedRngPickLast(),
    getSeed: () => 0,
  } as unknown as RNG
}

function bonusHealingRng(): RNG {
  return {
    next: vi.fn<() => number>().mockReturnValue(0.01),
    weightedPick: <T,>(items: readonly T[]) => items[0],
    pick: <T,>(items: readonly T[]) => items[0],
    int: vi.fn<(min: number, max: number) => number>().mockImplementation((_min, max) => max),
    clone: () => bonusHealingRng(),
    getSeed: () => 0,
  } as unknown as RNG
}

function createActiveRobotState(params: {
  robotId: string
  dangerLevel?: 'Low' | 'Medium' | 'High'
  hp?: number
  maxHp?: number
  mood?: number
  levelXp?: number
  shielded?: boolean
  robotDamageMultiplier?: number
  ticksRemaining?: number
  robotHp?: number
  raiderDamage?: number
}): ReturnType<typeof createInitialState> {
  const initial = createInitialState(0)
  const raiderBaseDamage = params.raiderDamage !== undefined
    ? Math.max(0, params.raiderDamage)
    : undefined
  return {
    ...initial,
    raider: {
      ...initial.raider,
      hp: params.hp ?? initial.raider.hp,
      maxHp: params.maxHp ?? initial.raider.maxHp,
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
        raiderBaseDamage,
        raiderDamageMultiplier: 1,
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
      raiderDamageMultiplier: DEFAULT_RAIDER_WEAPON.damageMultiplier,
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

  it('uses the equipped weapon when a valid override is present', () => {
    const initial = createInitialState(0)
    const equipped = findWeapon('temptrest_ar')
    expect(equipped).not.toBeNull()

    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        dangerLevel: 'Low' as const,
        equippedWeaponId: equipped!.id,
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
      weaponId: equipped!.id,
      weaponName: equipped!.name,
      raiderDamageMultiplier: equipped!.damageMultiplier,
    })
  })

  it('falls back to the default weapon if equipped weapon id is missing/invalid', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        dangerLevel: 'Low' as const,
        equippedWeaponId: 'not_a_real_weapon',
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
      weaponId: DEFAULT_RAIDER_WEAPON.id,
      weaponName: DEFAULT_RAIDER_WEAPON.name,
      raiderDamageMultiplier: DEFAULT_RAIDER_WEAPON.damageMultiplier,
    })
  })

  it('keeps weapon id and name consistent when the activity definition omits an override', () => {
    const initial = createInitialState(0)
    const definition = raidActivities.find(activity => activity.id === 'robot_encounter_standard')
    expect(definition).toBeDefined()

    const originalWeaponId = definition!.weaponId
    const originalWeaponName = definition!.weaponName
    definition!.weaponId = undefined
    definition!.weaponName = undefined

    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        dangerLevel: 'Low' as const,
        equippedWeaponId: 'aspperigo',
      },
    }

    try {
      const result = startRaidActivity(
        state,
        { activityId: 'robot_encounter_standard', kind: 'ROBOT_ENCOUNTER', robotId: 'anxietick' },
        fixedRng(),
        0,
      )

      expect(result).not.toBeNull()
      expect(result!.state.raid.activeRaidActivity).toMatchObject({
        weaponId: 'aspperigo',
        weaponName: 'Aspperigo',
        raiderDamageMultiplier: expect.any(Number),
      })
    } finally {
      definition!.weaponId = originalWeaponId
      definition!.weaponName = originalWeaponName
    }
  })

  it('ignores standalone weaponName override and keeps the resolved weapon pair consistent', () => {
    const initial = createInitialState(0)
    const equipped = findWeapon('temptrest_ar')
    expect(equipped).not.toBeNull()
    const definition = raidActivities.find(activity => activity.id === 'robot_encounter_standard')
    expect(definition).toBeDefined()

    const originalWeaponId = definition!.weaponId
    const originalWeaponName = definition!.weaponName
    definition!.weaponId = undefined
    definition!.weaponName = 'Pretend Hammer'

    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        dangerLevel: 'Low' as const,
        equippedWeaponId: equipped!.id,
      },
    }

    try {
      const result = startRaidActivity(
        state,
        { activityId: 'robot_encounter_standard', kind: 'ROBOT_ENCOUNTER', robotId: 'anxietick' },
        fixedRng(),
        0,
      )

      expect(result).not.toBeNull()
      expect(result!.state.raid.activeRaidActivity).toMatchObject({
        weaponId: equipped!.id,
        weaponName: equipped!.name,
      })
    } finally {
      definition!.weaponId = originalWeaponId
      definition!.weaponName = originalWeaponName
    }
  })

  it('scales robot max hp by danger level', () => {
    const initial = createInitialState(0)
    const low = startRaidActivity(
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
    const high = startRaidActivity(
      {
        ...initial,
        raid: {
          ...initial.raid,
          phase: 'RAIDING' as const,
          dangerLevel: 'High' as const,
        },
      },
      { activityId: 'robot_encounter_standard', kind: 'ROBOT_ENCOUNTER', robotId: 'anxietick' },
      fixedRng(),
      0,
    )

    expect(low).not.toBeNull()
    expect(high).not.toBeNull()
    expect((high!.state.raid.activeRaidActivity?.robotMaxHp ?? 0)).toBeGreaterThan(low!.state.raid.activeRaidActivity?.robotMaxHp ?? 0)
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

  it('rolls per-round raider weapon damage between damageMin and damageMax', () => {
    const state = createActiveRobotState({
      robotId: 'anxietick',
      robotHp: 20,
      ticksRemaining: 2,
    })

    const rolledRng = fixedRng()
    const result = advanceRaidActivity(state, rolledRng, 0)
    const intMock = rolledRng.int as unknown as { mock: { calls: unknown[][] } }

    expect(result.state.raid.activeRaidActivity?.robotHp).toBe(14)
    expect(intMock.mock.calls.length).toBeGreaterThan(0)
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

  it('excludes boss robots from generic pools unless includeBosses is true', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        dangerLevel: 'High' as const,
        zone: 'arc_ruins',
        greedLevel: 45,
      },
    }

    const withoutBosses = startRaidActivity(
      state,
      {
        activityId: 'robot_encounter_standard',
        kind: 'ROBOT_ENCOUNTER',
        robotPool: {
          dangerLevel: 'High',
          zone: 'arc_ruins',
          deadliness: ['deadly'],
          minGreed: 40,
        },
      },
      fixedRngPickLast(),
      0,
    )

    expect(withoutBosses).not.toBeNull()
    expect(withoutBosses!.state.raid.activeRaidActivity?.robotId).not.toBe('drama_queen')

    const withBosses = startRaidActivity(
      state,
      {
        activityId: 'robot_encounter_standard',
        kind: 'ROBOT_ENCOUNTER',
        robotPool: {
          dangerLevel: 'High',
          zone: 'arc_ruins',
          deadliness: ['deadly'],
          minGreed: 40,
          includeBosses: true,
        },
      },
      fixedRngPickLast(),
      0,
    )

    expect(withBosses).not.toBeNull()
    expect(withBosses!.state.raid.activeRaidActivity?.robotId).toBe('drama_queen')
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

  it('merges multiple loot tables when lootTableId is an array', () => {
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
      { activityId: 'search_black_box_cache', kind: 'SEARCH', lootTableId: ['water_bottles', 'valuables'] },
      fixedRng(),
      0,
    )

    expect(started).not.toBeNull()
    expect(started!.state.raid.activeRaidActivity?.lootTableId).toEqual(['water_bottles', 'valuables'])

    // fixedRngPickLast picks the final item of the merged pool, which comes from the second table.
    let currentState = started!.state
    let result = advanceRaidActivity(currentState, fixedRngPickLast(), 30_000)
    while (result.state.raid.activeRaidActivity) {
      currentState = result.state
      result = advanceRaidActivity(currentState, fixedRngPickLast(), 60_000)
    }

    expect(result.state.raid.backpack.length).toBeGreaterThan(0)
    expect(result.state.raid.backpack[0].itemId.startsWith('water_bottle')).toBe(false)
  })

  it('applies greed rarity bias to search loot rolls', () => {
    function averageSearchLootRarity(greedLevel: number): number {
      const initial = createInitialState(0)
      let raritySum = 0
      let itemCount = 0

      for (let seed = 0; seed < 400; seed += 1) {
        const rng = createRNG(seed)
        const started = startRaidActivity(
          {
            ...initial,
            raid: {
              ...initial.raid,
              phase: 'RAIDING' as const,
              dangerLevel: null,
              greedLevel,
            },
          },
          { activityId: 'search_black_box_cache', kind: 'SEARCH', lootTableId: 'valuables' },
          rng,
          0,
        )
        let result = advanceRaidActivity(started!.state, rng, 0)
        while (result.state.raid.activeRaidActivity) {
          result = advanceRaidActivity(result.state, rng, 0)
        }
        for (const item of result.state.raid.backpack) {
          raritySum += item.rarity * item.quantity
          itemCount += item.quantity
        }
      }

      expect(itemCount).toBeGreaterThan(0)
      return raritySum / itemCount
    }

    expect(averageSearchLootRarity(100)).toBeGreaterThan(averageSearchLootRarity(0))
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
        quantity: 3,
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

  it('can find a bonus healing item when any search completes', () => {
    const initial = createInitialState(0)
    const rng = bonusHealingRng()
    const started = startRaidActivity(
      {
        ...initial,
        raid: {
          ...initial.raid,
          phase: 'RAIDING' as const,
        },
      },
      { activityId: 'search_black_box_cache', kind: 'SEARCH', lootTableId: 'scrap_components' },
      rng,
      0,
    )

    expect(started).not.toBeNull()

    const progress = advanceRaidActivity(started!.state, rng, 30_000)
    const secondProgress = advanceRaidActivity(progress.state, rng, 60_000)
    const completed = advanceRaidActivity(secondProgress.state, rng, 90_000)

    expect(completed.state.raid.backpack).toEqual([
      expect.objectContaining({
        itemId: 'scrap_metal_basic',
        quantity: 3,
      }),
    ])
    expect(completed.state.raid.healingItems).toEqual([
      expect.objectContaining({
        itemId: 'bandage_white',
        name: 'White Bandage',
        quantity: 1,
      }),
    ])
    expect(completed.activityEvents[0].text).toContain('Bonus med find: tucked White Bandage')
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

  it('advances robot HP by deterministic modifier-based damage and completes with robot loot', () => {
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

    const secondProgress = advanceRaidActivity(progress.state, fixedRng(), 60_000)
    const completed = secondProgress

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

  it('increases outgoing raider damage with higher Raider Level', () => {
    const lowLevel = advanceRaidActivity(createActiveRobotState({ robotId: 'anxietick', robotHp: 20, shielded: false }), fixedRng(), 0)
    const maxLevel = advanceRaidActivity(createActiveRobotState({ robotId: 'anxietick', robotHp: 20, levelXp: xpRequiredForLevel(75), shielded: false }), fixedRng(), 0)

    const lowLevelRobotHp = lowLevel.state.raid.activeRaidActivity?.robotHp ?? Number.POSITIVE_INFINITY
    const maxLevelRobotHp = maxLevel.state.raid.activeRaidActivity?.robotHp ?? Number.POSITIVE_INFINITY
    expect(maxLevelRobotHp).toBeLessThan(lowLevelRobotHp)
  })

  it('applies mood resilience to robot activity retaliation', () => {
    const neutral = advanceRaidActivity(createActiveRobotState({ robotId: 'roomba_prime', shielded: false, robotDamageMultiplier: 10 }), fixedRng(), 0)
    const upbeat = advanceRaidActivity(createActiveRobotState({ robotId: 'roomba_prime', mood: 5, shielded: false, robotDamageMultiplier: 10 }), fixedRng(), 0)

    expect(upbeat.state.raider.hp).toBeGreaterThan(neutral.state.raider.hp)
    expect(upbeat.activityEvents[0].text).toContain('Resilience mitigated')
  })

  it('adds Raider Level title-band resilience to mood resilience', () => {
    const lowLevel = advanceRaidActivity(createActiveRobotState({ robotId: 'tank_overcompensation', dangerLevel: 'High', mood: 5, shielded: false, robotDamageMultiplier: 5 }), fixedRng(), 0)
    const maxLevel = advanceRaidActivity(createActiveRobotState({ robotId: 'tank_overcompensation', dangerLevel: 'High', mood: 5, levelXp: xpRequiredForLevel(75), shielded: false, robotDamageMultiplier: 5 }), fixedRng(), 0)

    expect(maxLevel.state.raider.hp).toBeGreaterThanOrEqual(lowLevel.state.raider.hp)
    expect(maxLevel.activityEvents[0].text).toContain('Resilience mitigated')
  })

  it('lets fractional resilience carry make nearby percentages diverge over repeated hits', () => {
    function applyRepeatedRetaliation(levelXp: number): number {
      let currentState = createActiveRobotState({
        robotId: 'anxietick',
        mood: 0,
        levelXp,
        shielded: false,
        hp: 1_000_000,
        maxHp: 1_000_000,
        robotHp: 1_000_000,
        ticksRemaining: 1_000,
      })

      for (let index = 0; index < 500; index += 1) {
        const result = advanceRaidActivity(currentState, fixedRng(), index)
        currentState = result.state
        if (!currentState.raid.activeRaidActivity) break
      }

      return currentState.raider.hp
    }

    const lowerResilienceHp = applyRepeatedRetaliation(xpRequiredForLevel(63))
    const higherResilienceHp = applyRepeatedRetaliation(xpRequiredForLevel(64))

    expect(higherResilienceHp).toBeGreaterThan(lowerResilienceHp)
  })

  it('scales robot activity retaliation by danger level', () => {
    const medium = advanceRaidActivity(createActiveRobotState({ robotId: 'tank_overcompensation', dangerLevel: 'Medium', shielded: false }), fixedRng(), 0)
    const high = advanceRaidActivity(createActiveRobotState({ robotId: 'tank_overcompensation', dangerLevel: 'High', shielded: false }), fixedRng(), 0)

    expect(high.state.raider.hp).toBeLessThan(medium.state.raider.hp)
  })

  it('keeps medium danger robot retaliation damage variable across seeded rolls', () => {
    const baseState = createActiveRobotState({
      robotId: 'tank_overcompensation',
      dangerLevel: 'Medium',
      shielded: false,
      robotHp: 999,
      raiderDamage: 0,
    })

    const damages = Array.from({ length: 8 }, (_, index) => {
      const result = advanceRaidActivity(baseState, createRNG(100 + index), index)
      return baseState.raider.hp - result.state.raider.hp
    })

    expect(new Set(damages).size).toBeGreaterThan(1)
  })

  it('keeps low danger retaliation tighter than high danger across seeded rolls', () => {
    function damageRangeForDanger(dangerLevel: 'Low' | 'High'): number {
      const baseState = createActiveRobotState({
        robotId: 'tank_overcompensation',
        dangerLevel,
        shielded: false,
        robotHp: 999,
        raiderDamage: 0,
      })

      const damages = Array.from({ length: 20 }, (_, index) => {
        const result = advanceRaidActivity(baseState, createRNG(200 + index), index)
        return baseState.raider.hp - result.state.raider.hp
      })

      return Math.max(...damages) - Math.min(...damages)
    }

    const lowRange = damageRangeForDanger('Low')
    const highRange = damageRangeForDanger('High')

    expect(highRange).toBeGreaterThan(lowRange)
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