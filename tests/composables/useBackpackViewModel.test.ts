import { computed, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { createInitialState } from '../../src/engine/initialState'
import { useBackpackViewModel } from '../../src/composables/useBackpackViewModel'

describe('useBackpackViewModel', () => {
  function setup() {
    const initial = createInitialState(0)
    const raidRef = ref(initial.raid)
    const raiderRefState = ref(initial.raider)
    const raiderRef = computed(() => raiderRefState.value)
    const viewModel = useBackpackViewModel(raidRef, raiderRef)

    return { initial, raidRef, raiderRefState, viewModel }
  }

  it('derives hidden pocket quantity from the live backpack stack', () => {
    const { initial, raidRef, viewModel } = setup()

    raidRef.value = {
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
    }

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

  it('filters and sorts backpack items (excluding hidden pocket and shield rechargers)', () => {
    const { initial, raidRef, viewModel } = setup()

    raidRef.value = {
      ...initial.raid,
      backpack: [
        { itemId: 'alpha', name: 'Alpha', value: 20, rarity: 3, quantity: 1 },
        { itemId: 'beta', name: 'Beta', value: 50, rarity: 3, quantity: 1 },
        { itemId: 'gamma', name: 'Gamma', value: 5, rarity: 5, quantity: 1 },
        {
          itemId: 'recharger_x',
          name: 'Recharger X',
          value: 10,
          rarity: 1,
          quantity: 1,
          kind: 'shield_recharger',
          shieldChargeAmount: 15,
        },
      ],
      hiddenPocket: {
        itemId: 'alpha',
        name: 'Alpha',
        value: 20,
        rarity: 3,
        quantity: 1,
      },
    }

    expect(viewModel.backpackItems.value.map(item => item.itemId)).toEqual(['gamma', 'beta'])
  })

  it('sorts shield rechargers by charge, then rarity, then name', () => {
    const { initial, raidRef, viewModel } = setup()

    raidRef.value = {
      ...initial.raid,
      backpack: [
        {
          itemId: 'r1',
          name: 'Bravo',
          value: 1,
          rarity: 2,
          quantity: 1,
          kind: 'shield_recharger',
          shieldChargeAmount: 20,
        },
        {
          itemId: 'r2',
          name: 'Alpha',
          value: 1,
          rarity: 3,
          quantity: 1,
          kind: 'shield_recharger',
          shieldChargeAmount: 20,
        },
        {
          itemId: 'r3',
          name: 'Zulu',
          value: 1,
          rarity: 1,
          quantity: 1,
          kind: 'shield_recharger',
          shieldChargeAmount: 35,
        },
      ],
    }

    expect(viewModel.shieldRechargerItems.value.map(item => item.itemId)).toEqual(['r3', 'r2', 'r1'])
  })

  it('computes can-* predicates for healing, pocket, and shield recharge', () => {
    const { initial, raidRef, raiderRefState, viewModel } = setup()

    raidRef.value = {
      ...initial.raid,
      phase: 'RAIDING',
      activeShieldRecharge: null,
      shield: { ...initial.raid.shield!, charge: 10, maxCharge: 40, durability: 100 },
      backpack: [
        {
          itemId: 'r1',
          name: 'Recharger',
          value: 1,
          rarity: 1,
          quantity: 1,
          kind: 'shield_recharger',
          shieldChargeAmount: 10,
        },
      ],
    }
    raiderRefState.value = { ...initial.raider, hp: 50, maxHp: 100 }

    expect(viewModel.canApplyHealing.value).toBe(true)
    expect(viewModel.canManageHiddenPocket.value).toBe(true)
    expect(viewModel.canApplyShieldCharge.value).toBe(true)
    expect(viewModel.canApplyAnyShieldRecharger.value).toBe(true)

    raiderRefState.value = { ...raiderRefState.value, hp: 100 }
    expect(viewModel.canApplyHealing.value).toBe(false)

    raidRef.value = { ...raidRef.value, phase: 'HUB' }
    expect(viewModel.canManageHiddenPocket.value).toBe(false)
    expect(viewModel.canApplyShieldCharge.value).toBe(false)
  })

  it('tracks selected item details and canSaveToPocket status', () => {
    const { initial, raidRef, viewModel } = setup()

    raidRef.value = {
      ...initial.raid,
      phase: 'RAIDING',
      backpack: [
        { itemId: 'loot_a', name: 'Loot A', value: 7, rarity: 2, quantity: 3 },
      ],
      hiddenPocket: null,
    }

    viewModel.openBackpackItemDetails('loot_a')
    expect(viewModel.selectedBackpackItem.value?.itemId).toBe('loot_a')
    expect(viewModel.selectedBackpackItemTotalValue.value).toBe(21)
    expect(viewModel.canSaveToPocket.value).toBe(true)

    raidRef.value = {
      ...raidRef.value,
      hiddenPocket: {
        itemId: 'loot_a',
        name: 'Loot A',
        value: 7,
        rarity: 2,
        quantity: 1,
      },
    }
    expect(viewModel.isPocketed('loot_a')).toBe(true)
    expect(viewModel.canSaveToPocket.value).toBe(false)

    viewModel.closeBackpackItemDetails()
    expect(viewModel.selectedBackpackItem.value).toBeNull()
    expect(viewModel.selectedBackpackItemTotalValue.value).toBe(0)
  })

  it('computes greed class thresholds and readable greed labels', () => {
    const { initial, raidRef, viewModel } = setup()

    raidRef.value = { ...initial.raid, greedLevel: 10 }
    expect(viewModel.greedClass.value).toBe('greed--low')

    raidRef.value = { ...initial.raid, greedLevel: 55 }
    expect(viewModel.greedClass.value).toBe('greed--mid')

    raidRef.value = { ...initial.raid, greedLevel: 85 }
    expect(viewModel.greedClass.value).toBe('greed--high')

    expect(viewModel.greedLabel(10)).toContain('Chill')
    expect(viewModel.greedLabel(35)).toContain('Interested')
    expect(viewModel.greedLabel(55)).toContain('Pushing It')
    expect(viewModel.greedLabel(75)).toContain('Reckless')
    expect(viewModel.greedLabel(95)).toContain('DEATH WISH')
  })

  it('detects shield recharger items with helper type guard', () => {
    const { viewModel } = setup()

    expect(viewModel.isShieldRecharger(null)).toBe(false)
    expect(viewModel.isShieldRecharger({ itemId: 'x', name: 'X', value: 1, rarity: 1, quantity: 1 })).toBe(false)
    expect(
      viewModel.isShieldRecharger({
        itemId: 'r',
        name: 'R',
        value: 1,
        rarity: 1,
        quantity: 1,
        kind: 'shield_recharger',
        shieldChargeAmount: 5,
      }),
    ).toBe(true)
  })
})
