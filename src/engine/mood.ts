const MOOD_RARITY_WEIGHT_STEP = 0.012
const MIN_MOOD_RARITY_WEIGHT = 0.88
const MAX_MOOD_RARITY_WEIGHT = 1.12
const MOOD_RESILIENCE_STEP = 0.015
const MIN_MOOD_RESILIENCE_FACTOR = 0.925

export function clampMood(mood: number): number {
  return Math.max(-5, Math.min(5, mood))
}

export function getMoodRarityWeightMultiplier(rarity: number, mood: number): number {
  const clampedMood = clampMood(mood)
  if (clampedMood === 0) return 1

  const rarityOffset = rarity - 3
  const multiplier = 1 + (clampedMood * rarityOffset * MOOD_RARITY_WEIGHT_STEP)
  return Math.max(MIN_MOOD_RARITY_WEIGHT, Math.min(MAX_MOOD_RARITY_WEIGHT, multiplier))
}

export function getMoodResilienceMultiplier(mood: number): number {
  const clampedMood = clampMood(mood)
  if (clampedMood <= 0) return 1
  const multiplier = 1 - (clampedMood * MOOD_RESILIENCE_STEP)
  return Math.max(MIN_MOOD_RESILIENCE_FACTOR, multiplier)
}

export function getMoodResilienceReductionPercent(mood: number): number {
  const clampedMood = clampMood(mood)
  if (clampedMood <= 0) return 0
  return Math.min(7.5, clampedMood * (MOOD_RESILIENCE_STEP * 100))
}