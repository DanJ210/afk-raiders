import type { BackpackItem } from './types.js'

export const HOME_STASH_ITEM_LIMIT = 120

export function getTotalItemCount(items: BackpackItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}

/**
 * Clamp a stash to the item limit (quantities count). Used as a save-load
 * migration for stashes that grew while the limit was not enforced.
 * Keeps earlier entries; trims quantity of the entry that crosses the cap.
 */
export function clampStashToLimit(items: BackpackItem[]): BackpackItem[] {
  const clamped: BackpackItem[] = []
  let remaining = HOME_STASH_ITEM_LIMIT
  for (const item of items) {
    if (remaining <= 0) break
    const quantity = Math.min(item.quantity, remaining)
    clamped.push({ ...item, quantity })
    remaining -= quantity
  }
  return clamped
}

export function getTotalItemValue(items: BackpackItem[]): number {
  return items.reduce((sum, item) => sum + item.value * item.quantity, 0)
}

export interface HomeStashTransferResult {
  homeStash: BackpackItem[]
  transferredItemCount: number
  discardedItemCount: number
}

export function transferBackpackToHomeStash(
  homeStash: BackpackItem[],
  backpack: BackpackItem[],
): HomeStashTransferResult {
  const updatedHomeStash = homeStash.map(item => ({ ...item }))
  let remainingCapacity = Math.max(0, HOME_STASH_ITEM_LIMIT - getTotalItemCount(updatedHomeStash))
  let transferredItemCount = 0
  let discardedItemCount = 0

  for (const item of backpack) {
    if (remainingCapacity <= 0) {
      discardedItemCount += item.quantity
      continue
    }

    const quantityToTransfer = Math.min(item.quantity, remainingCapacity)
    const existingIdx = updatedHomeStash.findIndex(entry => entry.itemId === item.itemId)

    if (existingIdx >= 0) {
      updatedHomeStash[existingIdx] = {
        ...updatedHomeStash[existingIdx],
        quantity: updatedHomeStash[existingIdx].quantity + quantityToTransfer,
      }
    } else {
      updatedHomeStash.push({
        ...item,
        quantity: quantityToTransfer,
      })
    }

    transferredItemCount += quantityToTransfer
    remainingCapacity -= quantityToTransfer
    discardedItemCount += item.quantity - quantityToTransfer
  }

  return {
    homeStash: updatedHomeStash,
    transferredItemCount,
    discardedItemCount,
  }
}
