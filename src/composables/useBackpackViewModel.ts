/**
 * useBackpackViewModel — view-model logic for the Backpack panel.
 *
 * Responsibilities:
 * - Compute filtered/sorted lists: backpackItems, healingItems, shieldRechargerItems
 * - Compute can-* predicates for action availability
 * - Provide helper functions (greedLabel, isShieldRecharger, isPocketed)
 * - Track selected item state
 */

import { computed, ref } from 'vue'
import type { BackpackItem, HiddenPocketItem, GameState } from '../engine/types.js'

export function useBackpackViewModel(
  raidRef: { value: GameState['raid'] },
  raiderRef: { value: GameState['raider'] },
) {
  const selectedBackpackItemId = ref<string | null>(null)

  const hiddenPocket = computed<HiddenPocketItem | null>(() => {
    const pocket = raidRef.value.hiddenPocket
    if (!pocket) return null

    const liveStack = raidRef.value.backpack.find(item => item.itemId === pocket.itemId)
    return {
      ...pocket,
      quantity: liveStack?.quantity ?? 0,
    }
  })
  const shield = computed(() => raidRef.value.shield)

  // Filters & sorts backpack items (excluding pocket items and shield rechargers)
  const backpackItems = computed(() =>
    [...raidRef.value.backpack]
      .filter(item => item.itemId !== hiddenPocket.value?.itemId)
      .filter(item => !isShieldRecharger(item))
      .sort((a, b) => {
        if (b.rarity !== a.rarity) return b.rarity - a.rarity
        if (b.value !== a.value) return b.value - a.value
        return a.name.localeCompare(b.name)
      }),
  )

  // Sorts healing items by heal amount and name
  const healingItems = computed(() =>
    [...raidRef.value.healingItems].sort((a, b) => {
      if (b.healAmount !== a.healAmount) return b.healAmount - a.healAmount
      return a.name.localeCompare(b.name)
    }),
  )

  // Filters & sorts shield recharger items
  const shieldRechargerItems = computed(() =>
    [...raidRef.value.backpack]
      .filter(item => item.itemId !== hiddenPocket.value?.itemId)
      .filter(isShieldRecharger)
      .sort((a, b) => {
        if (b.shieldChargeAmount !== a.shieldChargeAmount)
          return b.shieldChargeAmount - a.shieldChargeAmount
        if (b.rarity !== a.rarity) return b.rarity - a.rarity
        return a.name.localeCompare(b.name)
      }),
  )

  // Can apply healing when raid is active, raider is alive, and not at full HP
  const canApplyHealing = computed(
    () =>
      raidRef.value.phase !== 'HUB' &&
      raidRef.value.phase !== 'DOWNED' &&
      raiderRef.value.hp > 0 &&
      raiderRef.value.hp < raiderRef.value.maxHp,
  )

  // Can manage pocket (set/clear) when raid is active
  const canManageHiddenPocket = computed(
    () => raidRef.value.phase !== 'HUB' && raidRef.value.phase !== 'DOWNED',
  )

  // Can apply shield recharge when actively raiding with charge available
  const canApplyShieldCharge = computed(
    () =>
      raidRef.value.phase === 'RAIDING' &&
      raidRef.value.activeShieldRecharge === null &&
      shield.value !== null &&
      shield.value.durability > 0 &&
      shield.value.charge < shield.value.maxCharge,
  )

  // Can apply any shield recharger if we have any and can apply one
  const canApplyAnyShieldRecharger = computed(
    () => canApplyShieldCharge.value && shieldRechargerItems.value.length > 0,
  )

  // Get the currently selected backpack item
  const selectedBackpackItem = computed(() => {
    if (!selectedBackpackItemId.value) return null
    return raidRef.value.backpack.find(item => item.itemId === selectedBackpackItemId.value) ?? null
  })

  // Total value of selected item (name × quantity)
  const selectedBackpackItemTotalValue = computed(
    () => (selectedBackpackItem.value
      ? selectedBackpackItem.value.value * selectedBackpackItem.value.quantity
      : 0),
  )

  // Can save selected item to pocket
  const canSaveToPocket = computed(
    () =>
      !!selectedBackpackItem.value &&
      !isPocketed(selectedBackpackItem.value.itemId) &&
      canManageHiddenPocket.value,
  )

  // Greed level with CSS class for styling
  const greedClass = computed(() => {
    const g = raidRef.value.greedLevel
    if (g < 40) return 'greed--low'
    if (g < 70) return 'greed--mid'
    return 'greed--high'
  })

  // Helper: convert greed number to human-readable label
  function greedLabel(level: number): string {
    if (level < 20) return '😌 Browsing'
    if (level < 40) return '🤑 Loot Curious'
    if (level < 60) return '😤 Pushing It'
    if (level < 80) return '🚨 Major Bait'
    return '☠️ Loot Spiral'
  }

  // Helper: check if item is a shield recharger with type guard
  function isShieldRecharger(
    item: BackpackItem | null,
  ): item is BackpackItem & { kind: 'shield_recharger'; shieldChargeAmount: number } {
    return item?.kind === 'shield_recharger' && typeof item.shieldChargeAmount === 'number'
  }

  // Helper: check if item is in the hidden pocket
  function isPocketed(itemId: string): boolean {
    return hiddenPocket.value?.itemId === itemId
  }

  // Dialog management
  function openBackpackItemDetails(itemId: string) {
    selectedBackpackItemId.value = itemId
  }

  function closeBackpackItemDetails() {
    selectedBackpackItemId.value = null
  }

  return {
    // Selected item tracking
    selectedBackpackItemId,
    selectedBackpackItem,
    selectedBackpackItemTotalValue,

    // Item lists
    backpackItems,
    healingItems,
    shieldRechargerItems,

    // State
    hiddenPocket,
    shield,

    // Can-* predicates
    canApplyHealing,
    canManageHiddenPocket,
    canApplyShieldCharge,
    canApplyAnyShieldRecharger,
    canSaveToPocket,

    // Greed
    greedClass,
    greedLabel,

    // Helpers
    isShieldRecharger,
    isPocketed,

    // Dialog management
    openBackpackItemDetails,
    closeBackpackItemDetails,
  }
}
