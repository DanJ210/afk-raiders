import { computed } from 'vue'
import {
  getHealingCatalog,
  getHealingPurchaseCost,
  getShieldRechargerCatalog,
  getShieldRechargerPurchaseCost,
  getWeaponCatalog,
  getWeaponPurchaseCost,
  getWeaponRepairCost,
} from '../engine/loadout.js'
import { useGameStore } from '../stores/gameStore'

export interface PreparationViewModelOptions {
  confirm?: (message: string) => boolean | Promise<boolean>
}

export function usePreparationViewModel(options?: PreparationViewModelOptions) {
  const store = useGameStore()
  const weaponCatalog = getWeaponCatalog()
  const healingCatalog = getHealingCatalog()
  const shieldRechargerCatalog = getShieldRechargerCatalog()
  const confirmDialog = options?.confirm ?? ((message: string) => window.confirm(message))

  const coins = computed(() => store.state.coins)
  const isHubPhase = computed(() => store.phase === 'HUB')
  const equippedWeaponId = computed(() => store.raid.equippedWeaponId)
  const ownedWeapons = computed(() => store.ownedWeapons)
  const purchasedHealingItems = computed(() => store.purchasedHealingItems)
  const purchasedShieldRechargers = computed(() => store.purchasedShieldRechargers)
  const selectedHealingLoadout = computed(() => store.selectedHealingLoadout)
  const selectedShieldRechargerLoadout = computed(() => store.selectedShieldRechargerLoadout)

  function ownedWeapon(weaponId: string) {
    return ownedWeapons.value.find(weapon => weapon.weaponId === weaponId) ?? null
  }

  function purchasedHealingItem(itemId: string) {
    return purchasedHealingItems.value.find(item => item.itemId === itemId) ?? null
  }

  function selectedHealingQuantity(itemId: string) {
    return selectedHealingLoadout.value.find(item => item.itemId === itemId)?.quantity ?? 0
  }

  function purchasedShieldRechargerItem(itemId: string) {
    return purchasedShieldRechargers.value.find(item => item.itemId === itemId) ?? null
  }

  function selectedShieldRechargerQuantity(itemId: string) {
    return selectedShieldRechargerLoadout.value.find(item => item.itemId === itemId)?.quantity ?? 0
  }

  async function purchaseWeapon(weaponId: string) {
    if (!isHubPhase.value) return

    const cost = getWeaponPurchaseCost(weaponId)
    const weapon = weaponCatalog.find(entry => entry.id === weaponId)
    if (!weapon) return

    const confirmed = await confirmDialog(
      `Buy ${weapon.name} for ${cost.toLocaleString()} coins?\n\nEquipped weapons can be lost on failed raids.`,
    )
    if (!confirmed) return

    store.purchaseWeapon(weaponId)
  }

  async function repairWeapon(weaponId: string) {
    if (!isHubPhase.value) return

    const cost = getWeaponRepairCost(weaponId)
    const weapon = weaponCatalog.find(entry => entry.id === weaponId)
    if (!weapon) return

    const confirmed = await confirmDialog(
      `Repair ${weapon.name} for ${cost.toLocaleString()} coins?`,
    )
    if (!confirmed) return

    store.repairWeapon(weaponId)
  }

  async function equipWeapon(weaponId: string) {
    if (!isHubPhase.value) return

    const weapon = weaponCatalog.find(entry => entry.id === weaponId)
    if (!weapon) return

    const confirmed = await confirmDialog(
      `Equip ${weapon.name} for the next raid?\n\nIf the raid fails, this equipped weapon can be lost.`,
    )
    if (!confirmed) return

    store.equipWeapon(weaponId)
  }

  async function purchaseHealingItem(itemId: string) {
    if (!isHubPhase.value) return

    const item = healingCatalog.find(entry => entry.id === itemId)
    if (!item) return

    const cost = getHealingPurchaseCost(itemId)
    const confirmed = await confirmDialog(
      `Buy 1 ${item.name} for ${cost.toLocaleString()} coins?\n\nStaged loadout items stay configured on successful return and are cleared on KNOCKED_OUT.`,
    )
    if (!confirmed) return

    store.purchaseHealingItem(itemId, 1)
  }

  async function purchaseShieldRecharger(itemId: string) {
    if (!isHubPhase.value) return

    const item = shieldRechargerCatalog.find(entry => entry.id === itemId)
    if (!item) return

    const cost = getShieldRechargerPurchaseCost(itemId)
    const confirmed = await confirmDialog(
      `Buy 1 ${item.name} for ${cost.toLocaleString()} coins?\n\nStaged loadout items stay configured on successful return and are cleared on KNOCKED_OUT.`,
    )
    if (!confirmed) return

    store.purchaseShieldRecharger(itemId, 1)
  }

  function addHealingToLoadout(itemId: string) {
    if (!isHubPhase.value) return

    const available = purchasedHealingItem(itemId)
    if (!available) return

    const current = selectedHealingQuantity(itemId)
    if (current >= available.quantity) return

    const next = selectedHealingLoadout.value.filter(item => item.itemId !== itemId)
    next.push({ ...available, quantity: current + 1 })
    store.setSelectedHealingLoadout(next.map(item => ({ itemId: item.itemId, quantity: item.quantity })))
  }

  function removeHealingFromLoadout(itemId: string) {
    if (!isHubPhase.value) return

    const current = selectedHealingQuantity(itemId)
    if (current <= 0) return

    const next = selectedHealingLoadout.value
      .filter(item => item.itemId !== itemId)
      .map(item => ({ itemId: item.itemId, quantity: item.quantity }))

    if (current > 1) {
      next.push({ itemId, quantity: current - 1 })
    }

    store.setSelectedHealingLoadout(next)
  }

  function addShieldRechargerToLoadout(itemId: string) {
    if (!isHubPhase.value) return

    const available = purchasedShieldRechargerItem(itemId)
    if (!available) return

    const current = selectedShieldRechargerQuantity(itemId)
    if (current >= available.quantity) return

    const next = selectedShieldRechargerLoadout.value.filter(item => item.itemId !== itemId)
    next.push({ ...available, quantity: current + 1 })
    store.setSelectedShieldRechargerLoadout(next.map(item => ({ itemId: item.itemId, quantity: item.quantity })))
  }

  function removeShieldRechargerFromLoadout(itemId: string) {
    if (!isHubPhase.value) return

    const current = selectedShieldRechargerQuantity(itemId)
    if (current <= 0) return

    const next = selectedShieldRechargerLoadout.value
      .filter(item => item.itemId !== itemId)
      .map(item => ({ itemId: item.itemId, quantity: item.quantity }))

    if (current > 1) {
      next.push({ itemId, quantity: current - 1 })
    }

    store.setSelectedShieldRechargerLoadout(next)
  }

  async function clearLoadout() {
    if (!isHubPhase.value) return

    const confirmed = await confirmDialog(
      'Clear the selected medical loadout?\n\nOnly staged loadout items are cleared. Purchased stock remains in storage.',
    )
    if (!confirmed) return

    store.clearSelectedHealingLoadout()
  }

  async function clearShieldRechargerLoadout() {
    if (!isHubPhase.value) return

    const confirmed = await confirmDialog(
      'Clear the selected shield recharger loadout?\n\nOnly staged loadout items are cleared. Purchased stock remains in storage.',
    )
    if (!confirmed) return

    store.clearSelectedShieldRechargerLoadout()
  }

  return {
    weaponCatalog,
    healingCatalog,
    shieldRechargerCatalog,
    coins,
    isHubPhase,
    equippedWeaponId,
    ownedWeapons,
    purchasedHealingItems,
    purchasedShieldRechargers,
    selectedHealingLoadout,
    selectedShieldRechargerLoadout,
    ownedWeapon,
    purchasedHealingItem,
    selectedHealingQuantity,
    purchasedShieldRechargerItem,
    selectedShieldRechargerQuantity,
    purchaseWeapon,
    repairWeapon,
    equipWeapon,
    purchaseHealingItem,
    purchaseShieldRecharger,
    addHealingToLoadout,
    removeHealingFromLoadout,
    addShieldRechargerToLoadout,
    removeShieldRechargerFromLoadout,
    clearLoadout,
    clearShieldRechargerLoadout,
    getWeaponPurchaseCost,
    getWeaponRepairCost,
    getHealingPurchaseCost,
    getShieldRechargerPurchaseCost,
  }
}
