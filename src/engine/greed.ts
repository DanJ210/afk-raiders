const MIN_GREED_LEVEL = 0
const MAX_GREED_LEVEL = 100
const HUB_RETURN_GREED_RETENTION = 0.45
const MIN_MAJOR_CONDITION_CHANCE = 0.12
const MAX_MAJOR_CONDITION_CHANCE = 0.72
const GREED_RARITY_WEIGHT_STEP = 0.08
const MIN_GREED_RARITY_WEIGHT = 0.82
const MAX_GREED_RARITY_WEIGHT = 1.22

export function clampGreedLevel(greedLevel: number): number {
  if (!Number.isFinite(greedLevel)) return MIN_GREED_LEVEL
  return Math.max(MIN_GREED_LEVEL, Math.min(MAX_GREED_LEVEL, Math.round(greedLevel)))
}

export function decayGreedForHubReturn(greedLevel: number): number {
  return clampGreedLevel(greedLevel * HUB_RETURN_GREED_RETENTION)
}

export function majorConditionChanceFromGreed(greedLevel: number): number {
  const normalizedGreed = clampGreedLevel(greedLevel) / MAX_GREED_LEVEL
  return MIN_MAJOR_CONDITION_CHANCE + ((MAX_MAJOR_CONDITION_CHANCE - MIN_MAJOR_CONDITION_CHANCE) * normalizedGreed)
}

export function getGreedRarityWeightMultiplier(rarity: number, greedLevel: number): number {
  const normalizedGreed = clampGreedLevel(greedLevel) / MAX_GREED_LEVEL
  if (normalizedGreed <= 0) return 1

  const rarityOffset = rarity - 3
  const multiplier = 1 + (normalizedGreed * rarityOffset * GREED_RARITY_WEIGHT_STEP)
  return Math.max(MIN_GREED_RARITY_WEIGHT, Math.min(MAX_GREED_RARITY_WEIGHT, multiplier))
}
