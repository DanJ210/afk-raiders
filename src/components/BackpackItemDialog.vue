<script setup lang="ts">
import type { BackpackItem, HiddenPocketItem } from '../engine/types'
import { rarityLabel } from '../utils/rarity'

const props = defineProps<{
  item: BackpackItem | null
  hiddenPocket: HiddenPocketItem | null
  totalValue: number
  canSave: boolean
  canRemove: boolean
}>()

defineEmits<{
  close: []
  save: []
  remove: []
}>()

function isShieldRecharger(item: BackpackItem | null): item is BackpackItem & { kind: 'shield_recharger'; shieldChargeAmount: number } {
  return item?.kind === 'shield_recharger' && typeof item.shieldChargeAmount === 'number'
}

function isPocketedItem(itemId: string): boolean {
  return props.hiddenPocket?.itemId === itemId
}
</script>

<template>
  <div
    v-if="item"
    class="item-dialog"
    role="dialog"
    aria-modal="true"
    aria-label="Item Details"
    @click.self="$emit('close')"
    @keydown.esc="$emit('close')"
  >
    <div class="item-dialog-card">
      <div class="item-dialog-header">
        <div class="item-dialog-title">
          <span class="item-dialog-emoji">🕳️</span>
          <div>
            <h3 class="item-dialog-name">{{ item.name }}</h3>
            <p class="item-dialog-meta">
              {{ rarityLabel(item.rarity) }} · ×{{ item.quantity }} · {{ totalValue }} value
            </p>
          </div>
        </div>
        <button type="button" class="item-dialog-close" autofocus @click="$emit('close')">✕</button>
      </div>

      <p class="item-dialog-description">
        {{ item.flavor || 'No description available.' }}
      </p>

      <p v-if="isShieldRecharger(item)" class="item-dialog-description item-dialog-description--utility">
        Restores {{ item.shieldChargeAmount }} shield charge when applied from the backpack.
      </p>

      <div class="item-dialog-actions">
        <button type="button" class="item-dialog-button item-dialog-button--secondary" @click="$emit('close')">
          Cancel
        </button>
        <button
          v-if="isPocketedItem(item.itemId)"
          type="button"
          class="item-dialog-button item-dialog-button--secondary"
          :disabled="!canRemove"
          @click="$emit('remove')"
        >
          Remove From Secret Pocket
        </button>
        <button
          v-else
          type="button"
          class="item-dialog-button item-dialog-button--primary"
          :disabled="!canSave"
          @click="$emit('save')"
        >
          {{ hiddenPocket ? 'Replace Secret Pocket Item' : 'Save In Secret Pocket' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.item-dialog {
  position: fixed;
  inset: 0;
  background: rgb(5 10 16 / 78%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 50;
  overflow-y: auto;
}

.item-dialog-card {
  width: min(100%, 420px);
  max-height: calc(100dvh - 32px);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 16px;
  box-shadow: 0 16px 40px rgb(0 0 0 / 35%);
  overflow-y: auto;
}

.item-dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.item-dialog-title {
  display: flex;
  gap: 10px;
  min-width: 0;
}

.item-dialog-emoji {
  font-size: 1.5rem;
  line-height: 1;
}

.item-dialog-name {
  margin: 0;
  font-size: 1rem;
  color: var(--color-text);
}

.item-dialog-meta {
  margin: 4px 0 0;
  color: var(--color-muted);
  font-size: 0.75rem;
  font-family: var(--font-mono);
}

.item-dialog-close {
  border: 0;
  background: transparent;
  color: var(--color-muted);
  font-size: 1rem;
  cursor: pointer;
}

.item-dialog-description {
  margin: 14px 0 0;
  color: var(--color-text);
  line-height: 1.5;
}

.item-dialog-description--utility {
  color: var(--color-accent);
}

.item-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.item-dialog-button {
  border-radius: 6px;
  padding: 10px 14px;
  font-family: var(--font-mono);
  cursor: pointer;
  border: 1px solid var(--color-border);
}

.item-dialog-button--secondary {
  background: var(--color-surface-raised);
  color: var(--color-text);
}

.item-dialog-button--primary {
  background: var(--color-accent);
  color: var(--color-bg);
  border-color: var(--color-accent);
}

.item-dialog-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 600px) {
  .item-dialog-actions {
    flex-direction: column-reverse;
  }

  .item-dialog-button {
    width: 100%;
  }
}
</style>
