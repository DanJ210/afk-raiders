<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/gameStore'
import { rarityLabel, rarityBarClass } from '../utils/rarity'
import type { HealingItemStack } from '../engine/types'

const store = useGameStore()
const raid = computed(() => store.raid)

const backpackItems = computed(() =>
  [...raid.value.backpack].sort((a, b) => {
    if (b.rarity !== a.rarity) return b.rarity - a.rarity
    if (b.value !== a.value) return b.value - a.value
    return a.name.localeCompare(b.name)
  }),
)

const healingItems = computed(() =>
  [...raid.value.healingItems].sort((a, b) => {
    if (b.healAmount !== a.healAmount) return b.healAmount - a.healAmount
    return a.name.localeCompare(b.name)
  }),
)

function greedLabel(level: number): string {
  if (level < 20) return '😌 Chill'
  if (level < 40) return '🤑 Interested'
  if (level < 60) return '😤 Pushing It'
  if (level < 80) return '🚨 Reckless'
  return '☠️ DEATH WISH'
}

function moodGain(item: HealingItemStack): number {
  return item.moodGain ?? Math.max(1, Math.min(4, item.rarity))
}

const greedClass = computed(() => {
  const g = raid.value.greedLevel
  if (g < 40) return 'greed--low'
  if (g < 70) return 'greed--mid'
  return 'greed--high'
})

const canApplyHealing = computed(() =>
  raid.value.phase !== 'HUB' &&
  raid.value.phase !== 'DOWNED' &&
  store.raider.hp > 0 &&
  store.raider.hp < store.raider.maxHp,
)
</script>

<template>
  <section class="backpack-panel" aria-label="Backpack">
    <header class="backpack-panel__header">🎒 BACKPACK</header>

    <div class="backpack-panel__value">
      <span class="backpack-panel__label">Total Value</span>
      <span class="backpack-panel__amount">{{ raid.backpackValue }}</span>
    </div>

    <div class="backpack-panel__greed">
      <span class="backpack-panel__label">Greed Level</span>
      <div class="greed-bar" :title="`Greed: ${raid.greedLevel}/100`">
        <div
          class="greed-bar__fill"
          :class="greedClass"
          :style="{ width: raid.greedLevel + '%' }"
        />
      </div>
      <span class="backpack-panel__greed-label" :class="greedClass">
        {{ greedLabel(raid.greedLevel) }}
      </span>
    </div>

    <div v-if="healingItems.length > 0" class="backpack-panel__meds">
      <span class="backpack-panel__label">Field Meds</span>
      <ul class="backpack-panel__med-list">
        <li v-for="item in healingItems" :key="item.itemId" class="backpack-panel__med-item">
          <span :class="rarityBarClass(item.rarity)" :title="rarityLabel(item.rarity)" aria-hidden="true" />
          <span>{{ item.name }}</span>
          <span>+{{ item.healAmount }} HP</span>
          <span>+{{ moodGain(item) }} Mood</span>
          <span v-if="item.quantity > 1">x{{ item.quantity }}</span>
          <button
            type="button"
            class="backpack-panel__med-use"
            :disabled="!canApplyHealing"
            @click="store.applyHealingItem(item.itemId)"
          >
            Apply
          </button>
        </li>
      </ul>
    </div>

    <p v-if="raid.backpack.length === 0 && raid.phase === 'HUB'" class="backpack-panel__empty">
      Backpack empty. Ready for terrible decisions.
    </p>
    <p v-else-if="raid.backpack.length === 0" class="backpack-panel__empty">
      Nothing yet. The zone is full of possibilities and also robots.
    </p>

    <ul v-else class="backpack-panel__items">
      <li v-for="item in backpackItems" :key="item.itemId" class="backpack-panel__item">
        <div class="backpack-panel__item-main">
          <span :class="rarityBarClass(item.rarity)" :title="rarityLabel(item.rarity)" aria-hidden="true" />
          <span class="backpack-panel__item-name">{{ item.name }}</span>
          <span class="backpack-panel__item-meta">{{ rarityLabel(item.rarity) }}</span>
        </div>
        <div class="backpack-panel__item-sub">
          <span>Value {{ item.value }}</span>
          <span v-if="item.quantity > 1">x{{ item.quantity }}</span>
        </div>
        <p v-if="item.flavor" class="backpack-panel__item-flavor">{{ item.flavor }}</p>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.backpack-panel {
  background: var(--color-surface);
  border-radius: 8px;
  border: 1px solid var(--color-border);
  padding: 14px;
}

.backpack-panel__header {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  color: var(--color-accent);
  margin-bottom: 12px;
}

.backpack-panel__value {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.backpack-panel__label {
  font-size: 0.75rem;
  color: var(--color-muted);
  font-family: var(--font-mono);
}

.backpack-panel__amount {
  font-size: 1.2rem;
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--color-text);
}

.backpack-panel__greed {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.backpack-panel__meds {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.backpack-panel__med-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 0;
  margin: 0;
}

.backpack-panel__med-item {
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

.backpack-panel__med-use {
  border: 1px solid var(--color-accent);
  border-radius: 4px;
  background: transparent;
  color: var(--color-accent);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  padding: 2px 8px;
  cursor: pointer;
}

.backpack-panel__med-use:hover:not(:disabled) {
  background: var(--color-accent);
  color: var(--color-bg);
}

.backpack-panel__med-use:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.greed-bar {
  flex: 1;
  height: 8px;
  background: var(--color-surface-raised);
  border-radius: 4px;
  overflow: hidden;
}

.greed-bar__fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s ease;
}

.greed--low  { background: var(--color-success); color: var(--color-success); }
.greed--mid  { background: var(--color-warning); color: var(--color-warning); }
.greed--high { background: var(--color-danger);  color: var(--color-danger); }

.backpack-panel__greed-label {
  font-size: 0.75rem;
  font-family: var(--font-mono);
  min-width: 90px;
  text-align: right;
}

.backpack-panel__empty {
  font-size: 0.8rem;
  color: var(--color-muted);
  font-style: italic;
  margin-top: 8px;
}

.backpack-panel__items {
  list-style: none;
  padding: 0;
  margin: 12px 0 0;
  display: grid;
  gap: 8px;
}

.backpack-panel__item {
  border: 1px solid var(--color-border-subtle);
  border-radius: 6px;
  background: var(--color-surface-raised);
  padding: 8px 10px;
}

.backpack-panel__item-main,
.backpack-panel__item-sub {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.backpack-panel__item-name {
  flex: 1;
  font-size: 0.86rem;
  color: var(--color-text);
}

.backpack-panel__item-meta,
.backpack-panel__item-sub,
.backpack-panel__item-flavor {
  font-size: 0.72rem;
  color: var(--color-muted);
  font-family: var(--font-mono);
}

.backpack-panel__item-sub {
  margin-top: 4px;
}

.backpack-panel__item-flavor {
  margin: 6px 0 0;
  font-style: italic;
  line-height: 1.4;
}
</style>
