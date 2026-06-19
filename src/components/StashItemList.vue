<script setup lang="ts">
import type { BackpackItem } from '../engine/types'
import { rarityLabel, rarityBarClass } from '../utils/rarity'
import { getCategoryEmoji, formatNumber } from '../utils/stash'

const props = defineProps<{
  items: BackpackItem[]
}>()

const emit = defineEmits<{
  'item-click': [itemId: string]
}>()

function handleItemClick(itemId: string) {
  emit('item-click', itemId)
}
</script>

<template>
  <div class="stash-items">
    <div v-if="items.length === 0" class="stash-items__empty">
      <p>No loot yet. Send the raider to bring treasures home.</p>
    </div>

    <div v-else class="stash-items__list">
      <button
        v-for="item in items"
        :key="item.itemId"
        type="button"
        class="stash-item"
        @click="handleItemClick(item.itemId)"
      >
        <span class="stash-item__emoji">{{ getCategoryEmoji(item.name) }}</span>
        <span :class="rarityBarClass(item.rarity)" :title="rarityLabel(item.rarity)">
          <span class="stash-item__rarity-text">{{ rarityLabel(item.rarity) }}</span>
        </span>
        <div class="stash-item__content">
          <div class="stash-item__topline">
            <span class="stash-item__name">{{ item.name }}</span>
            <span class="stash-item__qty">×{{ item.quantity }}</span>
          </div>
          <p v-if="item.flavor" class="stash-item__flavor">{{ item.flavor }}</p>
        </div>
        <span class="stash-item__value">{{ formatNumber(item.value * item.quantity) }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.stash-items__empty {
  font-size: 0.8rem;
  color: var(--color-muted);
  font-style: italic;
  text-align: center;
  padding: 20px 0;
}

.stash-items__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  flex: 1;
  padding-right: 2px;
}

.stash-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px;
  background: var(--color-surface-raised);
  border-radius: 4px;
  font-size: 0.8rem;
  border: 1px solid var(--color-border-subtle);
  width: 100%;
  text-align: left;
  color: inherit;
  cursor: pointer;
}

.stash-item:hover,
.stash-item:focus-visible {
  border-color: var(--color-accent);
  outline: none;
}

.stash-item__emoji {
  font-size: 1.1rem;
  min-width: 24px;
  text-align: center;
}

.stash-item__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stash-item__topline {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.stash-item__name {
  color: var(--color-text);
  font-family: var(--font-mono);
  flex: 1;
}

.stash-item__qty {
  color: var(--color-muted);
  font-size: 0.7rem;
  font-family: var(--font-mono);
}

.stash-item__flavor {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.72rem;
  font-family: var(--font-mono);
  font-style: italic;
  line-height: 1.4;
}

.stash-item__value {
  color: var(--color-accent);
  font-weight: 600;
  font-family: var(--font-mono);
  font-size: 0.9rem;
  align-self: center;
}

.stash-item__rarity-text {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
