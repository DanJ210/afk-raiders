// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import PreparationPanel from '../../src/components/PreparationPanel.vue'

function createStore(overrides: Record<string, unknown> = {}) {
  const store = reactive({
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

  return store
}

let activeStore: ReturnType<typeof createStore>

vi.mock('../../src/stores/gameStore', () => ({
  useGameStore: () => activeStore,
}))

function findCardByText(wrapper: ReturnType<typeof mount>, text: string) {
  const card = wrapper.findAll('article').find(item => item.text().includes(text))
  expect(card).toBeDefined()
  return card!
}

function findButtonByText(wrapper: ReturnType<typeof mount>, label: string) {
  const button = wrapper.findAll('button').find(item => item.text() === label)
  expect(button).toBeDefined()
  return button!
}

describe('PreparationPanel', () => {
  beforeEach(() => {
    activeStore = createStore()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('asks for confirmation before buying a weapon and blocks purchase on cancel', async () => {
    const confirmSpy = vi.fn(() => false)
    ;(window as { confirm?: (message?: string) => boolean }).confirm = confirmSpy
    const wrapper = mount(PreparationPanel)

    const crowbarCard = findCardByText(wrapper, 'Crowbar of Minor Confidence')
    const buyButton = crowbarCard.findAll('button').find(item => item.text() === 'Buy')
    expect(buyButton).toBeDefined()

    await buyButton!.trigger('click')

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(activeStore.purchaseWeapon).not.toHaveBeenCalled()
  })

  it('asks for confirmation before buying a healing item and proceeds on accept', async () => {
    const confirmSpy = vi.fn(() => true)
    ;(window as { confirm?: (message?: string) => boolean }).confirm = confirmSpy
    const wrapper = mount(PreparationPanel)

    const whiteBandageCard = findCardByText(wrapper, 'White Bandage')
    const buyOneButton = whiteBandageCard.findAll('button').find(item => item.text() === 'Buy 1')
    expect(buyOneButton).toBeDefined()

    await buyOneButton!.trigger('click')

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(activeStore.purchaseHealingItem).toHaveBeenCalledWith('bandage_white', 1)
  })

  it('disables preparation action buttons outside HUB phase', () => {
    activeStore = createStore({ phase: 'RAIDING' })
    const wrapper = mount(PreparationPanel)

    const crowbarCard = findCardByText(wrapper, 'Crowbar of Minor Confidence')
    const buyWeaponButton = crowbarCard.findAll('button').find(item => item.text() === 'Buy')
    expect(buyWeaponButton).toBeDefined()
    expect((buyWeaponButton!.element as HTMLButtonElement).disabled).toBe(true)

    const whiteBandageCard = findCardByText(wrapper, 'White Bandage')
    const buyHealingButton = whiteBandageCard.findAll('button').find(item => item.text() === 'Buy 1')
    expect(buyHealingButton).toBeDefined()
    expect((buyHealingButton!.element as HTMLButtonElement).disabled).toBe(true)

    const clearLoadoutButton = findButtonByText(wrapper, 'Clear Loadout')
    expect((clearLoadoutButton.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows explicit loadout consumption and weapon-loss warnings', () => {
    const wrapper = mount(PreparationPanel)

    expect(wrapper.text()).toContain('Loadout warning: healing items moved into loadout are consumed when deployment starts.')
    expect(wrapper.text()).toContain('Failure warning: the currently equipped weapon can be lost when a raid ends in KNOCKED_OUT.')
  })
})
