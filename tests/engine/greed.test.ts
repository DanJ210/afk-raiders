import { describe, expect, it } from 'vitest'
import { clampGreedLevel, decayGreedForHubReturn, getGreedRarityWeightMultiplier, majorConditionChanceFromGreed } from '../../src/engine/greed'

describe('greed helpers', () => {
  it('clamps greed to the 0-100 range', () => {
    expect(clampGreedLevel(-5)).toBe(0)
    expect(clampGreedLevel(42.4)).toBe(42)
    expect(clampGreedLevel(140)).toBe(100)
  })

  it('decays greed when returning to the HUB', () => {
    expect(decayGreedForHubReturn(0)).toBe(0)
    expect(decayGreedForHubReturn(80)).toBe(36)
    expect(decayGreedForHubReturn(100)).toBe(45)
  })

  it('raises major condition chance with greed without guaranteeing it', () => {
    const lowGreedChance = majorConditionChanceFromGreed(0)
    const highGreedChance = majorConditionChanceFromGreed(100)

    expect(lowGreedChance).toBeGreaterThan(0)
    expect(highGreedChance).toBeGreaterThan(lowGreedChance)
    expect(highGreedChance).toBeLessThan(1)
  })

  it('biases high greed toward high-rarity loot and away from low-rarity loot', () => {
    expect(getGreedRarityWeightMultiplier(5, 100)).toBeGreaterThan(1)
    expect(getGreedRarityWeightMultiplier(1, 100)).toBeLessThan(1)
    expect(getGreedRarityWeightMultiplier(3, 100)).toBe(1)
    expect(getGreedRarityWeightMultiplier(5, 0)).toBe(1)
  })
})
