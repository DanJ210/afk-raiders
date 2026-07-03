<script setup lang="ts">
import { formatNumber } from '../utils/stash'
import { usePreparationViewModel } from '../composables/usePreparationViewModel'

const {
  weaponCatalog,
  healingCatalog,
  coins,
  isHubPhase,
  equippedWeaponId,
  selectedHealingLoadout,
  ownedWeapon,
  purchasedHealingItem,
  selectedHealingQuantity,
  purchaseWeapon,
  repairWeapon,
  equipWeapon,
  purchaseHealingItem,
  addHealingToLoadout,
  removeHealingFromLoadout,
  clearLoadout,
  getWeaponPurchaseCost,
  getWeaponRepairCost,
  getHealingPurchaseCost,
} = usePreparationViewModel()
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
                  :disabled="equippedWeaponId === weapon.id || !isHubPhase"
                  @click="equipWeapon(weapon.id)"
                >{{ equippedWeaponId === weapon.id ? 'Equipped' : 'Equip' }}</button>
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
