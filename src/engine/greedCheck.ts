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

/** Run the Greed Check for one tick. Returns outcome + updated greed level. */
export function runGreedCheck(
  raid: RaidState,
  rng: RNG,
  opts: { encouraged: boolean; scolded: boolean },
): GreedCheckResult {
  const { greedLevel, forceExtract } = raid

  // Forced extraction (CALL_EXTRACT action)
  if (forceExtract) {
    return { outcome: 'EXTRACT', newGreedLevel: greedLevel }
  }

  // Calculate extract probability
  let extractChance = BASE_EXTRACT_CHANCE - greedLevel * GREED_EXTRACT_PENALTY
  if (opts.encouraged) extractChance -= ENCOURAGE_EXTRACT_PENALTY
  if (opts.scolded) extractChance += SCOLD_EXTRACT_BONUS
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

  // Push deeper — greed rises
  const newGreedLevel = Math.min(100, greedLevel + GREED_INCREMENT)
  return { outcome: 'PUSH_DEEPER', newGreedLevel }
}
