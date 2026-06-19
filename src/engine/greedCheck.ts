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
 *   greedPenalty      = greedLevel * 0.01%  (each greed point reduces extraction chance by 0.01 percentage points)
 *   extractChance     = clamp(baseExtractChance - greedPenalty, 0.5%, 8%)
 *
 *   deathChance starts at 0, grows with greedLevel:
 *   deathChance = max(0, (greedLevel - 90) * 0.03)%  (still relatively small even at max greed)
 *
 *   Calm     decreases extract chance (raider is calm, resilient, pushes longer)
 *   Pressure increases extract chance (raider gets nervous, wants out sooner)
 *   CALL_EXTRACT forces the extraction branch regardless of RNG
 *
 * Greed is event-driven: this function never increases greed by itself.
 *
 * Roll order: death check first, then extract check, else push deeper.
 */

import type { RaidState } from './types.js'
import type { RNG } from './rng.js'

export type GreedOutcome = 'PUSH_DEEPER' | 'EXTRACT' | 'DOWNED'

export interface GreedCheckResult {
  outcome: GreedOutcome
  newGreedLevel: number
}

const BASE_EXTRACT_CHANCE = 0.015
const MIN_EXTRACT_CHANCE = 0.005
const MAX_EXTRACT_CHANCE = 0.08
const GREED_EXTRACT_PENALTY = 0.0001    // per greed point (0–100 scale)
const GREED_DEATH_THRESHOLD = 90
const GREED_DEATH_RATE = 0.0003         // per greed point above threshold
const CALM_EXTRACT_PENALTY = 0.01  // calm raider stays in longer — extraction less likely
const PRESSURE_EXTRACT_BONUS = 0.015      // nervous raider wants out sooner — extraction more likely

function lowHpExtractionBonus(currentHp: number | undefined, maxHp: number | undefined, hasHealingItems: boolean): number {
  if (currentHp === undefined || maxHp === undefined || maxHp <= 0 || hasHealingItems) return 0

  const hpRatio = currentHp / maxHp
  if (hpRatio <= 0.25) return 0.08
  if (hpRatio <= 0.50) return 0.05
  if (hpRatio <= 0.75) return 0.025
  return 0
}

/** Run the Greed Check for one tick. Returns outcome + updated greed level. */
export function runGreedCheck(
  raid: RaidState,
  rng: RNG,
  opts: {
    calmed: boolean
    pressured: boolean
    currentHp?: number
    maxHp?: number
    hasHealingItems?: boolean
  },
): GreedCheckResult {
  const { greedLevel, forceExtract } = raid

  // Forced extraction (CALL_EXTRACT action)
  if (forceExtract) {
    return { outcome: 'EXTRACT', newGreedLevel: greedLevel }
  }

  let extractChance = BASE_EXTRACT_CHANCE - greedLevel * GREED_EXTRACT_PENALTY
  if (opts.calmed) extractChance -= CALM_EXTRACT_PENALTY
  if (opts.pressured) extractChance += PRESSURE_EXTRACT_BONUS
  extractChance += lowHpExtractionBonus(opts.currentHp, opts.maxHp, opts.hasHealingItems ?? false)
  extractChance = Math.min(MAX_EXTRACT_CHANCE, Math.max(MIN_EXTRACT_CHANCE, extractChance))

  // Calculate death probability (only kicks in above greed threshold)
  const deathChance = Math.max(
    0,
    (greedLevel - GREED_DEATH_THRESHOLD) * GREED_DEATH_RATE,
  )

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
