import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useStashViewModel } from '../../src/composables/useStashViewModel'

describe('useStashViewModel', () => {
  it('sorts stash by per-unit value then total line value', () => {
    const homeStashRef = ref([
      { itemId: 'c', name: 'C', value: 10, rarity: 1, quantity: 5 },
      { itemId: 'a', name: 'A', value: 100, rarity: 4, quantity: 1 },
      { itemId: 'b', name: 'B', value: 100, rarity: 4, quantity: 3 },
    ])
    const coinsRef = ref(42)

    const vm = useStashViewModel(homeStashRef, coinsRef)

    expect(vm.sortedStash.value.map(item => item.itemId)).toEqual(['b', 'a', 'c'])
  })

  it('computes stash totals and selected item details', () => {
    const homeStashRef = ref([
      { itemId: 'x', name: 'X', value: 20, rarity: 2, quantity: 2 },
      { itemId: 'y', name: 'Y', value: 5, rarity: 1, quantity: 4 },
    ])
    const coinsRef = ref(99)

    const vm = useStashViewModel(homeStashRef, coinsRef)

    expect(vm.stashValue.value).toBe(60)
    expect(vm.coinValue.value).toBe(99)
    expect(vm.totalItemCount.value).toBe(6)

    vm.openItemDetails('x')
    expect(vm.selectedItem.value?.itemId).toBe('x')
    expect(vm.selectedItemTotalValue.value).toBe(40)

    vm.closeItemDetails()
    expect(vm.selectedItem.value).toBeNull()
    expect(vm.selectedItemTotalValue.value).toBe(0)
  })
})
