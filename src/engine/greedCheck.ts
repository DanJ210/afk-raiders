/**
 * Greed Check™ — the signature mechanic of AFK Raiders.
 *
 * During RAIDING, each tick we roll to decide whether the Raider:
 *   - Pushes deeper (continues raiding, greed level rises)
 *   - Attempts extraction (exits safely with loot)
 *   - Gets downed (pushed too far and paid for it)
 *
 * Formula explanation:
 *
 *   baseExtractChance = 1.5%  (Raider's survival instinct, barely)
 *   extractChance     = clamp(baseExtractChance, 0.5%, 8%) plus survival modifiers
 *
 *   deathChance comes from danger-level ambient RAIDING pressure and skill modifiers.
 *   Greed no longer directly changes extraction odds or downed chance.
 *
 *   Calm/Pressure are applied to raid.greedLevel before this function is called.
 *   CALL_EXTRACT forces the extraction branch regardless of RNG
 *   Low HP without field meds adds a survival-instinct extraction bonus, dampened by danger level
 *
 * Greed is event-driven: this function never increases greed by itself.
 *
 * Roll order: death check first, then extract check, else push deeper.
 */

import type { DangerLevel, RaidState } from './types.js'
import type { RNG } from './rng.js'
import { getDangerLevelProfile } from './dangerLevelProfiles.js'

export type GreedOutcome = 'PUSH_DEEPER' | 'EXTRACT' | 'DOWNED'

export interface GreedCheckResult {
  outcome: GreedOutcome
  newGreedLevel: number
}

const BASE_EXTRACT_CHANCE = 0.015
const MIN_EXTRACT_CHANCE = 0.005
const MAX_EXTRACT_CHANCE = 0.08
const LOW_HP_EXTRACTION_DANGER_MULTIPLIER: Record<DangerLevel, number> = {
  Low: 1,
  Medium: 0.25,
  High: 0.1,
}

function lowHpExtractionBonus(
  currentHp: number | undefined,
  maxHp: number | undefined,
  hasHealingItems: boolean,
  dangerLevel: DangerLevel | null,
): number {
  if (currentHp === undefined || maxHp === undefined || maxHp <= 0 || hasHealingItems) return 0

  const hpRatio = currentHp / maxHp
  const dangerMultiplier = dangerLevel ? LOW_HP_EXTRACTION_DANGER_MULTIPLIER[dangerLevel] : 1
  if (hpRatio <= 0.25) return 0.08 * dangerMultiplier
  if (hpRatio <= 0.50) return 0.05 * dangerMultiplier
  if (hpRatio <= 0.75) return 0.025 * dangerMultiplier
  return 0
}

/** Run the Greed Check for one tick. Returns outcome + updated greed level. */
export function runGreedCheck(
  raid: RaidState,
  rng: RNG,
  opts: {
    currentHp?: number
    maxHp?: number
    hasHealingItems?: boolean
    extractionChanceBonus?: number
    deathChanceMultiplier?: number
  },
): GreedCheckResult {
  const { greedLevel, forceExtract } = raid

  // Forced extraction (CALL_EXTRACT action)
  if (forceExtract) {
    return { outcome: 'EXTRACT', newGreedLevel: greedLevel }
  }

  let extractChance = BASE_EXTRACT_CHANCE
  extractChance += lowHpExtractionBonus(opts.currentHp, opts.maxHp, opts.hasHealingItems ?? false, raid.dangerLevel)
  extractChance += opts.extractionChanceBonus ?? 0
  extractChance = Math.min(MAX_EXTRACT_CHANCE, Math.max(MIN_EXTRACT_CHANCE, extractChance))

  const profile = getDangerLevelProfile(raid.dangerLevel)

  const deathChance = Math.max(0, profile.ambientRaidDeathChance) * Math.max(0, opts.deathChanceMultiplier ?? 1)

  const roll = rng.next()

  // Death check first
  if (roll < deathChance) {
    return { outcome: 'DOWNED', newGreedLevel: greedLevel }
  }

  // Extract check
  if (roll < deathChance + extractChance) {
    return { outcome: 'EXTRACT', newGreedLevel: greedLevel }
  }

  return { outcome: 'PUSH_DEEPER', newGreedLevel: greedLevel }
}
