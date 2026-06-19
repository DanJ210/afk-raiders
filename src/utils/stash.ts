/**
 * Home stash utilities: category emoji mapping and number formatting.
 */

export function getCategoryEmoji(itemName: string): string {
  const lower = itemName.toLowerCase()
  if (lower.includes('water')) return '💧'
  if (lower.includes('bottle')) return '🍾'
  if (lower.includes('ammo')) return '🔫'
  if (lower.includes('armor') || lower.includes('helmet') || lower.includes('vest')) return '🛡️'
  if (lower.includes('med') || lower.includes('heal') || lower.includes('stimpack')) return '🏥'
  if (lower.includes('key') || lower.includes('card')) return '🔑'
  if (lower.includes('food') || lower.includes('ration')) return '🥫'
  if (lower.includes('rare')) return '✨'
  return '📦'
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-US')
}
