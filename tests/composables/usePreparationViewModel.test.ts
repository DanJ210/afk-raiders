import { describe, expect, it, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'
import { usePreparationViewModel } from '../../src/composables/usePreparationViewModel'

function createStore(overrides: Record<string, unknown> = {}) {
  return reactive({
    state: {
      coins: 1_000,
    },
    phase: 'HUB',
    raid: {
      equippedWeaponId: 'tea_kettle',
    },
    ownedWeapons: [
      {
        weaponId: 'tea_kettle',
        durability: 8,
      },
    ],
    purchasedHealingItems: [
      {
        itemId: 'bandage_white',
        name: 'White Bandage',
        healAmount: 5,
        moodGain: 1,
        purchaseCost: 8,
        rarity: 1,
        weight: 80,
        quantity: 2,
      },
    ],
    selectedHealingLoadout: [
      {
        itemId: 'bandage_white',
        quantity: 1,
      },
    ],
    purchaseWeapon: vi.fn(),
    repairWeapon: vi.fn(),
    equipWeapon: vi.fn(),
    purchaseHealingItem: vi.fn(),
    setSelectedHealingLoadout: vi.fn(),
    clearSelectedHealingLoadout: vi.fn(),
    ...overrides,
  })
}

let activeStore: ReturnType<typeof createStore>

vi.mock('../../src/stores/gameStore', () => ({
  useGameStore: () => activeStore,
}))

describe('usePreparationViewModel', () => {
  beforeEach(() => {
    activeStore = createStore()
    vi.restoreAllMocks()
  })

  it('asks confirmation before purchasing weapon and does nothing on cancel', async () => {
    const confirm = vi.fn(() => false)
    const viewModel = usePreparationViewModel({ confirm })

    await viewModel.purchaseWeapon('crowbar_of_minor_confidence')

    expect(confirm).toHaveBeenCalledTimes(1)
    expect(activeStore.purchaseWeapon).not.toHaveBeenCalled()
  })

  it('purchases healing item when confirmed', async () => {
    const confirm = vi.fn(() => true)
    const viewModel = usePreparationViewModel({ confirm })

    await viewModel.purchaseHealingItem('bandage_white')

    expect(confirm).toHaveBeenCalledTimes(1)
    expect(activeStore.purchaseHealingItem).toHaveBeenCalledWith('bandage_white', 1)
  })

  it('blocks mutating actions outside HUB phase', async () => {
    activeStore = createStore({ phase: 'RAIDING' })
    const confirm = vi.fn(() => true)
    const viewModel = usePreparationViewModel({ confirm })

    await viewModel.purchaseWeapon('crowbar_of_minor_confidence')
    await viewModel.purchaseHealingItem('bandage_white')
    await viewModel.clearLoadout()

    expect(confirm).not.toHaveBeenCalled()
    expect(activeStore.purchaseWeapon).not.toHaveBeenCalled()
    expect(activeStore.purchaseHealingItem).not.toHaveBeenCalled()
    expect(activeStore.clearSelectedHealingLoadout).not.toHaveBeenCalled()
  })

  it('updates staged loadout quantities through store action', () => {
    const viewModel = usePreparationViewModel({ confirm: () => true })

    viewModel.addHealingToLoadout('bandage_white')
    expect(activeStore.setSelectedHealingLoadout).toHaveBeenCalledWith([
      { itemId: 'bandage_white', quantity: 2 },
    ])

    viewModel.removeHealingFromLoadout('bandage_white')
    expect(activeStore.setSelectedHealingLoadout).toHaveBeenCalledWith([])
  })
})
