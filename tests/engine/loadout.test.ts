import { describe, expect, it } from 'vitest'
import { createInitialState } from '../../src/engine/initialState'
import { createRNG } from '../../src/engine/rng'
import {
  applyFailedRaidWeaponLoss,
  applyRaidWeaponWear,
  clearSelectedHealingLoadout,
  clearSelectedShieldRechargerLoadout,
  consumeSelectedPreparationLoadouts,
  consumeSelectedHealingLoadout,
  equipWeapon,
  purchaseHealingItem,
  purchaseShieldRecharger,
  purchaseWeapon,
  repairWeapon,
  setSelectedHealingLoadout,
  setSelectedShieldRechargerLoadout,
} from '../../src/engine/loadout'

function createState() {
  const state = createInitialState(0)
  return {
    ...state,
    coins: 1_000,
  }
}

describe('loadout transactions', () => {
  it('narrates prep transactions with filled desk-voice slots', () => {
    for (let seed = 0; seed < 10; seed++) {
      const rng = createRNG(seed)
      const purchase = purchaseWeapon(createState(), 'aspperigo', 0, rng)
      expect(purchase).not.toBeNull()
      expect(purchase!.event.text).toContain('Aspperigo')
      expect(purchase!.event.text).toContain('65')
      expect(purchase!.event.text).not.toMatch(/\{\w+\}/)

      const healing = purchaseHealingItem(createState(), 'bandage_green', 2, 0, rng)
      expect(healing).not.toBeNull()
      expect(healing!.event.text).toContain('2x')
      expect(healing!.event.text).not.toMatch(/\{\w+\}/)
    }
  })

  it('falls back to the first narration line without an RNG', () => {
    const purchase = purchaseWeapon(createState(), 'aspperigo', 0)
    expect(purchase!.event.text).toContain('Aspperigo')
    expect(purchase!.event.text).not.toMatch(/\{\w+\}/)
  })

  it('buys and equips a weapon from the catalog', () => {
    const purchase = purchaseWeapon(createState(), 'aspperigo', 0)
    expect(purchase).not.toBeNull()
    expect(purchase?.state.coins).toBe(935)
    expect(purchase?.state.ownedWeapons).toEqual([
      expect.objectContaining({ weaponId: 'tea_kettle' }),
      expect.objectContaining({ weaponId: 'aspperigo', durability: 10 }),
    ])

    const equipped = equipWeapon(purchase!.state, 'aspperigo', 0)
    expect(equipped).not.toBeNull()
    expect(equipped?.state.raid.equippedWeaponId).toBe('aspperigo')
  })

  it('repairs an owned weapon when enough coins are available', () => {
    const initial = createState()
    const damaged = {
      ...initial,
      coins: 100,
      ownedWeapons: [
        { weaponId: 'tea_kettle', durability: 2 },
        { weaponId: 'vernerider', durability: 3 },
      ],
    }

    const repaired = repairWeapon(damaged, 'vernerider', 0)
    expect(repaired).not.toBeNull()
    expect(repaired?.state.coins).toBe(70)
    expect(repaired?.state.ownedWeapons.find(entry => entry.weaponId === 'vernerider')).toEqual({
      weaponId: 'vernerider',
      durability: 12,
    })
  })

  it('buys healing items into the persistent stockpile', () => {
    const purchase = purchaseHealingItem(createState(), 'bandage_blue', 2, 0)
    expect(purchase).not.toBeNull()
    expect(purchase?.state.coins).toBe(916)
    expect(purchase?.state.purchasedHealingItems).toEqual([
      expect.objectContaining({ itemId: 'bandage_blue', quantity: 2 }),
    ])
  })

  it('locks and clears the selected healing loadout reversibly', () => {
    const stocked = {
      ...createState(),
      purchasedHealingItems: [
        { itemId: 'bandage_green', name: 'Green Bandage', healAmount: 10, moodGain: 2, rarity: 2, purchaseCost: 18, quantity: 2 },
      ],
    }

    const selected = setSelectedHealingLoadout(stocked, [{ itemId: 'bandage_green', quantity: 1 }], 0)
    expect(selected).not.toBeNull()
    expect(selected?.state.purchasedHealingItems).toEqual([
      expect.objectContaining({ itemId: 'bandage_green', quantity: 2 }),
    ])
    expect(selected?.state.raid.selectedHealingLoadout).toEqual([
      expect.objectContaining({ itemId: 'bandage_green', quantity: 1 }),
    ])

    const cleared = clearSelectedHealingLoadout(selected!.state, 0)
    expect(cleared).not.toBeNull()
    expect(cleared?.state.purchasedHealingItems).toEqual([
      expect.objectContaining({ itemId: 'bandage_green', quantity: 2 }),
    ])
    expect(cleared?.state.raid.selectedHealingLoadout).toEqual([])
  })

  it('buys shield rechargers into persistent stock and stages them for the next raid', () => {
    const bought = purchaseShieldRecharger(createState(), 'fizz_cell', 2, 0)
    expect(bought).not.toBeNull()
    expect(bought?.state.coins).toBe(976)
    expect(bought?.state.purchasedShieldRechargers).toEqual([
      expect.objectContaining({ itemId: 'fizz_cell', quantity: 2 }),
    ])

    const selected = setSelectedShieldRechargerLoadout(bought!.state, [{ itemId: 'fizz_cell', quantity: 1 }], 0)
    expect(selected).not.toBeNull()
    expect(selected?.state.raid.selectedShieldRechargerLoadout).toEqual([
      expect.objectContaining({ itemId: 'fizz_cell', quantity: 1 }),
    ])

    const cleared = clearSelectedShieldRechargerLoadout(selected!.state, 0)
    expect(cleared).not.toBeNull()
    expect(cleared?.state.raid.selectedShieldRechargerLoadout).toEqual([])
  })

  it('applies the selected healing loadout into the raid and clears the staging area', () => {
    const state = {
      ...createState(),
      purchasedHealingItems: [
        { itemId: 'bandage_white', name: 'White Bandage', healAmount: 5, moodGain: 1, rarity: 1, purchaseCost: 8, quantity: 1 },
      ],
      raid: {
        ...createState().raid,
        selectedHealingLoadout: [
          { itemId: 'bandage_white', name: 'White Bandage', healAmount: 5, moodGain: 1, rarity: 1, purchaseCost: 8, quantity: 1 },
        ],
      },
    }

    const applied = consumeSelectedHealingLoadout(state)

    expect(applied.purchasedHealingItems).toEqual([])
    expect(applied.raid.healingItems).toEqual([
      expect.objectContaining({ itemId: 'bandage_white', quantity: 1 }),
    ])
    expect(applied.raid.selectedHealingLoadout).toEqual([])
  })

  it('applies selected prep loadouts into the raid and converts staged rechargers into backpack items', () => {
    const state = {
      ...createState(),
      purchasedHealingItems: [
        { itemId: 'bandage_white', name: 'White Bandage', healAmount: 5, moodGain: 1, rarity: 1, purchaseCost: 8, quantity: 1 },
      ],
      purchasedShieldRechargers: [
        { itemId: 'fizz_cell', name: 'Fizz Cell', value: 12, chargeAmount: 20, rarity: 1, quantity: 1 },
      ],
      raid: {
        ...createState().raid,
        selectedHealingLoadout: [
          { itemId: 'bandage_white', name: 'White Bandage', healAmount: 5, moodGain: 1, rarity: 1, purchaseCost: 8, quantity: 1 },
        ],
        selectedShieldRechargerLoadout: [
          { itemId: 'fizz_cell', name: 'Fizz Cell', value: 12, chargeAmount: 20, rarity: 1, quantity: 1 },
        ],
      },
    }

    const applied = consumeSelectedPreparationLoadouts(state)

    expect(applied.purchasedHealingItems).toEqual([
      expect.objectContaining({ itemId: 'bandage_white', quantity: 1 }),
    ])
    expect(applied.purchasedShieldRechargers).toEqual([
      expect.objectContaining({ itemId: 'fizz_cell', quantity: 1 }),
    ])
    expect(applied.raid.selectedHealingLoadout).toEqual([
      expect.objectContaining({ itemId: 'bandage_white', quantity: 1 }),
    ])
    expect(applied.raid.selectedShieldRechargerLoadout).toEqual([
      expect.objectContaining({ itemId: 'fizz_cell', quantity: 1 }),
    ])
    expect(applied.raid.healingItems).toEqual([
      expect.objectContaining({ itemId: 'bandage_white', quantity: 1, fromLoadout: true }),
    ])
    expect(applied.raid.backpack).toEqual([
      expect.objectContaining({
        itemId: 'fizz_cell',
        kind: 'shield_recharger',
        shieldChargeAmount: 20,
        quantity: 1,
        fromLoadout: true,
      }),
    ])
    expect(applied.raid.backpackValue).toBe(0)
  })

  it('wears the equipped weapon down after a raid and breaks it at zero durability', () => {
    const wornState = {
      ...createState(),
      raid: {
        ...createState().raid,
        equippedWeaponId: 'aspperigo',
      },
      ownedWeapons: [
        { weaponId: 'tea_kettle', durability: 8 },
        { weaponId: 'aspperigo', durability: 1 },
      ],
    }

    const broken = applyRaidWeaponWear(wornState, 0)
    expect(broken).not.toBeNull()
    expect(broken?.state.ownedWeapons.some(entry => entry.weaponId === 'aspperigo')).toBe(false)
    expect(broken?.state.raid.equippedWeaponId).toBe('tea_kettle')
    expect(broken?.event.id).toBe('weapon_broken_aspperigo')
  })

  it('seeds fallback ownership when the equipped weapon breaks as the last owned weapon', () => {
    const wornState = {
      ...createState(),
      raid: {
        ...createState().raid,
        equippedWeaponId: 'aspperigo',
      },
      ownedWeapons: [
        { weaponId: 'aspperigo', durability: 1 },
      ],
    }

    const broken = applyRaidWeaponWear(wornState, 0)
    expect(broken).not.toBeNull()
    expect(broken?.state.raid.equippedWeaponId).toBe('tea_kettle')
    expect(broken?.state.ownedWeapons).toEqual([
      expect.objectContaining({ weaponId: 'tea_kettle', durability: 8 }),
    ])
  })

  it('loses the equipped weapon on failed raid recovery', () => {
    const failedState = {
      ...createState(),
      raid: {
        ...createState().raid,
        equippedWeaponId: 'vernerider',
      },
      ownedWeapons: [
        { weaponId: 'tea_kettle', durability: 8 },
        { weaponId: 'vernerider', durability: 12 },
      ],
    }

    const lost = applyFailedRaidWeaponLoss(failedState, 0)
    expect(lost).not.toBeNull()
    expect(lost?.state.ownedWeapons.some(entry => entry.weaponId === 'vernerider')).toBe(false)
    expect(lost?.state.raid.equippedWeaponId).toBe('tea_kettle')
    expect(lost?.event.id).toBe('weapon_lost_vernerider')
  })

  it('seeds fallback ownership when failed raid loss removes the last owned weapon', () => {
    const failedState = {
      ...createState(),
      raid: {
        ...createState().raid,
        equippedWeaponId: 'vernerider',
      },
      ownedWeapons: [
        { weaponId: 'vernerider', durability: 12 },
      ],
    }

    const lost = applyFailedRaidWeaponLoss(failedState, 0)
    expect(lost).not.toBeNull()
    expect(lost?.state.raid.equippedWeaponId).toBe('tea_kettle')
    expect(lost?.state.ownedWeapons).toEqual([
      expect.objectContaining({ weaponId: 'tea_kettle', durability: 8 }),
    ])
  })
})
