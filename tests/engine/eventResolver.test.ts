/**
 * Focused unit tests for applyEffects in eventResolver.ts.
 *
 * Verifies that applying a loot effect:
 *   - adds a BackpackItem to the backpack with the correct fields
 *   - increments quantity when the same item is looted again
 *   - keeps backpackValue consistent with the sum of applied deltas
 *   - does not mutate the input state
 */

import { describe, it, expect } from 'vitest'
import { createRNG } from '../../src/engine/rng'
import { applyEffects, consumeHealingItem, consumeShieldRecharger, resolveHealingItemFind, resolveRobotEncounter, resolveShieldRechargerFind } from '../../src/engine/eventResolver'
import { createInitialState } from '../../src/engine/initialState'
import type { EventTemplate, HealingItemStack } from '../../src/engine/types'

// backpackValue=500 maps exclusively to golden_water_bottle,
// so item selection is fully deterministic — no RNG variance.
const LOOT_TEMPLATE: EventTemplate = {
  id: 'test_loot',
  weight: 1,
  text: 'You found something.',
  effects: { backpackValue: 500 },
}

const DAMAGE_TEMPLATE: EventTemplate = {
  id: 'test_damage',
  weight: 1,
  text: 'You found something sharp.',
  effects: { hp: '-5d10' },
}

const FIXED_DAMAGE_TEMPLATE: EventTemplate = {
  id: 'test_fixed_damage',
  weight: 1,
  text: 'You found something aggressively harmful.',
  effects: { hp: -20 },
}

function makeBandage(overrides: Partial<HealingItemStack> = {}): HealingItemStack {
  return {
    itemId: 'bandage_white',
    name: 'White Bandage',
    healAmount: 5,
    moodGain: 1,
    rarity: 1,
    quantity: 1,
    ...overrides,
  }
}

describe('applyEffects — backpack item behavior', () => {
  it('adds a new BackpackItem when a loot effect is applied', () => {
    const state = createInitialState(0)
    const rng = createRNG(42)

    const result = applyEffects(state, LOOT_TEMPLATE, rng)

    expect(result.raid.backpack).toHaveLength(1)
    const item = result.raid.backpack[0]
    expect(item.itemId).toBe('golden_water_bottle')
    expect(item.name).toBe('Golden Water Bottle')
    expect(item.value).toBe(500)
    expect(item.rarity).toBe(5)
    expect(item.quantity).toBe(1)
  })

  it('increments quantity when the same item is looted a second time', () => {
    const state = createInitialState(0)
    const rng = createRNG(42)

    const afterFirst = applyEffects(state, LOOT_TEMPLATE, rng)
    expect(afterFirst.raid.backpack).toHaveLength(1)
    expect(afterFirst.raid.backpack[0].quantity).toBe(1)

    const afterSecond = applyEffects(afterFirst, LOOT_TEMPLATE, rng)
    expect(afterSecond.raid.backpack).toHaveLength(1)
    expect(afterSecond.raid.backpack[0].itemId).toBe('golden_water_bottle')
    expect(afterSecond.raid.backpack[0].quantity).toBe(2)
  })

  it('keeps backpackValue equal to the cumulative sum of applied deltas', () => {
    const state = createInitialState(0)
    const rng = createRNG(42)

    const afterFirst = applyEffects(state, LOOT_TEMPLATE, rng)
    expect(afterFirst.raid.backpackValue).toBe(500)

    const afterSecond = applyEffects(afterFirst, LOOT_TEMPLATE, rng)
    expect(afterSecond.raid.backpackValue).toBe(1000)
  })

  it('does not mutate the input state', () => {
    const state = createInitialState(0)
    const rng = createRNG(42)

    applyEffects(state, LOOT_TEMPLATE, rng)

    expect(state.raid.backpack).toHaveLength(0)
    expect(state.raid.backpackValue).toBe(0)
  })

  it('applies deterministic dice-based HP damage within range', () => {
    const state = createInitialState(0)
    const result1 = applyEffects(state, DAMAGE_TEMPLATE, createRNG(42))
    const result2 = applyEffects(state, DAMAGE_TEMPLATE, createRNG(42))

    expect(result1.raider.hp).toBe(result2.raider.hp)
    expect(result1.raider.hp).toBeLessThanOrEqual(95)
    expect(result1.raider.hp).toBeGreaterThanOrEqual(86)
  })

  it('scales loot value by time-of-day profile', () => {
    const initial = createInitialState(0)
    const template: EventTemplate = {
      id: 'test_time_loot',
      weight: 1,
      text: 'You found something timely.',
      effects: { backpackValue: 100 },
    }

    const day = applyEffects(
      { ...initial, raid: { ...initial.raid, timeOfDay: 'Day' } },
      template,
      createRNG(1),
    )
    const night = applyEffects(
      { ...initial, raid: { ...initial.raid, timeOfDay: 'Night' } },
      template,
      createRNG(1),
    )
    const stellaRed = applyEffects(
      { ...initial, raid: { ...initial.raid, timeOfDay: 'Stella Red' } },
      template,
      createRNG(1),
    )

    expect(day.raid.backpackValue).toBe(85)
    expect(night.raid.backpackValue).toBe(120)
    expect(stellaRed.raid.backpackValue).toBe(155)
  })

  it('routes negative HP effects through shield mitigation', () => {
    const initial = createInitialState(0)
    const result = applyEffects(initial, FIXED_DAMAGE_TEMPLATE, createRNG(1))

    expect(result.raider.hp).toBe(88)
    expect(result.raid.shield?.charge).toBe(20)
    expect(result.raid.shield?.durability).toBe(90)
  })

  it('still mitigates a full hit when the shield only has 1 charge left', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        shield: {
          ...initial.raid.shield!,
          charge: 1,
          durability: 82.5,
        },
      },
    }

    const result = applyEffects(state, { ...FIXED_DAMAGE_TEMPLATE, effects: { hp: -35 } }, createRNG(1))

    expect(result.raider.hp).toBe(79)
    expect(result.raid.shield?.charge).toBe(0)
    expect(result.raid.shield?.durability).toBe(82)
  })

  it('defeats a robot when the combat roll beats menace and awards robot loot', () => {
    const state = createInitialState(0)
    const result = resolveRobotEncounter(state, 'anxietick', createRNG(1), 0)

    expect(result).not.toBeNull()
    expect(result!.event.id).toBe('robot_anxietick_defeated')
    expect(result!.event.text).toContain('Well that tick needed to chill')
    expect(result!.state.raid.backpack).toHaveLength(1)
    expect(['anxietick_gear', 'robot_alloy']).toContain(result!.state.raid.backpack[0].itemId)
    expect(result!.state.raider.hp).toBe(state.raider.hp)
  })

  it('damages the raider when the combat roll does not beat menace', () => {
    const state = createInitialState(0)
    const result = resolveRobotEncounter(state, 'roomba_prime', createRNG(1), 0)

    expect(result).not.toBeNull()
    expect(result!.event.id).toBe('robot_roomba_prime_escaped')
    expect(result!.event.text).toContain('Took 10 damage')
    expect(result!.state.raider.hp).toBe(90)
    expect(result!.state.raid.shield?.charge).toBe(24)
    expect(result!.state.raid.backpack).toHaveLength(0)
  })

  it('scales failed robot damage by time-of-day profile', () => {
    const initial = createInitialState(0)
    const night = resolveRobotEncounter(
      { ...initial, raid: { ...initial.raid, timeOfDay: 'Night' } },
      'roomba_prime',
      createRNG(1),
      0,
    )
    const stellaRed = resolveRobotEncounter(
      { ...initial, raid: { ...initial.raid, timeOfDay: 'Stella Red' } },
      'roomba_prime',
      createRNG(1),
      0,
    )

    expect(night).not.toBeNull()
    expect(stellaRed).not.toBeNull()
    expect(night!.state.raider.hp).toBe(76)
    expect(stellaRed!.state.raider.hp).toBe(68)
  })

  it('applies encounter-specific damage multipliers only on failed robot encounters', () => {
    const state = createInitialState(0)
    const failed = resolveRobotEncounter(state, 'tattletale', createRNG(7), 0, { damageMultiplier: 7 })
    const defeated = resolveRobotEncounter(state, 'anxietick', createRNG(1), 0, { damageMultiplier: 10 })

    expect(failed).not.toBeNull()
    expect(failed!.event.id).toBe('robot_tattletale_escaped')
    expect(failed!.event.text).toContain('Took 26 damage')
    expect(failed!.state.raider.hp).toBe(74)

    expect(defeated).not.toBeNull()
    expect(defeated!.event.id).toBe('robot_anxietick_defeated')
    expect(defeated!.state.raider.hp).toBe(100)
  })

  it('does not let a failed robot encounter down a full-health raider', () => {
    const state = createInitialState(0)
    const result = resolveRobotEncounter(state, 'roomba_prime', createRNG(1), 0, { damageMultiplier: 3 })

    expect(result).not.toBeNull()
    expect(result!.event.id).toBe('robot_roomba_prime_escaped')
    expect(result!.event.text).toContain('Took 29 damage')
    expect(result!.state.raider.hp).toBe(71)
  })

  it('only lets nasty and deadly robots down already-wounded raiders', () => {
    const initial = createInitialState(0)
    const wounded = {
      ...initial,
      raider: { ...initial.raider, hp: 40 },
    }
    const deadly = resolveRobotEncounter(wounded, 'roomba_prime', createRNG(1), 0, { damageMultiplier: 3 })
    const moderate = resolveRobotEncounter(wounded, 'tattletale', createRNG(7), 0, { damageMultiplier: 7 })

    expect(deadly).not.toBeNull()
    expect(deadly!.event.id).toBe('robot_roomba_prime_escaped')
    expect(deadly!.state.raider.hp).toBe(11)

    expect(moderate).not.toBeNull()
    expect(moderate!.event.id).toBe('robot_tattletale_escaped')
    expect(moderate!.state.raider.hp).toBe(14)
  })

  it('finds a current-raid healing item without adding stash loot', () => {
    const state = {
      ...createInitialState(0),
      raid: { ...createInitialState(0).raid, phase: 'RAIDING' as const },
    }

    const result = resolveHealingItemFind(state, createRNG(1), 0)

    expect(result.event.id).toMatch(/^healing_bandage_.*_found$/)
    expect(result.state.raid.healingItems).toHaveLength(1)
    expect(result.state.raid.backpack).toHaveLength(0)
    expect(result.state.homeStash).toHaveLength(0)
  })

  it('finds a shield recharger as backpack loot', () => {
    const state = {
      ...createInitialState(0),
      raid: { ...createInitialState(0).raid, phase: 'RAIDING' as const },
    }

    const result = resolveShieldRechargerFind(state, createRNG(1), 0)

    expect(result.event.id).toMatch(/^shield_recharger_.*_found$/)
    expect(result.state.raid.backpack).toHaveLength(1)
    expect(result.state.raid.backpack[0].kind).toBe('shield_recharger')
    expect(result.state.raid.backpack[0].shieldChargeAmount).toBeGreaterThan(0)
  })

  it('preserves shield recharger applyTicks when found', () => {
    const state = {
      ...createInitialState(0),
      raid: { ...createInitialState(0).raid, phase: 'RAIDING' as const },
    }
    const fakeRng = {
      weightedPick: () => ({
        id: 'instant_cell',
        weight: 1,
        rarity: 4,
        name: 'Instant Cell',
        value: 50,
        chargeAmount: 30,
        applyTicks: 0,
      }),
    } as unknown as Parameters<typeof resolveShieldRechargerFind>[1]

    const result = resolveShieldRechargerFind(state, fakeRng, 0)

    expect(result.state.raid.backpack).toHaveLength(1)
    expect(result.state.raid.backpack[0].applyTicks).toBe(0)
  })

  it('uses a backpack shield recharger to restore shield charge', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        shield: {
          ...initial.raid.shield!,
          charge: 5,
          durability: 80,
        },
        backpack: [
          {
            itemId: 'panic_capacitor',
            name: 'Panic Capacitor',
            value: 70,
            rarity: 4,
            quantity: 1,
            kind: 'shield_recharger' as const,
            shieldChargeAmount: 50,
          },
        ],
        backpackValue: 70,
      },
    }

    const result = consumeShieldRecharger(state, 'panic_capacitor', 0)

    expect(result).not.toBeNull()
    expect(result!.event.id).toBe('shield_recharger_panic_capacitor_started')
    expect(result!.state.raid.shield?.charge).toBe(5)
    expect(result!.state.raid.shield?.durability).toBe(80)
    expect(result!.state.raid.backpack).toEqual([])
    expect(result!.state.raid.backpackValue).toBe(0)
    expect(result!.state.raid.activeShieldRecharge).toMatchObject({
      itemId: 'panic_capacitor',
      chargeRemaining: 50,
      totalTicks: 5,
      ticksRemaining: 5,
    })
  })

  it('supports future instant shield rechargers', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        shield: {
          ...initial.raid.shield!,
          charge: 5,
          durability: 80,
        },
        backpack: [
          {
            itemId: 'flash_cell',
            name: 'Flash Cell',
            value: 55,
            rarity: 4,
            quantity: 1,
            kind: 'shield_recharger' as const,
            shieldChargeAmount: 35,
            applyTicks: 0,
          },
        ],
        backpackValue: 55,
      },
    }

    const result = consumeShieldRecharger(state, 'flash_cell', 0)

    expect(result).not.toBeNull()
    expect(result!.event.id).toBe('shield_recharger_flash_cell_used')
    expect(result!.state.raid.shield?.charge).toBe(40)
    expect(result!.state.raid.activeShieldRecharge).toBeNull()
    expect(result!.state.raid.backpack).toEqual([])
    expect(result!.state.raid.backpackValue).toBe(0)
  })

  it('cannot use a shield recharger at full charge', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        backpack: [
          {
            itemId: 'fizz_cell',
            name: 'Fizz Cell',
            value: 12,
            rarity: 1,
            quantity: 1,
            kind: 'shield_recharger' as const,
            shieldChargeAmount: 20,
          },
        ],
        backpackValue: 12,
      },
    }

    expect(consumeShieldRecharger(state, 'fizz_cell', 0)).toBeNull()
  })

  it('cannot use a shield recharger outside RAIDING', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'DEPLOYING' as const,
        shield: {
          ...initial.raid.shield!,
          charge: 5,
          durability: 80,
        },
        backpack: [
          {
            itemId: 'fizz_cell',
            name: 'Fizz Cell',
            value: 12,
            rarity: 1,
            quantity: 1,
            kind: 'shield_recharger' as const,
            shieldChargeAmount: 20,
          },
        ],
        backpackValue: 12,
      },
    }

    expect(consumeShieldRecharger(state, 'fizz_cell', 0)).toBeNull()
  })

  it('uses the selected current-raid bandage', () => {
    const state = {
      ...createInitialState(0),
      raider: { ...createInitialState(0).raider, hp: 75, mood: -2 },
      raid: {
        ...createInitialState(0).raid,
        phase: 'RAIDING' as const,
        healingItems: [
          makeBandage({ itemId: 'bandage_white', name: 'White Bandage', healAmount: 5, rarity: 1 }),
          makeBandage({ itemId: 'bandage_blue', name: 'Blue Bandage', healAmount: 25, moodGain: 3, rarity: 3 }),
          makeBandage({ itemId: 'bandage_purple', name: 'Purple Bandage', healAmount: 50, moodGain: 4, rarity: 4 }),
        ],
      },
    }

    const result = consumeHealingItem(state, 'bandage_blue', 0)

    expect(result).not.toBeNull()
    expect(result!.event.id).toBe('healing_bandage_blue_used')
    expect(result!.event.text).toContain('gained 3 mood')
    expect(result!.state.raider.hp).toBe(100)
    expect(result!.state.raider.mood).toBe(1)
    expect(result!.state.raid.healingItems.map(item => item.itemId)).toEqual([
      'bandage_white',
      'bandage_purple',
    ])
  })

  it('allows manual bandage use even above the old auto-heal threshold', () => {
    const state = {
      ...createInitialState(0),
      raider: { ...createInitialState(0).raider, hp: 80 },
      raid: {
        ...createInitialState(0).raid,
        phase: 'RAIDING' as const,
        healingItems: [makeBandage({ itemId: 'bandage_blue', name: 'Blue Bandage', healAmount: 25, rarity: 3 })],
      },
    }

    const result = consumeHealingItem(state, 'bandage_blue', 0)
    expect(result).not.toBeNull()
    expect(result!.state.raider.hp).toBe(100)
  })

  it('never heals more than 50 HP from one bandage use', () => {
    const state = {
      ...createInitialState(0),
      raider: { ...createInitialState(0).raider, hp: 10 },
      raid: {
        ...createInitialState(0).raid,
        phase: 'RAIDING' as const,
        healingItems: [makeBandage({ itemId: 'bandage_purple', name: 'Purple Bandage', healAmount: 50, rarity: 4 })],
      },
    }

    const result = consumeHealingItem(state, 'bandage_purple', 0)

    expect(result).not.toBeNull()
    expect(result!.state.raider.hp).toBe(60)
    expect(result!.event.text).toContain('Restored 50 HP')
  })

  it('caps healing mood gains at the raider mood maximum', () => {
    const state = {
      ...createInitialState(0),
      raider: { ...createInitialState(0).raider, hp: 50, mood: 4 },
      raid: {
        ...createInitialState(0).raid,
        phase: 'RAIDING' as const,
        healingItems: [makeBandage({ itemId: 'bandage_purple', name: 'Purple Bandage', healAmount: 50, moodGain: 4, rarity: 4 })],
      },
    }

    const result = consumeHealingItem(state, 'bandage_purple', 0)

    expect(result).not.toBeNull()
    expect(result!.state.raider.mood).toBe(5)
  })

  it('cannot heal from home stash items without current-raid bandages', () => {
    const state = {
      ...createInitialState(0),
      raider: { ...createInitialState(0).raider, hp: 50 },
      homeStash: [
        {
          itemId: 'bandage_white',
          name: 'White Bandage',
          value: 0,
          rarity: 1,
          quantity: 1,
        },
      ],
      raid: { ...createInitialState(0).raid, phase: 'RAIDING' as const, healingItems: [] },
    }

    expect(consumeHealingItem(state, 'bandage_white', 0)).toBeNull()
  })

  it('does not use a bandage that is not in the current-raid med pocket', () => {
    const state = {
      ...createInitialState(0),
      raider: { ...createInitialState(0).raider, hp: 50 },
      raid: {
        ...createInitialState(0).raid,
        phase: 'RAIDING' as const,
        healingItems: [makeBandage({ itemId: 'bandage_white' })],
      },
    }

    expect(consumeHealingItem(state, 'bandage_blue', 0)).toBeNull()
  })
})
