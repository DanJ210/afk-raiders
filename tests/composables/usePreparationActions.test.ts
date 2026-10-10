import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePreparationActions } from '../../src/composables/usePreparationActions'
import { createInitialState } from '../../src/engine/initialState'
import { RNG } from '../../src/engine/rng'

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
    vi.spyOn(Date, 'now').mockReturnValue(0)
    vi.spyOn(RNG.prototype, 'next').mockReturnValue(0)
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
    expect(stateRef.value.log).toHaveLength(2)
    expect(published).toHaveLength(2)

    actions.purchaseShieldRecharger('fizz_cell', 2)
    expect(stateRef.value.coins).toBe(875)
    expect(stateRef.value.purchasedShieldRechargers).toEqual([
      expect.objectContaining({ itemId: 'fizz_cell', quantity: 2 }),
    ])
    expect(stateRef.value.log).toHaveLength(2)
    expect(published).toHaveLength(2)

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

  it('persists silent purchases and shares the cap across categories and action instances', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(0)
    vi.spyOn(RNG.prototype, 'next').mockReturnValue(0)
    const stateRef = setupState()
    const persist = vi.fn()
    const publish = vi.fn()
    const setup = () => usePreparationActions(stateRef, { value: 0 }, persist, publish, () => 123)
    const actions = setup()

    actions.purchaseWeapon('aspperigo')
    actions.purchaseHealingItem('bandage_green', 2)
    expect(publish).toHaveBeenLastCalledWith([])
    clock.mockReturnValue(30_000)
    actions.purchaseShieldRecharger('fizz_cell', 2)
    clock.mockReturnValue(60_000)
    setup().purchaseHealingItem('bandage_green')

    expect(stateRef.value.log.map(event => event.id)).toEqual([
      'weapon_purchase_aspperigo', 'shield_recharger_purchase_fizz_cell',
    ])
    expect(stateRef.value.coins).toBe(857)
    expect(stateRef.value.purchasedHealingItems[0]?.quantity).toBe(3)
    expect(stateRef.value.purchasedShieldRechargers[0]?.quantity).toBe(2)
    expect(persist).toHaveBeenCalledTimes(4)
    expect(persist).toHaveBeenLastCalledWith(stateRef.value, 123, 0)
  })

  it('does not spend the chatter budget or persist when a purchase is rejected', () => {
    vi.spyOn(RNG.prototype, 'next').mockReturnValue(0)
    const stateRef = setupState()
    stateRef.value.coins = 0
    const persist = vi.fn()
    const publish = vi.fn()
    const actions = usePreparationActions(stateRef, { value: 0 }, persist, publish)
    actions.purchaseWeapon('aspperigo')
    actions.purchaseHealingItem('bandage_green')
    actions.purchaseShieldRecharger('fizz_cell')
    expect(stateRef.value.purchaseComms).toBeUndefined()
    expect(stateRef.value.log).toEqual([])
    expect(persist).not.toHaveBeenCalled()
    expect(publish).not.toHaveBeenCalled()
  })
})
