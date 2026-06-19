<script setup lang="ts">
import type { BackpackItem } from '../engine/types'
import { rarityLabel } from '../utils/rarity'
import { getCategoryEmoji, formatNumber } from '../utils/stash'

const props = defineProps<{
  item: BackpackItem | null
  totalValue: number
}>()

const emit = defineEmits<{
  close: []
  sell: []
}>()

function handleClose() {
  emit('close')
}

function handleSell() {
  emit('sell')
}
</script>

<template>
  <div
    v-if="item"
    class="stash-dialog"
    role="dialog"
    aria-modal="true"
    aria-label="Sell stash item"
    @click.self="handleClose"
    @keydown.esc="handleClose"
  >
    <div class="stash-dialog__card">
      <div class="stash-dialog__header">
        <div class="stash-dialog__title">
          <span class="stash-dialog__emoji">{{ getCategoryEmoji(item.name) }}</span>
          <div>
            <h3 class="stash-dialog__name">{{ item.name }}</h3>
            <p class="stash-dialog__meta">
              {{ rarityLabel(item.rarity) }} · ×{{ item.quantity }} · {{ formatNumber(totalValue) }} value
            </p>
          </div>
        </div>
        <button type="button" class="stash-dialog__close" autofocus @click="handleClose">✕</button>
      </div>

      <p class="stash-dialog__description">
        {{ item.flavor || 'No description available.' }}
      </p>

      <div class="stash-dialog__actions">
        <button type="button" class="stash-dialog__button stash-dialog__button--secondary" @click="handleClose">
          Cancel
        </button>
        <button type="button" class="stash-dialog__button stash-dialog__button--primary" @click="handleSell">
          Sell for {{ formatNumber(totalValue) }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
