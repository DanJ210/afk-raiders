<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/gameStore'

const store = useGameStore()
const raid = computed(() => store.raid)

function greedLabel(level: number): string {
  if (level < 20) return '😌 Chill'
  if (level < 40) return '🤑 Interested'
  if (level < 60) return '😤 Pushing It'
  if (level < 80) return '🚨 Reckless'
  return '☠️ DEATH WISH'
}

const greedClass = computed(() => {
  const g = raid.value.greedLevel
  if (g < 40) return 'greed--low'
  if (g < 70) return 'greed--mid'
  return 'greed--high'
})
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

    <p v-if="raid.phase === 'HUB'" class="backpack-panel__empty">
      Backpack empty. Ready for terrible decisions.
    </p>
    <p v-else-if="raid.backpackValue === 0" class="backpack-panel__empty">
      Nothing yet. The zone is full of possibilities and also robots.
    </p>
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
</style>
