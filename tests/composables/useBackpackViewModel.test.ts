import { computed, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { createInitialState } from '../../src/engine/initialState'
import { useBackpackViewModel } from '../../src/composables/useBackpackViewModel'

describe('useBackpackViewModel', () => {
  it('derives hidden pocket quantity from the live backpack stack', () => {
    const initial = createInitialState(0)
    const raidRef = ref({
      ...initial.raid,
      backpack: [
        {
          itemId: 'water_bottle_tactical',
          name: 'Tactical Water Bottle',
          value: 40,
          rarity: 3,
          quantity: 2,
        },
      ],
      hiddenPocket: {
        itemId: 'water_bottle_tactical',
        name: 'Tactical Water Bottle',
        value: 40,
        rarity: 3,
        quantity: 1,
      },
    })
    const raiderRef = computed(() => initial.raider)

    const viewModel = useBackpackViewModel(raidRef, raiderRef)

    expect(viewModel.hiddenPocket.value?.quantity).toBe(2)

    raidRef.value = {
      ...raidRef.value,
      backpack: [
        {
          itemId: 'water_bottle_tactical',
          name: 'Tactical Water Bottle',
          value: 40,
          rarity: 3,
          quantity: 4,
        },
      ],
    }

    expect(viewModel.hiddenPocket.value?.quantity).toBe(4)
  })
})
