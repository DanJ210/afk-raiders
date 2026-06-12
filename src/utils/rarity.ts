/**
 * UI helpers for item rarity (1 = Common … 5 = Legendary).
 * Colors follow industry standards: gray, green, blue, purple, yellow.
 */

export const RARITY_LABELS: Record<number, string> = {
  1: 'Common',
  2: 'Uncommon',
  3: 'Rare',
  4: 'Epic',
  5: 'Legendary',
}

export function rarityLabel(rarity: number): string {
  return RARITY_LABELS[rarity] ?? `Rarity ${rarity}`
}

/** CSS class for the rarity color bar shown in front of item names. */
export function rarityBarClass(rarity: number): string {
  const tier = Math.min(5, Math.max(1, Math.trunc(rarity)))
  return `rarity-bar rarity-bar--${tier}`
}
