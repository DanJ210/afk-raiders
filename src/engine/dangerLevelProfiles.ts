import type { DangerLevel } from './types.js'

export interface DangerLevelProfile {
  dangerLevel: DangerLevel
  /** Economy guardrail: higher danger improves drop value, but not linearly with risk. */
  lootValueMultiplier: number
  /** Rarity bias applied when choosing which item satisfies a loot-value drop. */
  lootRarityWeights: Record<number, number>
  robotEncounterWeightMultiplier: number
  robotFailureDamageMultiplier: number
  /** Small per-tick autonomous downed chance during RAIDING. */
  ambientRaidDeathChance: number
  extractionRiskEventWeightMultiplier: number
  extractionSafeEventWeightMultiplier: number
}

export const DANGER_LEVEL_PROFILES: Record<DangerLevel, DangerLevelProfile> = {
  Low: {
    dangerLevel: 'Low',
    lootValueMultiplier: 0.85,
    lootRarityWeights: { 1: 1.25, 2: 1, 3: 0.75, 4: 0.5, 5: 0.25 },
    robotEncounterWeightMultiplier: 0.95,
    robotFailureDamageMultiplier: 0.95,
    ambientRaidDeathChance: 0,
    extractionRiskEventWeightMultiplier: 1.25,
    extractionSafeEventWeightMultiplier: 1,
  },
  Medium: {
    dangerLevel: 'Medium',
    lootValueMultiplier: 1.2,
    lootRarityWeights: { 1: 0.85, 2: 1, 3: 1.25, 4: 1.5, 5: 1.8 },
    robotEncounterWeightMultiplier: 1.45,
    robotFailureDamageMultiplier: 1.5,
    ambientRaidDeathChance: 0.007,
    extractionRiskEventWeightMultiplier: 1.6,
    extractionSafeEventWeightMultiplier: 0.8,
  },
  High: {
    dangerLevel: 'High',
    lootValueMultiplier: 1.55,
    lootRarityWeights: { 1: 0.55, 2: 0.75, 3: 1.35, 4: 2.1, 5: 3.25 },
    robotEncounterWeightMultiplier: 2,
    robotFailureDamageMultiplier: 2,
    ambientRaidDeathChance: 0.02,
    extractionRiskEventWeightMultiplier: 2.25,
    extractionSafeEventWeightMultiplier: 0.55,
  },
}

const BASELINE_PROFILE: DangerLevelProfile = {
  dangerLevel: 'Low',
  lootValueMultiplier: 1,
  lootRarityWeights: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 },
  robotEncounterWeightMultiplier: 1,
  robotFailureDamageMultiplier: 1,
  ambientRaidDeathChance: 0,
  extractionRiskEventWeightMultiplier: 1,
  extractionSafeEventWeightMultiplier: 1,
}

export function getDangerLevelProfile(dangerLevel: DangerLevel | null | undefined): DangerLevelProfile {
  if (!dangerLevel) return BASELINE_PROFILE
  return DANGER_LEVEL_PROFILES[dangerLevel] ?? BASELINE_PROFILE
}

export function rarityWeight(profile: DangerLevelProfile, rarity: number): number {
  return profile.lootRarityWeights[rarity] ?? 1
}
