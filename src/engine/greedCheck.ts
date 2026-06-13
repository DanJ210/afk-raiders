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
 *   baseExtractChance = 20%  (Raider's survival instinct)
 *   greedPenalty      = greedLevel * 0.3    (each greed point makes extraction less likely)
 *   extractChance     = clamp(baseExtractChance - greedPenalty, 5%, 80%)
 *
 *   deathChance starts at 0, grows with greedLevel:
 *   deathChance = max(0, (greedLevel - 40) * 0.5)%  (deadly above greed 40)
 *
 *   Encourage nudges +10% toward push-deeper (more bold/greedy)
 *   Scold    nudges +15% toward extraction  (more cautious)
 *   CALL_EXTRACT forces the extraction branch regardless of RNG
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

const BASE_EXTRACT_CHANCE = 0.20
const GREED_EXTRACT_PENALTY = 0.003  // per greed point (0–100 scale)
const GREED_DEATH_THRESHOLD = 40
const GREED_DEATH_RATE = 0.005        // per greed point above threshold
const ENCOURAGE_EXTRACT_PENALTY = 0.10  // courage boost makes extraction less likely
const SCOLD_EXTRACT_BONUS = 0.15        // scolding makes caution more likely
const GREED_INCREMENT = 8               // how much greed rises each push-deeper

function lowHpExtractionBonus(currentHp: number | undefined, maxHp: number | undefined, hasHealingItems: boolean): number {
  if (currentHp === undefined || maxHp === undefined || maxHp <= 0 || hasHealingItems) return 0

  const hpRatio = currentHp / maxHp
  if (hpRatio <= 0.25) return 0.40
  if (hpRatio <= 0.50) return 0.25
  if (hpRatio <= 0.75) return 0.10
  return 0
}

/** Run the Greed Check for one tick. Returns outcome + updated greed level. */
export function runGreedCheck(
  raid: RaidState,
  rng: RNG,
  opts: {
    encouraged: boolean
    scolded: boolean
    extractionPreference?: number
    currentHp?: number
    maxHp?: number
    hasHealingItems?: boolean
  },
): GreedCheckResult {
  const { greedLevel, forceExtract } = raid
  const extractionPreference = opts.extractionPreference ?? 50

  // Forced extraction (CALL_EXTRACT action)
  if (forceExtract) {
    return { outcome: 'EXTRACT', newGreedLevel: greedLevel }
  }

  // Calculate extract probability with slider modifier
  // Safer (0) = +30% to extraction chance (eager to leave early)
  // Hoarder (100) = -30% to extraction chance (wants to stay longer)
  const sliderModifier = (50 - extractionPreference) * 0.006
  
  let extractChance = BASE_EXTRACT_CHANCE - greedLevel * GREED_EXTRACT_PENALTY + sliderModifier
  if (opts.encouraged) extractChance -= ENCOURAGE_EXTRACT_PENALTY
  if (opts.scolded) extractChance += SCOLD_EXTRACT_BONUS
  extractChance += lowHpExtractionBonus(opts.currentHp, opts.maxHp, opts.hasHealingItems ?? false)
  extractChance = Math.min(0.80, Math.max(0.05, extractChance))

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

  // Push deeper — greed rises (scaled by preference)
  // Safer raiders gain greed faster (they should extract more)
  // Hoarders gain greed slower (they want to loot more before extracting naturally)
  const greedMultiplier = 1 + (extractionPreference - 50) * 0.01
  const adjustedGreedIncrement = Math.round(GREED_INCREMENT * greedMultiplier)
  const newGreedLevel = Math.min(100, greedLevel + adjustedGreedIncrement)
  return { outcome: 'PUSH_DEEPER', newGreedLevel }
}
