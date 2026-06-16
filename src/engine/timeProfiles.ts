import type { DangerLevel, TimeOfDay } from './types.js'

export interface TimeOfDayProfile {
  timeOfDay: TimeOfDay
  dangerLevel: DangerLevel
  /** Economy guardrail: higher danger improves drop value, but not linearly with risk. */
  lootValueMultiplier: number
  /** Rarity bias applied when choosing which item satisfies a loot-value drop. */
  lootRarityWeights: Record<number, number>
  robotEncounterWeightMultiplier: number
  robotFailureDamageMultiplier: number
  extractionRiskEventWeightMultiplier: number
  extractionSafeEventWeightMultiplier: number
}

export const TIME_OF_DAY_PROFILES: Record<TimeOfDay, TimeOfDayProfile> = {
  Day: {
    timeOfDay: 'Day',
    dangerLevel: 'Low',
    lootValueMultiplier: 0.85,
    lootRarityWeights: { 1: 1.25, 2: 1, 3: 0.75, 4: 0.5, 5: 0.25 },
    robotEncounterWeightMultiplier: 0.95,
    robotFailureDamageMultiplier: 0.95,
    extractionRiskEventWeightMultiplier: 1.25,
    extractionSafeEventWeightMultiplier: 1,
  },
  Night: {
    timeOfDay: 'Night',
    dangerLevel: 'Medium',
    lootValueMultiplier: 1.2,
    lootRarityWeights: { 1: 0.85, 2: 1, 3: 1.25, 4: 1.5, 5: 1.8 },
    robotEncounterWeightMultiplier: 1.45,
    robotFailureDamageMultiplier: 1.5,
    extractionRiskEventWeightMultiplier: 1.6,
    extractionSafeEventWeightMultiplier: 0.8,
  },
  'Stella Red': {
    timeOfDay: 'Stella Red',
    dangerLevel: 'High',
    lootValueMultiplier: 1.55,
    lootRarityWeights: { 1: 0.55, 2: 0.75, 3: 1.35, 4: 2.1, 5: 3.25 },
    robotEncounterWeightMultiplier: 2,
    robotFailureDamageMultiplier: 2,
    extractionRiskEventWeightMultiplier: 2.25,
    extractionSafeEventWeightMultiplier: 0.55,
  },
}

const BASELINE_PROFILE: TimeOfDayProfile = {
  timeOfDay: 'Day',
  dangerLevel: 'Low',
  lootValueMultiplier: 1,
  lootRarityWeights: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 },
  robotEncounterWeightMultiplier: 1,
  robotFailureDamageMultiplier: 1,
  extractionRiskEventWeightMultiplier: 1,
  extractionSafeEventWeightMultiplier: 1,
}

export function getTimeOfDayProfile(timeOfDay: TimeOfDay | null | undefined): TimeOfDayProfile {
  return timeOfDay ? TIME_OF_DAY_PROFILES[timeOfDay] : BASELINE_PROFILE
}

export function rarityWeight(profile: TimeOfDayProfile, rarity: number): number {
  return profile.lootRarityWeights[rarity] ?? 1
}