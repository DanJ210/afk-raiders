import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../../src/engine/initialState'
import { applyFailedRaidWeaponLoss, applyRaidWeaponWear, clearSelectedHealingLoadout, consumeSelectedHealingLoadout, equipWeapon, purchaseHealingItem, purchaseWeapon, repairWeapon, setSelectedHealingLoadout } from '../../src/engine/loadout'

function createState() {
  const state = createInitialState(0)
  return {
    ...state,
    coins: 1_000,
  }
}

describe('loadout transactions', () => {
  it('buys and equips a weapon from the catalog', () => {
    const purchase = purchaseWeapon(createState(), 'crowbar_of_minor_confidence', 0)
    expect(purchase).not.toBeNull()
    expect(purchase?.state.coins).toBe(935)
    expect(purchase?.state.ownedWeapons).toEqual([
      expect.objectContaining({ weaponId: 'tea_kettle' }),
      expect.objectContaining({ weaponId: 'crowbar_of_minor_confidence', durability: 10 }),
    ])

    const equipped = equipWeapon(purchase!.state, 'crowbar_of_minor_confidence', 0)
    expect(equipped).not.toBeNull()
    expect(equipped?.state.raid.equippedWeaponId).toBe('crowbar_of_minor_confidence')
  })

  it('repairs an owned weapon when enough coins are available', () => {
    const initial = createState()
    const damaged = {
      ...initial,
      coins: 100,
      ownedWeapons: [
        { weaponId: 'tea_kettle', durability: 2 },
        { weaponId: 'meeting_room_bat', durability: 3 },
      ],
    }

    const repaired = repairWeapon(damaged, 'meeting_room_bat', 0)
    expect(repaired).not.toBeNull()
    expect(repaired?.state.coins).toBe(70)
    expect(repaired?.state.ownedWeapons.find(entry => entry.weaponId === 'meeting_room_bat')).toEqual({
      weaponId: 'meeting_room_bat',
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

  it('wears the equipped weapon down after a raid and breaks it at zero durability', () => {
    const wornState = {
      ...createState(),
      raid: {
        ...createState().raid,
        equippedWeaponId: 'crowbar_of_minor_confidence',
      },
      ownedWeapons: [
        { weaponId: 'tea_kettle', durability: 8 },
        { weaponId: 'crowbar_of_minor_confidence', durability: 1 },
      ],
    }

    const broken = applyRaidWeaponWear(wornState, 0)
    expect(broken).not.toBeNull()
    expect(broken?.state.ownedWeapons.some(entry => entry.weaponId === 'crowbar_of_minor_confidence')).toBe(false)
    expect(broken?.state.raid.equippedWeaponId).toBe('tea_kettle')
    expect(broken?.event.id).toBe('weapon_broken_crowbar_of_minor_confidence')
  })

  it('loses the equipped weapon on failed raid recovery', () => {
    const failedState = {
      ...createState(),
      raid: {
        ...createState().raid,
        equippedWeaponId: 'meeting_room_bat',
      },
      ownedWeapons: [
        { weaponId: 'tea_kettle', durability: 8 },
        { weaponId: 'meeting_room_bat', durability: 12 },
      ],
    }

    const lost = applyFailedRaidWeaponLoss(failedState, 0)
    expect(lost).not.toBeNull()
    expect(lost?.state.ownedWeapons.some(entry => entry.weaponId === 'meeting_room_bat')).toBe(false)
    expect(lost?.state.raid.equippedWeaponId).toBe('tea_kettle')
    expect(lost?.event.id).toBe('weapon_lost_meeting_room_bat')
  })
})
