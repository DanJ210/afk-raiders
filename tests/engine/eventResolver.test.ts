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
import { applyEffects, consumeHealingItemIfUseful, resolveHealingItemFind, resolveRobotEncounter } from '../../src/engine/eventResolver'
import { createInitialState } from '../../src/engine/initialState'
import type { EventTemplate, HealingItemStack } from '../../src/engine/types'

// backpackValue=1000 maps exclusively to hans_gruber,
// so item selection is fully deterministic — no RNG variance.
const LOOT_TEMPLATE: EventTemplate = {
  id: 'test_loot',
  weight: 1,
  text: 'You found something.',
  effects: { backpackValue: 1000 },
}

const DAMAGE_TEMPLATE: EventTemplate = {
  id: 'test_damage',
  weight: 1,
  text: 'You found something sharp.',
  effects: { hp: '-5d10' },
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
    expect(item.itemId).toBe('hans_gruber')
    expect(item.name).toBe('Hans Gruber (alive)')
    expect(item.value).toBe(1000)
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
    expect(afterSecond.raid.backpack[0].itemId).toBe('hans_gruber')
    expect(afterSecond.raid.backpack[0].quantity).toBe(2)
  })

  it('keeps backpackValue equal to the cumulative sum of applied deltas', () => {
    const state = createInitialState(0)
    const rng = createRNG(42)

    const afterFirst = applyEffects(state, LOOT_TEMPLATE, rng)
    expect(afterFirst.raid.backpackValue).toBe(1000)

    const afterSecond = applyEffects(afterFirst, LOOT_TEMPLATE, rng)
    expect(afterSecond.raid.backpackValue).toBe(2000)
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
    expect(result!.event.text).toContain('Took 24 damage')
    expect(result!.state.raider.hp).toBe(76)
    expect(result!.state.raid.backpack).toHaveLength(0)
  })

  it('applies encounter-specific damage multipliers only on failed robot encounters', () => {
    const state = createInitialState(0)
    const failed = resolveRobotEncounter(state, 'tattletale', createRNG(7), 0, { damageMultiplier: 7 })
    const defeated = resolveRobotEncounter(state, 'anxietick', createRNG(1), 0, { damageMultiplier: 10 })

    expect(failed).not.toBeNull()
    expect(failed!.event.id).toBe('robot_tattletale_escaped')
    expect(failed!.event.text).toContain('Took 63 damage')
    expect(failed!.state.raider.hp).toBe(37)

    expect(defeated).not.toBeNull()
    expect(defeated!.event.id).toBe('robot_anxietick_defeated')
    expect(defeated!.state.raider.hp).toBe(100)
  })

  it('does not let a failed robot encounter down a full-health raider', () => {
    const state = createInitialState(0)
    const result = resolveRobotEncounter(state, 'roomba_prime', createRNG(1), 0, { damageMultiplier: 3 })

    expect(result).not.toBeNull()
    expect(result!.event.id).toBe('robot_roomba_prime_escaped')
    expect(result!.event.text).toContain('Took 72 damage')
    expect(result!.state.raider.hp).toBe(28)
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
    expect(deadly!.state.raider.hp).toBe(0)

    expect(moderate).not.toBeNull()
    expect(moderate!.event.id).toBe('robot_tattletale_escaped')
    expect(moderate!.state.raider.hp).toBe(1)
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

  it('uses the smallest current-raid bandage that covers missing HP once HP is low', () => {
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

    const result = consumeHealingItemIfUseful(state, 0)

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

  it('does not spend a bandage before HP is low', () => {
    const state = {
      ...createInitialState(0),
      raider: { ...createInitialState(0).raider, hp: 80 },
      raid: {
        ...createInitialState(0).raid,
        phase: 'RAIDING' as const,
        healingItems: [makeBandage({ itemId: 'bandage_blue', name: 'Blue Bandage', healAmount: 25, rarity: 3 })],
      },
    }

    expect(consumeHealingItemIfUseful(state, 0)).toBeNull()
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

    const result = consumeHealingItemIfUseful(state, 0)

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

    const result = consumeHealingItemIfUseful(state, 0)

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

    expect(consumeHealingItemIfUseful(state, 0)).toBeNull()
  })
})
