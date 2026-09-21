import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePreparationActions } from '../../src/composables/usePreparationActions'
import { createInitialState } from '../../src/engine/initialState'

function setupState() {
  const state = createInitialState(0)
  state.coins = 1_000
  return { value: state }
}

describe('usePreparationActions', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('mutates the store for purchase, equip, and loadout selection actions', () => {
    const stateRef = setupState()
    const lastTickAtRef = { value: 0 }
    const persistCallback = vi.fn()
    const published: unknown[] = []
    const actions = usePreparationActions(
      stateRef,
      lastTickAtRef,
      persistCallback,
      events => published.push(...events),
      () => 123,
    )

    actions.purchaseWeapon('aspperigo')
    expect(stateRef.value.coins).toBe(935)
    expect(stateRef.value.ownedWeapons.some(weapon => weapon.weaponId === 'aspperigo')).toBe(true)
    // Prep economy actions narrate: purchases now land in the diary too.
    expect(stateRef.value.log).toHaveLength(1)
    expect(published).toHaveLength(1)

    actions.equipWeapon('aspperigo')
    expect(stateRef.value.raid.equippedWeaponId).toBe('aspperigo')
    expect(stateRef.value.log).toHaveLength(2)
    expect(published).toHaveLength(2)

    actions.purchaseHealingItem('bandage_green', 2)
    expect(stateRef.value.coins).toBe(899)
    expect(stateRef.value.purchasedHealingItems).toEqual([
      expect.objectContaining({ itemId: 'bandage_green', quantity: 2 }),
    ])
    expect(stateRef.value.log).toHaveLength(3)
    expect(published).toHaveLength(3)

    actions.purchaseShieldRecharger('fizz_cell', 2)
    expect(stateRef.value.coins).toBe(875)
    expect(stateRef.value.purchasedShieldRechargers).toEqual([
      expect.objectContaining({ itemId: 'fizz_cell', quantity: 2 }),
    ])
    expect(stateRef.value.log).toHaveLength(4)
    expect(published).toHaveLength(4)

    actions.setSelectedHealingLoadout([{ itemId: 'bandage_green', quantity: 1 }])
    expect(stateRef.value.purchasedHealingItems).toEqual([
      expect.objectContaining({ itemId: 'bandage_green', quantity: 2 }),
    ])
    expect(stateRef.value.raid.selectedHealingLoadout).toEqual([
      expect.objectContaining({ itemId: 'bandage_green', quantity: 1 }),
    ])

    actions.clearSelectedHealingLoadout()
    expect(stateRef.value.purchasedHealingItems).toEqual([
      expect.objectContaining({ itemId: 'bandage_green', quantity: 2 }),
    ])
    expect(stateRef.value.raid.selectedHealingLoadout).toEqual([])

    actions.setSelectedShieldRechargerLoadout([{ itemId: 'fizz_cell', quantity: 1 }])
    expect(stateRef.value.purchasedShieldRechargers).toEqual([
      expect.objectContaining({ itemId: 'fizz_cell', quantity: 2 }),
    ])
    expect(stateRef.value.raid.selectedShieldRechargerLoadout).toEqual([
      expect.objectContaining({ itemId: 'fizz_cell', quantity: 1 }),
    ])

    actions.clearSelectedShieldRechargerLoadout()
    expect(stateRef.value.raid.selectedShieldRechargerLoadout).toEqual([])

    expect(persistCallback).toHaveBeenCalled()
    expect(published.length).toBeGreaterThan(0)
  })
})
