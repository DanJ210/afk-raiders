import healingItemsData from '../content/healing_items.json'
import shieldRechargersData from '../content/shield_rechargers.json'
import type { BackpackItem, GameState, HealingItem, HealingItemStack, LogEvent, OwnedWeapon, ShieldRechargerItem, ShieldRechargerStack } from './types.js'
import { CommsPriority } from './types.js'
import { findWeapon, getDefaultWeapon, getWeaponCatalog as resolveWeaponCatalog } from './weapons.js'

const healingCatalog = healingItemsData as HealingItem[]
const shieldRechargerCatalog = shieldRechargersData as ShieldRechargerItem[]

export interface LoadoutTransactionResult {
  state: GameState
  event: LogEvent
}

function createPurchaseEvent(id: string, tick: number, timestamp: number, text: string): LogEvent {
  return {
    id,
    tick,
    timestamp,
    text,
    phase: 'HUB',
    commsPriority: CommsPriority.Priority,
  }
}

function normalizeQuantity(quantity: number | undefined): number {
  if (!Number.isFinite(quantity ?? NaN)) return 1
  return Math.max(1, Math.floor(quantity ?? 1))
}

function mergeHealingStacks(stacks: HealingItemStack[], nextStack: HealingItemStack): HealingItemStack[] {
  const existing = stacks.find(stack => stack.itemId === nextStack.itemId)
  if (!existing) return [...stacks, nextStack]

  return stacks.map(stack => stack.itemId === nextStack.itemId
    ? { ...stack, quantity: stack.quantity + nextStack.quantity }
    : stack,
  )
}

function removeHealingStackQuantity(stacks: HealingItemStack[], itemId: string, quantity: number): HealingItemStack[] {
  const existing = stacks.find(stack => stack.itemId === itemId)
  if (!existing || existing.quantity < quantity) return stacks

  return stacks.flatMap(stack => {
    if (stack.itemId !== itemId) return [stack]
    const nextQuantity = stack.quantity - quantity
    return nextQuantity > 0 ? [{ ...stack, quantity: nextQuantity }] : []
  })
}

function mergeShieldRechargerStacks(stacks: ShieldRechargerStack[], nextStack: ShieldRechargerStack): ShieldRechargerStack[] {
  const existing = stacks.find(stack => stack.itemId === nextStack.itemId)
  if (!existing) return [...stacks, nextStack]

  return stacks.map(stack => stack.itemId === nextStack.itemId
    ? { ...stack, quantity: stack.quantity + nextStack.quantity }
    : stack,
  )
}

function normalizeOwnedWeaponEntry(weapon: ReturnType<typeof findWeapon>, existing: OwnedWeapon | undefined): OwnedWeapon | null {
  if (!weapon) return null
  return {
    weaponId: weapon.id,
    durability: existing ? Math.max(0, Math.min(weapon.durabilityMax, existing.durability)) : weapon.durabilityMax,
  }
}

export function getHealingCatalog(): HealingItem[] {
  return healingCatalog
}

export function getWeaponCatalog() {
  return resolveWeaponCatalog()
}

export function getShieldRechargerCatalog(): ShieldRechargerItem[] {
  return shieldRechargerCatalog
}

export function findHealingItem(itemId: string | null | undefined): HealingItem | null {
  if (!itemId) return null
  return healingCatalog.find(item => item.id === itemId) ?? null
}

export function findShieldRecharger(itemId: string | null | undefined): ShieldRechargerItem | null {
  if (!itemId) return null
  return shieldRechargerCatalog.find(item => item.id === itemId) ?? null
}

export function getWeaponPurchaseCost(weaponId: string | null | undefined): number {
  const weapon = findWeapon(weaponId)
  return weapon?.value ?? 0
}

export function getWeaponRepairCost(weaponId: string | null | undefined): number {
  const weapon = findWeapon(weaponId)
  return weapon?.repairCost ?? 0
}

export function getHealingPurchaseCost(itemId: string | null | undefined): number {
  const item = findHealingItem(itemId)
  return item?.purchaseCost ?? 0
}

export function getShieldRechargerPurchaseCost(itemId: string | null | undefined): number {
  const item = findShieldRecharger(itemId)
  return item?.value ?? 0
}

export function purchaseWeapon(state: GameState, weaponId: string, now: number): LoadoutTransactionResult | null {
  const weapon = findWeapon(weaponId)
  if (!weapon || state.coins < weapon.value) return null

  const ownedWeapon = normalizeOwnedWeaponEntry(weapon, state.ownedWeapons.find(entry => entry.weaponId === weapon.id))
  if (!ownedWeapon) return null

  return {
    state: {
      ...state,
      coins: state.coins - weapon.value,
      ownedWeapons: state.ownedWeapons.some(entry => entry.weaponId === weapon.id)
        ? state.ownedWeapons.map(entry => entry.weaponId === weapon.id ? ownedWeapon : entry)
        : [...state.ownedWeapons, ownedWeapon],
    },
    event: createPurchaseEvent(
      `weapon_purchase_${weapon.id}`,
      state.tick,
      now,
      `Purchased ${weapon.name} for ${weapon.value} coins. It will probably complain less than the old one.`,
    ),
  }
}

export function equipWeapon(state: GameState, weaponId: string, now: number): LoadoutTransactionResult | null {
  const weapon = findWeapon(weaponId)
  if (!weapon) return null
  const owned = state.ownedWeapons.find(entry => entry.weaponId === weapon.id)
  if (!owned) return null

  return {
    state: {
      ...state,
      raid: {
        ...state.raid,
        equippedWeaponId: weapon.id,
      },
    },
    event: createPurchaseEvent(
      `weapon_equipped_${weapon.id}`,
      state.tick,
      now,
      `Equipped ${weapon.name} for the next deployment. The raider approved the vibes.`,
    ),
  }
}

export function repairWeapon(state: GameState, weaponId: string, now: number): LoadoutTransactionResult | null {
  const weapon = findWeapon(weaponId)
  if (!weapon) return null
  const owned = state.ownedWeapons.find(entry => entry.weaponId === weapon.id)
  if (!owned || owned.durability >= weapon.durabilityMax || state.coins < weapon.repairCost) return null

  return {
    state: {
      ...state,
      coins: state.coins - weapon.repairCost,
      ownedWeapons: state.ownedWeapons.map(entry => entry.weaponId === weapon.id
        ? { ...entry, durability: weapon.durabilityMax }
        : entry,
      ),
    },
    event: createPurchaseEvent(
      `weapon_repaired_${weapon.id}`,
      state.tick,
      now,
      `Repaired ${weapon.name} for ${weapon.repairCost} coins. The maintenance budget cried quietly.`,
    ),
  }
}

export function purchaseHealingItem(state: GameState, itemId: string, quantity: number, now: number): LoadoutTransactionResult | null {
  const item = findHealingItem(itemId)
  const stackQuantity = normalizeQuantity(quantity)
  const totalCost = item?.purchaseCost ? item.purchaseCost * stackQuantity : 0
  if (!item || state.coins < totalCost) return null

  const nextStack: HealingItemStack = {
    itemId: item.id,
    name: item.name,
    healAmount: item.healAmount,
    reviveAmount: item.reviveAmount,
    moodGain: item.moodGain,
    rarity: item.rarity,
    flavor: item.flavor,
    quantity: stackQuantity,
  }

  return {
    state: {
      ...state,
      coins: state.coins - totalCost,
      purchasedHealingItems: mergeHealingStacks(state.purchasedHealingItems, nextStack),
    },
    event: createPurchaseEvent(
      `healing_purchase_${item.id}`,
      state.tick,
      now,
      `Bought ${stackQuantity}x ${item.name} for ${totalCost} coins. Medicine is cheaper than regret.`,
    ),
  }
}

export function purchaseShieldRecharger(state: GameState, itemId: string, quantity: number, now: number): LoadoutTransactionResult | null {
  const item = findShieldRecharger(itemId)
  const stackQuantity = normalizeQuantity(quantity)
  const totalCost = item?.value ? item.value * stackQuantity : 0
  if (!item || state.coins < totalCost) return null

  const nextStack: ShieldRechargerStack = {
    itemId: item.id,
    name: item.name,
    value: item.value,
    chargeAmount: item.chargeAmount,
    applyTicks: item.applyTicks,
    rarity: item.rarity,
    flavor: item.flavor,
    quantity: stackQuantity,
  }

  return {
    state: {
      ...state,
      coins: state.coins - totalCost,
      purchasedShieldRechargers: mergeShieldRechargerStacks(state.purchasedShieldRechargers, nextStack),
    },
    event: createPurchaseEvent(
      `shield_recharger_purchase_${item.id}`,
      state.tick,
      now,
      `Bought ${stackQuantity}x ${item.name} for ${totalCost} coins. The shield budget called this proactive optimism.`,
    ),
  }
}

export function setSelectedHealingLoadout(state: GameState, selections: Array<{ itemId: string; quantity: number }>, now: number): LoadoutTransactionResult | null {
  if (state.raid.phase !== 'HUB') return null

  const resolvedSelections = selections
    .map(selection => ({
      item: findHealingItem(selection.itemId),
      quantity: normalizeQuantity(selection.quantity),
    }))
    .filter((selection): selection is { item: HealingItem; quantity: number } => Boolean(selection.item))

  if (resolvedSelections.length === 0) {
    return clearSelectedHealingLoadout(state, now)
  }

  const selectedHealingLoadout: HealingItemStack[] = []

  for (const selection of resolvedSelections) {
    const available = state.purchasedHealingItems.find(entry => entry.itemId === selection.item.id)
    if (!available || available.quantity < selection.quantity) return null
    selectedHealingLoadout.push({
      itemId: selection.item.id,
      name: selection.item.name,
      healAmount: selection.item.healAmount,
      reviveAmount: selection.item.reviveAmount,
      moodGain: selection.item.moodGain,
      rarity: selection.item.rarity,
      flavor: selection.item.flavor,
      quantity: selection.quantity,
    })
  }

  return {
    state: {
      ...state,
      raid: {
        ...state.raid,
        selectedHealingLoadout,
      },
    },
    event: createPurchaseEvent('healing_loadout_selected', state.tick, now, 'Locked in the pre-raid med loadout. Nothing says confidence like a curated pill pouch.'),
  }
}

export function clearSelectedHealingLoadout(state: GameState, now: number): LoadoutTransactionResult | null {
  if (state.raid.phase !== 'HUB') return null

  return {
    state: {
      ...state,
      raid: {
        ...state.raid,
        selectedHealingLoadout: [],
      },
    },
    event: createPurchaseEvent('healing_loadout_cleared', state.tick, now, 'Cleared the pre-raid med loadout. The bag looks emotionally lighter now.'),
  }
}

export function setSelectedShieldRechargerLoadout(
  state: GameState,
  selections: Array<{ itemId: string; quantity: number }>,
  now: number,
): LoadoutTransactionResult | null {
  if (state.raid.phase !== 'HUB') return null

  const resolvedSelections = selections
    .map(selection => ({
      item: findShieldRecharger(selection.itemId),
      quantity: normalizeQuantity(selection.quantity),
    }))
    .filter((selection): selection is { item: ShieldRechargerItem; quantity: number } => Boolean(selection.item))

  if (resolvedSelections.length === 0) {
    return clearSelectedShieldRechargerLoadout(state, now)
  }

  const selectedShieldRechargerLoadout: ShieldRechargerStack[] = []

  for (const selection of resolvedSelections) {
    const available = state.purchasedShieldRechargers.find(entry => entry.itemId === selection.item.id)
    if (!available || available.quantity < selection.quantity) return null
    selectedShieldRechargerLoadout.push({
      itemId: selection.item.id,
      name: selection.item.name,
      value: selection.item.value,
      chargeAmount: selection.item.chargeAmount,
      applyTicks: selection.item.applyTicks,
      rarity: selection.item.rarity,
      flavor: selection.item.flavor,
      quantity: selection.quantity,
    })
  }

  return {
    state: {
      ...state,
      raid: {
        ...state.raid,
        selectedShieldRechargerLoadout,
      },
    },
    event: createPurchaseEvent('shield_recharger_loadout_selected', state.tick, now, 'Shield recharger loadout staged. Future panic now has battery support.'),
  }
}

export function clearSelectedShieldRechargerLoadout(state: GameState, now: number): LoadoutTransactionResult | null {
  if (state.raid.phase !== 'HUB') return null

  return {
    state: {
      ...state,
      raid: {
        ...state.raid,
        selectedShieldRechargerLoadout: [],
      },
    },
    event: createPurchaseEvent('shield_recharger_loadout_cleared', state.tick, now, 'Cleared staged shield rechargers. We are raw-dogging mitigation again.'),
  }
}

export function consumeSelectedHealingLoadout(state: GameState): GameState {
  const selected = state.raid.selectedHealingLoadout
  if (selected.length === 0) return state

  let nextPurchased = [...state.purchasedHealingItems]
  for (const item of selected) {
    nextPurchased = removeHealingStackQuantity(nextPurchased, item.itemId, item.quantity)
  }

  return {
    ...state,
    purchasedHealingItems: nextPurchased,
    raid: {
      ...state.raid,
      healingItems: selected.map(item => ({ ...item })),
      selectedHealingLoadout: [],
    },
  }
}

function consumeSelectedShieldRechargerLoadout(state: GameState): GameState {
  const selected = state.raid.selectedShieldRechargerLoadout
  if (selected.length === 0) return state

  const stagedBackpackItems: BackpackItem[] = selected.map(item => {
    const existing = state.raid.backpack.find(entry => entry.itemId === item.itemId)
    const existingLoadoutQuantity = existing
      ? Math.max(0, Math.min(existing.quantity, Math.floor(existing.fromLoadoutQuantity ?? (existing.fromLoadout ? existing.quantity : 0))))
      : 0
    const quantity = existing ? existing.quantity + item.quantity : item.quantity

    return {
      itemId: item.itemId,
      name: item.name,
      value: item.value,
      rarity: item.rarity,
      flavor: item.flavor,
      quantity,
      kind: 'shield_recharger',
      shieldChargeAmount: item.chargeAmount,
      applyTicks: item.applyTicks,
      fromLoadout: existingLoadoutQuantity + item.quantity > 0,
      fromLoadoutQuantity: existingLoadoutQuantity + item.quantity,
    }
  })

  const nextBackpack = state.raid.backpack
    .filter(entry => !stagedBackpackItems.some(staged => staged.itemId === entry.itemId))
    .concat(stagedBackpackItems)

  return {
    ...state,
    raid: {
      ...state.raid,
      backpack: nextBackpack,
    },
  }
}

export function consumeSelectedPreparationLoadouts(state: GameState): GameState {
  const withHealing = {
    ...state,
    raid: {
      ...state.raid,
      healingItems: state.raid.selectedHealingLoadout.map(item => ({
        itemId: item.itemId,
        name: item.name,
        healAmount: item.healAmount,
        reviveAmount: item.reviveAmount,
        moodGain: item.moodGain,
        rarity: item.rarity,
        flavor: item.flavor,
        quantity: item.quantity,
        fromLoadout: true,
      })),
    },
  }
  return consumeSelectedShieldRechargerLoadout(withHealing)
}

function getFallbackEquippedWeaponId(state: GameState, removedWeaponId: string): string {
  const nextOwnedWeapon = state.ownedWeapons.find(entry => entry.weaponId !== removedWeaponId)
  return nextOwnedWeapon?.weaponId ?? getDefaultWeapon().id
}

function ensureFallbackWeaponOwned(ownedWeapons: OwnedWeapon[], fallbackWeaponId: string): OwnedWeapon[] {
  if (ownedWeapons.some(entry => entry.weaponId === fallbackWeaponId)) return ownedWeapons

  const fallbackWeapon = findWeapon(fallbackWeaponId)
  const normalizedFallback = normalizeOwnedWeaponEntry(fallbackWeapon, undefined)
  if (!normalizedFallback) return ownedWeapons

  return [...ownedWeapons, normalizedFallback]
}

export function applyRaidWeaponWear(state: GameState, now: number): LoadoutTransactionResult | null {
  const weapon = findWeapon(state.raid.equippedWeaponId)
  if (!weapon) return null

  const ownedIndex = state.ownedWeapons.findIndex(entry => entry.weaponId === weapon.id)
  if (ownedIndex < 0) return null

  const ownedWeapon = state.ownedWeapons[ownedIndex]
  if (ownedWeapon.durability <= 1) {
    const nextOwnedWeapons = state.ownedWeapons.filter(entry => entry.weaponId !== weapon.id)
    const nextEquippedWeaponId = getFallbackEquippedWeaponId(state, weapon.id)
    const nextOwnedWeaponsWithFallback = ensureFallbackWeaponOwned(nextOwnedWeapons, nextEquippedWeaponId)

    return {
      state: {
        ...state,
        ownedWeapons: nextOwnedWeaponsWithFallback,
        raid: {
          ...state.raid,
          equippedWeaponId: nextEquippedWeaponId,
        },
      },
      event: createPurchaseEvent(
        `weapon_broken_${weapon.id}`,
        state.tick,
        now,
        `${weapon.name} broke after the raid. It has been promoted to scrap and emotional baggage.`,
      ),
    }
  }

  const nextDurability = ownedWeapon.durability - 1
  return {
    state: {
      ...state,
      ownedWeapons: state.ownedWeapons.map(entry => entry.weaponId === weapon.id
        ? { ...entry, durability: nextDurability }
        : entry,
      ),
    },
    event: createPurchaseEvent(
      `weapon_worn_${weapon.id}`,
      state.tick,
      now,
      `${weapon.name} took 1 durability damage. ${nextDurability}/${weapon.durabilityMax} remains.`,
    ),
  }
}

export function applyFailedRaidWeaponLoss(state: GameState, now: number): LoadoutTransactionResult | null {
  const weapon = findWeapon(state.raid.equippedWeaponId)
  if (!weapon) return null

  const owned = state.ownedWeapons.find(entry => entry.weaponId === weapon.id)
  if (!owned) return null

  const nextOwnedWeapons = state.ownedWeapons.filter(entry => entry.weaponId !== weapon.id)
  const nextEquippedWeaponId = getFallbackEquippedWeaponId(state, weapon.id)
  const nextOwnedWeaponsWithFallback = ensureFallbackWeaponOwned(nextOwnedWeapons, nextEquippedWeaponId)

  return {
    state: {
      ...state,
      ownedWeapons: nextOwnedWeaponsWithFallback,
      raid: {
        ...state.raid,
        equippedWeaponId: nextEquippedWeaponId,
      },
    },
    event: createPurchaseEvent(
      `weapon_lost_${weapon.id}`,
      state.tick,
      now,
      `${weapon.name} was lost in the failed raid. The raider called it "tactical subtraction."`,
    ),
  }
}

export function getStarterWeaponId(): string {
  return getDefaultWeapon().id
}
