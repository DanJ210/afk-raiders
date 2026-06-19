import { computed, ref } from 'vue'
import type { BackpackItem } from '../engine/types'

export function useStashViewModel(homeStashRef: { value: BackpackItem[] }, coinsRef: { value: number }) {
  /** Highest-value items at the top (per-unit value; line total breaks ties) */
  const sortedStash = computed(() =>
    [...homeStashRef.value].sort(
      (a, b) => b.value - a.value || b.value * b.quantity - a.value * a.quantity,
    ),
  )

  /** Unsold item value currently in the stash. */
  const stashValue = computed(() => {
    return homeStashRef.value.reduce((sum, item) => sum + item.value * item.quantity, 0)
  })

  /** Value from overflow auto-sales. */
  const coinValue = computed(() => coinsRef.value)

  const totalItemCount = computed(() => {
    return homeStashRef.value.reduce((sum, item) => sum + item.quantity, 0)
  })

  const selectedItemId = ref<string | null>(null)

  const selectedItem = computed<BackpackItem | null>(() => {
    if (!selectedItemId.value) return null
    return sortedStash.value.find(item => item.itemId === selectedItemId.value) ?? null
  })

  const selectedItemTotalValue = computed(() =>
    selectedItem.value ? selectedItem.value.value * selectedItem.value.quantity : 0,
  )

  function openItemDetails(itemId: string) {
    selectedItemId.value = itemId
  }

  function closeItemDetails() {
    selectedItemId.value = null
  }

  return {
    sortedStash,
    stashValue,
    coinValue,
    totalItemCount,
    selectedItemId,
    selectedItem,
    selectedItemTotalValue,
    openItemDetails,
    closeItemDetails,
  }
}
