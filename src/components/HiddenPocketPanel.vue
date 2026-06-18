<script setup lang="ts">
import type { HiddenPocketItem } from '../engine/types'
import { rarityLabel, rarityBarClass } from '../utils/rarity'

defineProps<{
  hiddenPocket: HiddenPocketItem | null
  canManage: boolean
}>()

defineEmits<{
  clear: []
}>()
</script>

<template>
  <div class="hidden-pocket">
    <div class="hidden-pocket-header">
      <span class="hidden-pocket-label">Secret Hidden Pocket</span>
      <button
        v-if="hiddenPocket"
        type="button"
        class="hidden-pocket-clear"
        :disabled="!canManage"
        @click="$emit('clear')"
      >
        Remove
      </button>
    </div>
    <p v-if="!hiddenPocket" class="hidden-pocket-empty">
      Empty. Pick 1 backpack item to save if the raid fails.
    </p>
    <div v-else class="hidden-pocket-item">
      <span :class="rarityBarClass(hiddenPocket.rarity)" :title="rarityLabel(hiddenPocket.rarity)" aria-hidden="true" />
      <span class="hidden-pocket-name">{{ hiddenPocket.name }}</span>
      <span class="hidden-pocket-meta">Value {{ hiddenPocket.value }}</span>
    </div>
  </div>
</template>

<style scoped>
.hidden-pocket {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
  padding: 10px;
  border: 1px solid color-mix(in oklab, var(--color-accent-secondary) 70%, var(--color-border));
  border-radius: 6px;
  background:
    linear-gradient(135deg, rgb(255 255 255 / 2%), rgb(0 0 0 / 8%)),
    var(--color-surface-raised);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 3%);
}

.hidden-pocket-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.hidden-pocket-label {
  font-size: 0.75rem;
  color: var(--color-muted);
  font-family: var(--font-mono);
}

.hidden-pocket-clear {
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: transparent;
  color: var(--color-muted);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  padding: 2px 8px;
  cursor: pointer;
}

.hidden-pocket-clear:hover:not(:disabled) {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.hidden-pocket-clear:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.hidden-pocket-empty {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--color-accent-secondary);
  font-style: italic;
}

.hidden-pocket-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-text);
}

.hidden-pocket-name {
  flex: 1;
}

.hidden-pocket-meta {
  color: var(--color-accent-secondary);
}
</style>
