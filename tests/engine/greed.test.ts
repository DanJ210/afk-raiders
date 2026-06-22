import { describe, expect, it } from 'vitest'
import { clampGreedLevel, decayGreedForHubReturn, getGreedDangerEventWeightMultiplier, getGreedRarityWeightMultiplier, growGreedAfterPushDeeper, majorConditionChanceFromGreed, resetGreedAfterDowned } from '../../src/engine/greed'

describe('greed helpers', () => {
  it('clamps greed to the 0-100 range', () => {
    expect(clampGreedLevel(-5)).toBe(0)
    expect(clampGreedLevel(42.4)).toBe(42)
    expect(clampGreedLevel(140)).toBe(100)
  })

  it('decays greed when returning to the HUB', () => {
    expect(decayGreedForHubReturn(0)).toBe(0)
    expect(decayGreedForHubReturn(80)).toBe(56)
    expect(decayGreedForHubReturn(100)).toBe(70)
  })

  it('resets greed after getting downed', () => {
    expect(resetGreedAfterDowned()).toBe(0)
  })

  it('slowly grows greed when pushing deeper', () => {
    expect(growGreedAfterPushDeeper(0)).toBe(1)
    expect(growGreedAfterPushDeeper(42)).toBe(43)
    expect(growGreedAfterPushDeeper(100)).toBe(100)
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

  it('raises dangerous event weight with greed', () => {
    expect(getGreedDangerEventWeightMultiplier(0)).toBe(1)
    expect(getGreedDangerEventWeightMultiplier(100)).toBeGreaterThan(getGreedDangerEventWeightMultiplier(25))
    expect(getGreedDangerEventWeightMultiplier(100)).toBe(1.12)
  })
})
