<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/gameStore'
import { rarityLabel, rarityBarClass } from '../utils/rarity'

const store = useGameStore()

const homeStash = computed(() => store.state.homeStash)

const totalStashValue = computed(() => {
  return homeStash.value.reduce((sum, item) => sum + item.value * item.quantity, 0)
})

const totalItemCount = computed(() => {
  return homeStash.value.reduce((sum, item) => sum + item.quantity, 0)
})

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
</script>

<template>
  <section class="home-stash" aria-label="Home Stash">
    <header class="home-stash__header">🏠 HOME STASH</header>

    <div v-if="homeStash.length === 0" class="home-stash__empty">
      <p>No loot yet. Send the raider to bring treasures home.</p>
    </div>

    <div v-else>
      <div class="home-stash__stats">
        <div class="home-stash__stat">
          <span class="home-stash__stat-label">Total Value</span>
          <span class="home-stash__stat-value">{{ totalStashValue }}</span>
        </div>
        <div class="home-stash__stat">
          <span class="home-stash__stat-label">Items</span>
          <span class="home-stash__stat-value">{{ totalItemCount }}</span>
        </div>
      </div>

      <div class="home-stash__items">
        <div v-for="item in homeStash" :key="item.itemId" class="stash-item">
          <span class="stash-item__emoji">{{ getCategoryEmoji(item.name) }}</span>
          <span :class="rarityBarClass(item.rarity)" :title="rarityLabel(item.rarity)" aria-hidden="true" />
          <div class="stash-item__content">
            <span class="stash-item__name">{{ item.name }}</span>
            <span class="stash-item__qty">×{{ item.quantity }}</span>
          </div>
          <span class="stash-item__value">{{ item.value * item.quantity }}</span>
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
  max-height: 300px;
  overflow-y: auto;
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
  grid-template-columns: 1fr 1fr;
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
}

.stash-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: var(--color-surface-raised);
  border-radius: 4px;
  font-size: 0.8rem;
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
  gap: 2px;
}

.stash-item__name {
  color: var(--color-text);
  font-family: var(--font-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stash-item__qty {
  color: var(--color-muted);
  font-size: 0.7rem;
  font-family: var(--font-mono);
}

.stash-item__value {
  color: var(--color-accent);
  font-weight: 600;
  font-family: var(--font-mono);
  font-size: 0.9rem;
}
</style>
