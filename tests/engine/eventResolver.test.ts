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
import { applyEffects } from '../../src/engine/eventResolver'
import { createInitialState } from '../../src/engine/initialState'
import type { EventTemplate } from '../../src/engine/types'

// backpackValue=10 maps exclusively to golden_water_bottle (the only item with value 10),
// so item selection is fully deterministic — no RNG variance.
const LOOT_TEMPLATE: EventTemplate = {
  id: 'test_loot',
  weight: 1,
  text: 'You found something.',
  effects: { backpackValue: 10 },
}

const DAMAGE_TEMPLATE: EventTemplate = {
  id: 'test_damage',
  weight: 1,
  text: 'You found something sharp.',
  effects: { hp: '-5d10' },
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
    expect(item.value).toBe(10)
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
    expect(afterFirst.raid.backpackValue).toBe(10)

    const afterSecond = applyEffects(afterFirst, LOOT_TEMPLATE, rng)
    expect(afterSecond.raid.backpackValue).toBe(20)
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
})
