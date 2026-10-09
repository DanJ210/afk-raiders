<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '../stores/gameStore'
import { getTotalItemValue } from '../engine/homeStash'
import { getHealingCatalog, getHealingPurchaseCost, getShieldRechargerCatalog,
  getShieldRechargerPurchaseCost, getWeaponCatalog, getWeaponPurchaseCost } from '../engine/loadout'
import { formatNumber } from '../utils/stash'

const store = useGameStore()
const goals = [
  ...getWeaponCatalog().filter(item => getWeaponPurchaseCost(item.id) > 0).map(item => ({
    id: `weapon:${item.id}`, itemId: item.id, kind: 'weapon', name: item.name,
    cost: getWeaponPurchaseCost(item.id), effect: `${item.damageMin}-${item.damageMax} damage`,
  })),
  ...getHealingCatalog().map(item => ({
    id: `med:${item.id}`, itemId: item.id, kind: 'med', name: item.name,
    cost: getHealingPurchaseCost(item.id), effect: (item.reviveAmount ?? 0) > 0
      ? `Revives a DOWNED Raider to ${item.reviveAmount} HP`
      : `Restores up to ${Math.min(50, item.healAmount)} HP while alive`,
  })),
  ...getShieldRechargerCatalog().map(item => ({
    id: `shield:${item.id}`, itemId: item.id, kind: 'shield', name: item.name,
    cost: getShieldRechargerPurchaseCost(item.id), effect: `Restores ${item.chargeAmount} shield charge, not durability`,
  })),
]
const selectedId = ref(goals.find(goal => goal.kind === 'weapon'
  && !store.ownedWeapons.some(owned => owned.weaponId === goal.itemId))?.id ?? goals[0]?.id)
const goal = computed(() => goals.find(entry => entry.id === selectedId.value))
const shortfall = computed(() => goal.value ? Math.max(0, goal.value.cost - store.state.coins) : 0)
const stashValue = computed(() => getTotalItemValue(store.state.homeStash))
const alreadyOwned = computed(() => goal.value?.kind === 'weapon'
  && store.ownedWeapons.some(owned => owned.weaponId === goal.value?.itemId))
</script>

<template>
  <section v-if="goal" class="mb-3 rounded border border-accent bg-surface-raised p-2 font-mono text-raider-meta" aria-label="Preparation purchase goal">
    <label class="block text-accent mb-1">
      Next purchase goal
      <select v-model="selectedId" class="block w-full min-w-0 mt-1 bg-surface text-text border border-border rounded p-1">
        <option v-for="entry in goals" :key="entry.id" :value="entry.id">{{ entry.name }} · {{ formatNumber(entry.cost) }} coins</option>
      </select>
    </label>
    <p class="my-1 text-text">{{ goal.effect }}.</p>
    <p class="my-1 text-text">{{ formatNumber(store.state.coins) }} spendable coins / {{ formatNumber(goal.cost) }} cost.</p>
    <p v-if="alreadyOwned" class="my-1 text-success">Already owned. Equip or repair it below, or choose another goal.</p>
    <p v-else-if="shortfall === 0" class="my-1 text-success">
      {{ store.phase === 'HUB' ? 'Affordable now. Buy it below.' : 'Affordable. Purchase when the Raider returns to HUB.' }}
    </p>
    <p v-else class="my-1 text-warning">
      {{ formatNumber(shortfall) }} more coins needed.
      {{ stashValue >= shortfall ? 'Selling stash items can cover the shortfall.' : 'Secure more loot or coins to close the gap.' }}
    </p>
    <p class="my-1 text-muted">Unsold stash: {{ formatNumber(stashValue) }} value, not spendable coins. Purchases are manual and HUB-only; stage consumables for the next deployment.</p>
  </section>
</template>
