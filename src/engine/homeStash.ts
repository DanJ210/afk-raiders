import type { BackpackItem } from './types.js'

export const HOME_STASH_ITEM_LIMIT = 120

export function getTotalItemCount(items: BackpackItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}

export function getTotalItemValue(items: BackpackItem[]): number {
  return items.reduce((sum, item) => sum + item.value * item.quantity, 0)
}

export interface StashSellResult {
  homeStash: BackpackItem[]
  coinsGained: number
  soldItemCount: number
}

/**
 * Sell lowest-value items (per unit) until the stash fits the item limit.
 * Nothing is ever deleted — overflow converts into coins at full item value.
 * Also used as a save-load migration for over-limit stashes.
 */
export function sellStashOverflow(items: BackpackItem[]): StashSellResult {
  const stash = items.map(item => ({ ...item }))
  let overflow = getTotalItemCount(stash) - HOME_STASH_ITEM_LIMIT
  let coinsGained = 0
  let soldItemCount = 0

  while (overflow > 0 && stash.length > 0) {
    let lowestIdx = 0
    for (let i = 1; i < stash.length; i++) {
      if (stash[i].value < stash[lowestIdx].value) lowestIdx = i
    }
    const entry = stash[lowestIdx]
    const unitsToSell = Math.min(entry.quantity, overflow)
    coinsGained += unitsToSell * entry.value
    soldItemCount += unitsToSell
    overflow -= unitsToSell

    if (unitsToSell === entry.quantity) {
      stash.splice(lowestIdx, 1)
    } else {
      stash[lowestIdx] = { ...entry, quantity: entry.quantity - unitsToSell }
    }
  }

  return { homeStash: stash, coinsGained, soldItemCount }
}

export function sellItemFromHomeStash(
  items: BackpackItem[],
  itemId: string,
  quantity?: number,
): StashSellResult {
  const stash = items.map(item => ({ ...item }))
  const entryIndex = stash.findIndex(item => item.itemId === itemId)

  if (entryIndex < 0) {
    return { homeStash: stash, coinsGained: 0, soldItemCount: 0 }
  }

  const entry = stash[entryIndex]
  const unitsToSell = Math.max(0, Math.min(quantity ?? entry.quantity, entry.quantity))

  if (unitsToSell === 0) {
    return { homeStash: stash, coinsGained: 0, soldItemCount: 0 }
  }

  const coinsGained = unitsToSell * entry.value

  if (unitsToSell === entry.quantity) {
    stash.splice(entryIndex, 1)
  } else {
    stash[entryIndex] = { ...entry, quantity: entry.quantity - unitsToSell }
  }

  return { homeStash: stash, coinsGained, soldItemCount: unitsToSell }
}

export interface HomeStashTransferResult {
  homeStash: BackpackItem[]
  transferredItemCount: number
  coinsGained: number
  soldItemCount: number
}

/**
 * Merge a raid backpack into the home stash (duplicate itemIds stack their
 * quantities). If the merged stash exceeds HOME_STASH_ITEM_LIMIT, the
 * lowest-value items are auto-sold for coins to make room — incoming cheap
 * loot may be sold immediately, but value is never lost.
 */
export function transferBackpackToHomeStash(
  homeStash: BackpackItem[],
  backpack: BackpackItem[],
): HomeStashTransferResult {
  const merged = homeStash.map(item => ({ ...item }))
  let transferredItemCount = 0

  for (const item of backpack) {
    const existingIdx = merged.findIndex(entry => entry.itemId === item.itemId)
    if (existingIdx >= 0) {
      merged[existingIdx] = {
        ...merged[existingIdx],
        quantity: merged[existingIdx].quantity + item.quantity,
      }
    } else {
      merged.push({ ...item })
    }
    transferredItemCount += item.quantity
  }

  const sale = sellStashOverflow(merged)

  return {
    homeStash: sale.homeStash,
    transferredItemCount,
    coinsGained: sale.coinsGained,
    soldItemCount: sale.soldItemCount,
  }
}
