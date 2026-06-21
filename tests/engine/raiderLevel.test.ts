import { describe, expect, it } from 'vitest'
import { createRNG } from '../../src/engine/rng'
import {
  MAX_RAIDER_LEVEL,
  applyRaiderXpGain,
  getRaiderLevelBenefitProfile,
  getRaiderLevelFromXp,
  getRaiderLevelProgress,
  getRaiderTitleBand,
  normalizeRaiderLevelXp,
  rollRaiderXp,
  xpRequiredForLevel,
} from '../../src/engine/raiderLevel'

describe('Raider Level helpers', () => {
  it('starts at level 1 with the first title band', () => {
    const progress = getRaiderLevelProgress(0)

    expect(progress.level).toBe(1)
    expect(progress.levelXp).toBe(0)
    expect(progress.title.name).toBe('Freshly Briefed Liability')
    expect(progress.progressPercent).toBe(0)
  })

  it('uses an ascending XP curve capped at level 75', () => {
    expect(xpRequiredForLevel(1)).toBe(0)
    expect(xpRequiredForLevel(2)).toBeGreaterThanOrEqual(140)
    expect(xpRequiredForLevel(30)).toBeGreaterThan(xpRequiredForLevel(20))
    expect(xpRequiredForLevel(MAX_RAIDER_LEVEL)).toBeGreaterThan(xpRequiredForLevel(60))
    expect(xpRequiredForLevel(MAX_RAIDER_LEVEL)).toBeGreaterThanOrEqual(450000)
    expect(xpRequiredForLevel(MAX_RAIDER_LEVEL + 1)).toBe(xpRequiredForLevel(MAX_RAIDER_LEVEL))
  })

  it('applies XP and emits one compact level-up for the highest crossed level', () => {
    const almostLevelTwo = xpRequiredForLevel(2) - 1
    const result = applyRaiderXpGain(almostLevelTwo, [
      { reason: 'extraction_success', xp: 5 },
    ])

    expect(result.previousLevel).toBe(1)
    expect(result.level).toBe(2)
    expect(result.levelUps).toHaveLength(1)
    expect(result.levelUps[0]).toMatchObject({ fromLevel: 1, level: 2, levelsGained: 1 })
    expect(result.levelUps[0].text).toContain('Raider Level 2')
  })

  it('caps XP and level at the maximum', () => {
    const cap = xpRequiredForLevel(MAX_RAIDER_LEVEL)
    const result = applyRaiderXpGain(cap - 1, [
      { reason: 'high_danger_survived', xp: 999999 },
    ])

    expect(result.levelXp).toBe(cap)
    expect(result.level).toBe(MAX_RAIDER_LEVEL)
    expect(getRaiderLevelFromXp(result.levelXp)).toBe(MAX_RAIDER_LEVEL)
    expect(getRaiderLevelProgress(result.levelXp).isMaxLevel).toBe(true)
  })

  it('normalizes invalid saved XP defensively', () => {
    expect(normalizeRaiderLevelXp(-10)).toBe(0)
    expect(normalizeRaiderLevelXp(Number.NaN)).toBe(0)
    expect(normalizeRaiderLevelXp('12')).toBe(0)
  })

  it('rolls XP gains through the seeded RNG', () => {
    const triggers = [
      { reason: 'loot_found' as const, minXp: 2, maxXp: 4 },
      { reason: 'robot_survived' as const, minXp: 4, maxXp: 9 },
    ]

    const first = rollRaiderXp(triggers, createRNG(99))
    const second = rollRaiderXp(triggers, createRNG(99))

    expect(first).toEqual(second)
    expect(first[0].xp).toBeGreaterThanOrEqual(2)
    expect(first[0].xp).toBeLessThanOrEqual(4)
    expect(first[1].xp).toBeGreaterThanOrEqual(4)
    expect(first[1].xp).toBeLessThanOrEqual(9)
  })

  it('looks up title bands by level', () => {
    expect(getRaiderTitleBand(1).name).toBe('Freshly Briefed Liability')
    expect(getRaiderTitleBand(28).name).toBe('Questionable Competence')
    expect(getRaiderTitleBand(75).name).toBe('Myth of Desperanza')
  })

  it('derives small title-band extraction stipend benefits', () => {
    expect(getRaiderLevelBenefitProfile(0).extractionCoinBonus).toBe(0)
    expect(getRaiderLevelBenefitProfile(xpRequiredForLevel(10)).extractionCoinBonus).toBe(1)
    expect(getRaiderLevelBenefitProfile(xpRequiredForLevel(75)).extractionCoinBonus).toBe(8)
  })

  it('derives tiny title-band resilience benefits', () => {
    expect(getRaiderLevelBenefitProfile(0).resilienceReductionPercent).toBe(0)
    expect(getRaiderLevelBenefitProfile(xpRequiredForLevel(10)).resilienceReductionPercent).toBe(0.2)
    expect(getRaiderLevelBenefitProfile(xpRequiredForLevel(75)).resilienceReductionPercent).toBe(1.6)
  })
})