<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/gameStore'
import { getHealingCatalog, getHealingPurchaseCost, getWeaponCatalog, getWeaponPurchaseCost, getWeaponRepairCost } from '../engine/loadout'
import { formatNumber } from '../utils/stash'

const store = useGameStore()
const weaponCatalog = getWeaponCatalog()
const healingCatalog = getHealingCatalog()

const coins = computed(() => store.state.coins)
const isHubPhase = computed(() => store.phase === 'HUB')
const ownedWeapons = computed(() => store.ownedWeapons)
const purchasedHealingItems = computed(() => store.purchasedHealingItems)
const selectedHealingLoadout = computed(() => store.selectedHealingLoadout)

function ownedWeapon(weaponId: string) {
  return ownedWeapons.value.find(weapon => weapon.weaponId === weaponId) ?? null
}

function purchasedHealingItem(itemId: string) {
  return purchasedHealingItems.value.find(item => item.itemId === itemId) ?? null
}

function selectedHealingQuantity(itemId: string) {
  return selectedHealingLoadout.value.find(item => item.itemId === itemId)?.quantity ?? 0
}

function purchaseWeapon(weaponId: string) {
  const cost = getWeaponPurchaseCost(weaponId)
  const weapon = weaponCatalog.find(entry => entry.id === weaponId)
  if (!weapon) return
  const confirmed = window.confirm(
    `Buy ${weapon.name} for ${formatNumber(cost)} coins?\n\nEquipped weapons can be lost on failed raids.`,
  )
  if (!confirmed) return

  store.purchaseWeapon(weaponId)
}

function repairWeapon(weaponId: string) {
  const cost = getWeaponRepairCost(weaponId)
  const weapon = weaponCatalog.find(entry => entry.id === weaponId)
  if (!weapon) return
  const confirmed = window.confirm(
    `Repair ${weapon.name} for ${formatNumber(cost)} coins?`,
  )
  if (!confirmed) return

  store.repairWeapon(weaponId)
}

function equipWeapon(weaponId: string) {
  const weapon = weaponCatalog.find(entry => entry.id === weaponId)
  if (!weapon) return
  const confirmed = window.confirm(
    `Equip ${weapon.name} for the next raid?\n\nIf the raid fails, this equipped weapon can be lost.`,
  )
  if (!confirmed) return

  store.equipWeapon(weaponId)
}

function purchaseHealingItem(itemId: string) {
  const item = healingCatalog.find(entry => entry.id === itemId)
  if (!item) return
  const cost = getHealingPurchaseCost(itemId)
  const confirmed = window.confirm(
    `Buy 1 ${item.name} for ${formatNumber(cost)} coins?\n\nLoadout meds are consumed on deployment and are lost if the raid fails.`,
  )
  if (!confirmed) return

  store.purchaseHealingItem(itemId, 1)
}

function addHealingToLoadout(itemId: string) {
  const available = purchasedHealingItem(itemId)
  if (!available) return
  const current = selectedHealingQuantity(itemId)
  if (current >= available.quantity) return

  const next = selectedHealingLoadout.value.filter(item => item.itemId !== itemId)
  next.push({ ...available, quantity: current + 1 })
  store.setSelectedHealingLoadout(next.map(item => ({ itemId: item.itemId, quantity: item.quantity })))
}

function removeHealingFromLoadout(itemId: string) {
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

function clearLoadout() {
  const confirmed = window.confirm(
    'Clear the selected medical loadout?\n\nOnly staged loadout items are cleared. Purchased stock remains in storage.',
  )
  if (!confirmed) return

  store.clearSelectedHealingLoadout()
}
</script>

<template>
  <section class="preparation-panel panel-card shrink-0 max-[600px]:p-2.5" aria-label="Preparation">
    <header class="section-header">PREPARATION</header>

    <div class="grid grid-cols-2 gap-2 mb-3">
      <div class="flex flex-col gap-1 bg-surface-raised p-2 rounded">
        <span class="text-raider-tiny text-muted font-mono">Coin Stash</span>
        <span class="text-[1rem] font-bold text-text font-mono">{{ formatNumber(coins) }}</span>
      </div>
      <div class="flex flex-col gap-1 bg-surface-raised p-2 rounded">
        <span class="text-raider-tiny text-muted font-mono">Selected Meds</span>
        <span class="text-[1rem] font-bold text-text font-mono">{{ selectedHealingLoadout.length }}</span>
      </div>
    </div>

    <div class="mb-3 rounded border border-border-subtle bg-surface-raised p-2">
      <p class="m-0 font-mono text-[0.65rem] leading-snug text-muted">
        Loadout warning: healing items moved into loadout are consumed when deployment starts.
      </p>
      <p class="m-0 mt-1 font-mono text-[0.65rem] leading-snug text-muted">
        Failure warning: the currently equipped weapon can be lost when a raid ends in KNOCKED_OUT.
      </p>
    </div>

    <div class="grid gap-3">
      <section>
        <h3 class="m-0 mb-2 font-mono text-[0.78rem] text-accent uppercase tracking-[0.08em]">Weapons</h3>
        <div class="grid gap-2">
          <article v-for="weapon in weaponCatalog" :key="weapon.id" class="rounded border border-border-subtle bg-surface-raised p-2">
            <div class="flex items-baseline justify-between gap-2">
              <h4 class="m-0 font-mono text-[0.78rem] font-bold text-text">{{ weapon.name }}</h4>
              <span class="font-mono text-[0.68rem] text-muted">{{ weapon.damageMin }}-{{ weapon.damageMax }} dmg</span>
            </div>
            <p class="m-0 mt-1 font-mono text-[0.66rem] leading-snug text-muted">{{ weapon.flavor }}</p>
            <div class="mt-2 flex flex-wrap items-center gap-2 text-[0.66rem] font-mono text-muted">
              <span>Tier {{ weapon.rarity }}</span>
              <span>Durability {{ weapon.durabilityMax }}</span>
              <span>Repair {{ formatNumber(getWeaponRepairCost(weapon.id)) }}</span>
              <span>Buy {{ formatNumber(getWeaponPurchaseCost(weapon.id)) }}</span>
            </div>
            <div class="mt-2 flex flex-wrap gap-2">
              <button
                v-if="!ownedWeapon(weapon.id)"
                type="button"
                class="rounded border border-border px-2 py-1 font-mono text-[0.68rem] text-text bg-transparent cursor-pointer disabled:opacity-50"
                :disabled="coins < getWeaponPurchaseCost(weapon.id) || !isHubPhase"
                @click="purchaseWeapon(weapon.id)"
              >Buy</button>
              <template v-else>
                <button
                  type="button"
                  class="rounded border border-border px-2 py-1 font-mono text-[0.68rem] text-text bg-transparent cursor-pointer disabled:opacity-50"
                  :disabled="store.raid.equippedWeaponId === weapon.id || !isHubPhase"
                  @click="equipWeapon(weapon.id)"
                >{{ store.raid.equippedWeaponId === weapon.id ? 'Equipped' : 'Equip' }}</button>
                <button
                  type="button"
                  class="rounded border border-border px-2 py-1 font-mono text-[0.68rem] text-text bg-transparent cursor-pointer disabled:opacity-50"
                  :disabled="coins < getWeaponRepairCost(weapon.id) || ownedWeapon(weapon.id)?.durability === weapon.durabilityMax || !isHubPhase"
                  @click="repairWeapon(weapon.id)"
                >Repair</button>
                <span v-if="ownedWeapon(weapon.id)" class="self-center font-mono text-[0.66rem] text-muted">Durability {{ ownedWeapon(weapon.id)?.durability }}/{{ weapon.durabilityMax }}</span>
              </template>
            </div>
          </article>
        </div>
      </section>

      <section>
        <div class="flex items-center justify-between gap-2 mb-2">
          <h3 class="m-0 font-mono text-[0.78rem] text-accent uppercase tracking-[0.08em]">Healing Stock</h3>
          <button
            type="button"
            class="rounded border border-border px-2 py-1 font-mono text-[0.66rem] text-text bg-transparent cursor-pointer disabled:opacity-50"
            :disabled="selectedHealingLoadout.length === 0 || !isHubPhase"
            @click="clearLoadout"
          >Clear Loadout</button>
        </div>

        <div class="grid gap-2">
          <article v-for="item in healingCatalog" :key="item.id" class="rounded border border-border-subtle bg-surface-raised p-2">
            <div class="flex items-baseline justify-between gap-2">
              <h4 class="m-0 font-mono text-[0.78rem] font-bold text-text">{{ item.name }}</h4>
              <span class="font-mono text-[0.68rem] text-muted">Tier {{ item.rarity }}</span>
            </div>
            <p class="m-0 mt-1 font-mono text-[0.66rem] leading-snug text-muted">{{ item.flavor }}</p>
            <div class="mt-2 flex flex-wrap items-center gap-2 text-[0.66rem] font-mono text-muted">
              <span>Heal {{ item.healAmount }}</span>
              <span v-if="item.reviveAmount">Revive {{ item.reviveAmount }}</span>
              <span>Buy {{ formatNumber(getHealingPurchaseCost(item.id)) }}</span>
              <span>Stock {{ purchasedHealingItem(item.id)?.quantity ?? 0 }}</span>
              <span>Loadout {{ selectedHealingQuantity(item.id) }}</span>
            </div>
            <div class="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded border border-border px-2 py-1 font-mono text-[0.68rem] text-text bg-transparent cursor-pointer disabled:opacity-50"
                :disabled="coins < getHealingPurchaseCost(item.id) || !isHubPhase"
                @click="purchaseHealingItem(item.id)"
              >Buy 1</button>
              <button
                type="button"
                class="rounded border border-border px-2 py-1 font-mono text-[0.68rem] text-text bg-transparent cursor-pointer disabled:opacity-50"
                :disabled="(purchasedHealingItem(item.id)?.quantity ?? 0) <= selectedHealingQuantity(item.id) || !isHubPhase"
                @click="addHealingToLoadout(item.id)"
              >Load +1</button>
              <button
                type="button"
                class="rounded border border-border px-2 py-1 font-mono text-[0.68rem] text-text bg-transparent cursor-pointer disabled:opacity-50"
                :disabled="selectedHealingQuantity(item.id) <= 0 || !isHubPhase"
                @click="removeHealingFromLoadout(item.id)"
              >Load -1</button>
            </div>
          </article>
        </div>
      </section>
    </div>
  </section>
</template>
