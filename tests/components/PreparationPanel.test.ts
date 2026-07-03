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
    purchasedShieldRechargers: [
      {
        itemId: 'fizz_cell',
        name: 'Fizz Cell',
        value: 12,
        chargeAmount: 20,
        rarity: 1,
        quantity: 2,
      },
    ],
    selectedHealingLoadout: [
      {
        itemId: 'bandage_white',
        quantity: 1,
      },
    ],
    selectedShieldRechargerLoadout: [
      {
        itemId: 'fizz_cell',
        quantity: 1,
      },
    ],
    purchaseWeapon: vi.fn(),
    repairWeapon: vi.fn(),
    equipWeapon: vi.fn(),
    purchaseHealingItem: vi.fn(),
    purchaseShieldRecharger: vi.fn(),
    setSelectedHealingLoadout: vi.fn(),
    setSelectedShieldRechargerLoadout: vi.fn(),
    clearSelectedHealingLoadout: vi.fn(),
    clearSelectedShieldRechargerLoadout: vi.fn(),
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
    const wrapper = mount(PreparationPanel)

    const aspperigoCard = findCardByText(wrapper, 'Aspperigo')
    const buyButton = aspperigoCard.findAll('button').find(item => item.text() === 'Buy')
    expect(buyButton).toBeDefined()

    await buyButton!.trigger('click')
    expect(wrapper.find('[data-testid="prep-confirm-modal"]').exists()).toBe(true)

    await wrapper.get('[data-testid="prep-confirm-cancel"]').trigger('click')

    expect(activeStore.purchaseWeapon).not.toHaveBeenCalled()
  })

  it('asks for confirmation before buying a healing item and proceeds on accept', async () => {
    const wrapper = mount(PreparationPanel)

    const whiteBandageCard = findCardByText(wrapper, 'White Bandage')
    const buyOneButton = whiteBandageCard.findAll('button').find(item => item.text() === 'Buy 1')
    expect(buyOneButton).toBeDefined()

    await buyOneButton!.trigger('click')
    expect(wrapper.find('[data-testid="prep-confirm-modal"]').exists()).toBe(true)

    await wrapper.get('[data-testid="prep-confirm-accept"]').trigger('click')

    expect(activeStore.purchaseHealingItem).toHaveBeenCalledWith('bandage_white', 1)
  })

  it('asks for confirmation before buying a shield recharger and proceeds on accept', async () => {
    const wrapper = mount(PreparationPanel)

    const fizzCellCard = findCardByText(wrapper, 'Fizz Cell')
    const buyOneButton = fizzCellCard.findAll('button').find(item => item.text() === 'Buy 1')
    expect(buyOneButton).toBeDefined()

    await buyOneButton!.trigger('click')
    expect(wrapper.find('[data-testid="prep-confirm-modal"]').exists()).toBe(true)

    await wrapper.get('[data-testid="prep-confirm-accept"]').trigger('click')

    expect(activeStore.purchaseShieldRecharger).toHaveBeenCalledWith('fizz_cell', 1)
  })

  it('rejects a second confirmation request while one is already pending', async () => {
    const wrapper = mount(PreparationPanel)
    const panelVm = wrapper.vm as unknown as {
      requestConfirmation?: (message: string) => Promise<boolean>
    }

    expect(panelVm.requestConfirmation).toBeTypeOf('function')

    const firstConfirmation = panelVm.requestConfirmation!('First title\n\nFirst body')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="prep-confirm-modal"]').text()).toContain('First title')

    const secondResult = await panelVm.requestConfirmation!('Second title\n\nSecond body')
    expect(secondResult).toBe(false)
    expect(wrapper.get('[data-testid="prep-confirm-modal"]').text()).toContain('First title')
    expect(wrapper.get('[data-testid="prep-confirm-modal"]').text()).not.toContain('Second title')

    await wrapper.get('[data-testid="prep-confirm-cancel"]').trigger('click')

    await expect(firstConfirmation).resolves.toBe(false)
  })

  it('disables preparation action buttons outside HUB phase', () => {
    activeStore = createStore({ phase: 'RAIDING' })
    const wrapper = mount(PreparationPanel)

    const aspperigoCard = findCardByText(wrapper, 'Aspperigo')
    const buyWeaponButton = aspperigoCard.findAll('button').find(item => item.text() === 'Buy')
    expect(buyWeaponButton).toBeDefined()
    expect((buyWeaponButton!.element as HTMLButtonElement).disabled).toBe(true)

    const whiteBandageCard = findCardByText(wrapper, 'White Bandage')
    const buyHealingButton = whiteBandageCard.findAll('button').find(item => item.text() === 'Buy 1')
    expect(buyHealingButton).toBeDefined()
    expect((buyHealingButton!.element as HTMLButtonElement).disabled).toBe(true)

    const clearLoadoutButton = findButtonByText(wrapper, 'Clear Loadout')
    expect((clearLoadoutButton.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows explicit loadout behavior and weapon-loss warnings', () => {
    const wrapper = mount(PreparationPanel)

    expect(wrapper.text()).toContain('Loadout behavior: staged healing and shield rechargers are available during the raid and remain configured on successful return.')
    expect(wrapper.text()).toContain('Failure warning: KNOCKED_OUT clears staged loadouts, and the currently equipped weapon can be lost.')
  })

  it('shows total selected med quantity rather than distinct item count', () => {
    activeStore = createStore({
      selectedHealingLoadout: [
        { itemId: 'bandage_white', quantity: 2 },
        { itemId: 'bandage_blue', quantity: 3 },
      ],
    })

    const wrapper = mount(PreparationPanel)

    expect(wrapper.text()).toContain('Selected Meds')
    expect(wrapper.text()).toContain('5')
  })

  it('keeps a single parent scroll path on mobile by disabling inner list scroll there', () => {
    const wrapper = mount(PreparationPanel)

    const scrollRegions = wrapper.findAll('div').filter(item => {
      const classes = item.attributes('class') ?? ''
      return classes.includes('max-h-76') && classes.includes('overflow-y-auto')
    })

    expect(scrollRegions).toHaveLength(3)
    for (const region of scrollRegions) {
      const classes = region.attributes('class') ?? ''
      expect(classes).toContain('max-[600px]:max-h-none')
      expect(classes).toContain('max-[600px]:overflow-visible')
    }
  })
})
