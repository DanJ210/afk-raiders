<script setup lang="ts">
import { rarityBarClass, rarityLabel } from '../utils/rarity'

interface ShieldRechargerViewModel {
  itemId: string
  name: string
  rarity: number
  quantity: number
  shieldChargeAmount: number
}

const props = defineProps<{
  items: ShieldRechargerViewModel[]
  canApply: boolean
}>()

const emit = defineEmits<{
  apply: [itemId: string]
}>()

function apply(itemId: string) {
  emit('apply', itemId)
}
</script>

<template>
  <div v-if="items.length > 0" class="shield-rechargers">
    <span class="shield-rechargers__label">Shield Rechargers</span>
    <ul class="shield-rechargers__list">
      <li v-for="item in items" :key="item.itemId" class="shield-rechargers__item">
        <span :class="rarityBarClass(item.rarity)" :title="rarityLabel(item.rarity)" aria-hidden="true" />
        <span class="shield-rechargers__name">{{ item.name }}</span>
        <span class="shield-rechargers__meta">{{ rarityLabel(item.rarity) }}</span>
        <span class="shield-rechargers__meta">+{{ item.shieldChargeAmount }} Shield</span>
        <span v-if="item.quantity > 1" class="shield-rechargers__meta">x{{ item.quantity }}</span>
        <button
          type="button"
          class="shield-rechargers__use"
          :disabled="!canApply"
          @click="apply(item.itemId)"
        >
          Apply
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.shield-rechargers {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.shield-rechargers__label {
  font-size: 0.75rem;
  color: var(--color-muted);
  font-family: var(--font-mono);
}

.shield-rechargers__list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 0;
  margin: 0;
}

.shield-rechargers__item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto auto auto;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: var(--color-surface-raised);
  border-radius: 4px;
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 0.72rem;
}

.shield-rechargers__name {
  min-width: 0;
}

.shield-rechargers__meta {
  color: var(--color-muted);
}

.shield-rechargers__use {
  border: 1px solid var(--color-accent);
  border-radius: 4px;
  background: transparent;
  color: var(--color-accent);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  padding: 2px 8px;
  cursor: pointer;
}

.shield-rechargers__use:hover:not(:disabled) {
  background: var(--color-accent);
  color: var(--color-bg);
}

.shield-rechargers__use:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>