<script setup lang="ts">
import type { BackpackItem } from '../engine/types'
import { rarityLabel, rarityBarClass } from '../utils/rarity'

withDefaults(
  defineProps<{
    items: BackpackItem[]
    phase?: string
  }>(),
  { phase: 'RAIDING' },
)

const emit = defineEmits<{
  'item-click': [itemId: string]
}>()

function handleKeydown(event: KeyboardEvent, itemId: string) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    emit('item-click', itemId)
  }
}
</script>

<template>
  <div class="backpack-items-container">
    <p v-if="items.length === 0 && phase === 'HUB'" class="backpack-items-empty">
      Backpack empty. Ready for terrible decisions.
    </p>
    <p v-else-if="items.length === 0" class="backpack-items-empty">
      Nothing yet. The zone is full of possibilities and also robots.
    </p>

    <ul v-else class="backpack-items-list">
      <li
        v-for="item in items"
        :key="item.itemId"
        class="backpack-item backpack-item--clickable"
        role="button"
        tabindex="0"
        @click="$emit('item-click', item.itemId)"
        @keydown="handleKeydown($event, item.itemId)"
      >
        <div class="backpack-item-main">
          <span :class="rarityBarClass(item.rarity)" :title="rarityLabel(item.rarity)" aria-hidden="true" />
          <span class="backpack-item-name">{{ item.name }}</span>
          <span class="backpack-item-meta">{{ rarityLabel(item.rarity) }}</span>
        </div>
        <div class="backpack-item-sub">
          <span>Value {{ item.value }}</span>
          <span v-if="item.kind === 'shield_recharger'">+{{ item.shieldChargeAmount }} Shield</span>
          <span v-if="item.quantity > 1">x{{ item.quantity }}</span>
        </div>
        <p v-if="item.flavor" class="backpack-item-flavor">{{ item.flavor }}</p>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.backpack-items-container {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.backpack-items-empty {
  font-size: 0.8rem;
  color: var(--color-muted);
  font-style: italic;
  margin-top: 8px;
}

.backpack-items-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-auto-rows: max-content;
  gap: 8px;
  align-content: start;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  padding-right: 2px;
}

.backpack-item {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  min-height: 84px;
  border: 1px solid var(--color-border-subtle);
  border-radius: 6px;
  background: var(--color-surface-raised);
  padding: 8px 10px;
  overflow: visible;
}

.backpack-item--clickable {
  cursor: pointer;
}

.backpack-item--clickable:hover,
.backpack-item--clickable:focus-visible {
  border-color: var(--color-accent);
  outline: none;
}

.backpack-item-main,
.backpack-item-sub {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}

.backpack-item-name {
  flex: 1;
  min-width: 0;
  font-size: 0.86rem;
  color: var(--color-text);
}

.backpack-item-meta,
.backpack-item-sub,
.backpack-item-flavor {
  font-size: 0.72rem;
  color: var(--color-muted);
  font-family: var(--font-mono);
}

.backpack-item-sub {
  margin-top: 4px;
}

.backpack-item-flavor {
  margin: 6px 0 0;
  font-style: italic;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

@media (max-width: 600px) {
  .backpack-item {
    min-height: 92px;
  }
}

@media (min-width: 601px) {
  .backpack-items-container {
    --backpack-item-row-height: 84px;
    --backpack-item-row-gap: 8px;
    --backpack-visible-item-count: 5;
    --backpack-items-viewport-height: calc(
      (var(--backpack-item-row-height) * var(--backpack-visible-item-count)) +
      (var(--backpack-item-row-gap) * (var(--backpack-visible-item-count) - 1))
    );
    flex: none;
    min-height: var(--backpack-items-viewport-height);
    max-height: var(--backpack-items-viewport-height);
  }
}
</style>
