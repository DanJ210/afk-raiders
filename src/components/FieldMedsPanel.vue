<script setup lang="ts">
import { computed } from 'vue'
import { rarityBarClass, rarityLabel } from '../utils/rarity'
import type { HealingItemStack } from '../engine/types'

const props = defineProps<{
  items: HealingItemStack[]
  canApply: boolean
}>()

const emit = defineEmits<{
  apply: [itemId: string]
}>()

function moodGain(item: HealingItemStack): number {
  return item.moodGain ?? Math.max(1, Math.min(4, item.rarity))
}

const hasItems = computed(() => props.items.length > 0)

function apply(itemId: string) {
  emit('apply', itemId)
}
</script>

<template>
  <div v-if="hasItems" class="field-meds">
    <span class="backpack-panel__label">Field Meds</span>
    <ul class="field-meds__list">
      <li v-for="item in items" :key="item.itemId" class="field-meds__item">
        <span :class="rarityBarClass(item.rarity)" :title="rarityLabel(item.rarity)" aria-hidden="true" />
        <span>{{ item.name }}</span>
        <span>+{{ item.healAmount }} HP</span>
        <span>+{{ moodGain(item) }} Mood</span>
        <span v-if="item.quantity > 1">x{{ item.quantity }}</span>
        <button
          type="button"
          class="field-meds__use"
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
.field-meds {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.field-meds__list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 0;
  margin: 0;
}

.field-meds__item {
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

.field-meds__use {
  border: 1px solid var(--color-accent);
  border-radius: 4px;
  background: transparent;
  color: var(--color-accent);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  padding: 2px 8px;
  cursor: pointer;
}

.field-meds__use:hover:not(:disabled) {
  background: var(--color-accent);
  color: var(--color-bg);
}

.field-meds__use:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>