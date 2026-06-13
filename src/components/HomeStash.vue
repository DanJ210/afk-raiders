<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '../stores/gameStore'
import { HOME_STASH_ITEM_LIMIT } from '../engine/homeStash'
import type { BackpackItem } from '../engine/types'
import { rarityLabel, rarityBarClass } from '../utils/rarity'

const store = useGameStore()

const homeStash = computed(() => store.state.homeStash)

/** Highest-value items at the top (per-unit value; line total breaks ties) */
const sortedStash = computed(() =>
  [...homeStash.value].sort(
    (a, b) => b.value - a.value || b.value * b.quantity - a.value * a.quantity,
  ),
)

/** Unsold item value currently in the stash. */
const stashValue = computed(() => {
  return homeStash.value.reduce((sum, item) => sum + item.value * item.quantity, 0)
})

/** Value from overflow auto-sales. */
const coinValue = computed(() => store.state.coins)

const totalItemCount = computed(() => {
  return homeStash.value.reduce((sum, item) => sum + item.quantity, 0)
})

const selectedItemId = ref<string | null>(null)

const selectedItem = computed<BackpackItem | null>(() => {
  if (!selectedItemId.value) return null
  return sortedStash.value.find(item => item.itemId === selectedItemId.value) ?? null
})

const selectedItemTotalValue = computed(() =>
  selectedItem.value ? selectedItem.value.value * selectedItem.value.quantity : 0,
)

function formatNumber(value: number): string {
  return value.toLocaleString('en-US')
}

function getCategoryEmoji(itemName: string): string {
  const lower = itemName.toLowerCase()
  if (lower.includes('water')) return '💧'
  if (lower.includes('bottle')) return '🍾'
  if (lower.includes('ammo')) return '🔫'
  if (lower.includes('armor') || lower.includes('helmet') || lower.includes('vest')) return '🛡️'
  if (lower.includes('med') || lower.includes('heal') || lower.includes('stimpack')) return '🏥'
  if (lower.includes('key') || lower.includes('card')) return '🔑'
  if (lower.includes('food') || lower.includes('ration')) return '🥫'
  if (lower.includes('rare')) return '✨'
  return '📦'
}

function openItemDetails(itemId: string) {
  selectedItemId.value = itemId
}

function closeItemDetails() {
  selectedItemId.value = null
}

function sellSelectedItem() {
  if (!selectedItem.value) return
  store.sellHomeStashItem(selectedItem.value.itemId)
  closeItemDetails()
}
</script>

<template>
  <section class="home-stash" aria-label="Home Stash">
    <header class="home-stash__header">🏠 HOME STASH</header>

    <div class="home-stash__stats">
      <div class="home-stash__stat" title="Value of unsold items currently in the stash">
        <span class="home-stash__stat-label">Stash Value</span>
        <span class="home-stash__stat-value">{{ formatNumber(stashValue) }}</span>
      </div>
      <div class="home-stash__stat" title="Coins earned by selling stash items or auto-selling overflow">
        <span class="home-stash__stat-label">🪙 Coin Value</span>
        <span class="home-stash__stat-value">{{ formatNumber(coinValue) }}</span>
      </div>
      <div class="home-stash__stat">
        <span class="home-stash__stat-label">Items</span>
        <span class="home-stash__stat-value">{{ totalItemCount }} / {{ HOME_STASH_ITEM_LIMIT }}</span>
      </div>
    </div>

    <div v-if="homeStash.length === 0" class="home-stash__empty">
      <p>No loot yet. Send the raider to bring treasures home.</p>
    </div>

    <div v-else class="home-stash__items">
      <button
        v-for="item in sortedStash"
        :key="item.itemId"
        type="button"
        class="stash-item"
        @click="openItemDetails(item.itemId)"
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

    <div
      v-if="selectedItem"
      class="stash-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Sell stash item"
      @click.self="closeItemDetails"
    >
      <div class="stash-dialog__card">
        <div class="stash-dialog__header">
          <div class="stash-dialog__title">
            <span class="stash-dialog__emoji">{{ getCategoryEmoji(selectedItem.name) }}</span>
            <div>
              <h3 class="stash-dialog__name">{{ selectedItem.name }}</h3>
              <p class="stash-dialog__meta">
                {{ rarityLabel(selectedItem.rarity) }} · ×{{ selectedItem.quantity }} ·
                {{ formatNumber(selectedItemTotalValue) }} value
              </p>
            </div>
          </div>
          <button type="button" class="stash-dialog__close" @click="closeItemDetails">✕</button>
        </div>

        <p class="stash-dialog__description">
          {{ selectedItem.flavor || 'No description available.' }}
        </p>

        <div class="stash-dialog__actions">
          <button type="button" class="stash-dialog__button stash-dialog__button--secondary" @click="closeItemDetails">
            Cancel
          </button>
          <button type="button" class="stash-dialog__button stash-dialog__button--primary" @click="sellSelectedItem">
            Sell for {{ formatNumber(selectedItemTotalValue) }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-stash {
  background: var(--color-surface);
  border-radius: 8px;
  border: 1px solid var(--color-border);
  padding: 14px;
  display: flex;
  flex-direction: column;
  max-height: 400px;
}

.home-stash__header {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  color: var(--color-accent);
  margin-bottom: 12px;
}

.home-stash__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.home-stash__stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--color-surface-raised);
  padding: 8px;
  border-radius: 4px;
}

.home-stash__stat-label {
  font-size: 0.7rem;
  color: var(--color-muted);
  font-family: var(--font-mono);
}

.home-stash__stat-value {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text);
  font-family: var(--font-mono);
}

.home-stash__empty {
  font-size: 0.8rem;
  color: var(--color-muted);
  font-style: italic;
  text-align: center;
  padding: 20px 0;
}

.home-stash__items {
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

.stash-dialog {
  position: fixed;
  inset: 0;
  background: rgb(5 10 16 / 78%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 50;
}

.stash-dialog__card {
  width: min(100%, 420px);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 16px;
  box-shadow: 0 16px 40px rgb(0 0 0 / 35%);
}

.stash-dialog__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.stash-dialog__title {
  display: flex;
  gap: 10px;
  min-width: 0;
}

.stash-dialog__emoji {
  font-size: 1.5rem;
  line-height: 1;
}

.stash-dialog__name {
  margin: 0;
  font-size: 1rem;
  color: var(--color-text);
}

.stash-dialog__meta {
  margin: 4px 0 0;
  color: var(--color-muted);
  font-size: 0.75rem;
  font-family: var(--font-mono);
}

.stash-dialog__close {
  border: 0;
  background: transparent;
  color: var(--color-muted);
  font-size: 1rem;
  cursor: pointer;
}

.stash-dialog__description {
  margin: 14px 0 0;
  color: var(--color-text);
  line-height: 1.5;
}

.stash-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.stash-dialog__button {
  border-radius: 6px;
  padding: 10px 14px;
  font-family: var(--font-mono);
  cursor: pointer;
  border: 1px solid var(--color-border);
}

.stash-dialog__button--secondary {
  background: var(--color-surface-raised);
  color: var(--color-text);
}

.stash-dialog__button--primary {
  background: var(--color-accent);
  color: var(--color-background);
  border-color: var(--color-accent);
}

@media (max-width: 600px) {
  .stash-dialog__actions {
    flex-direction: column-reverse;
  }

  .stash-dialog__button {
    width: 100%;
  }
}
</style>
