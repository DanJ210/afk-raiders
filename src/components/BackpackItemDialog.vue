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
    class="modal-overlay overflow-y-auto"
    role="dialog"
    aria-modal="true"
    aria-label="Item Details"
    @click.self="$emit('close')"
    @keydown.esc="$emit('close')"
  >
    <div class="modal-card w-[min(100%,420px)] max-h-[calc(100dvh-32px)] overflow-y-auto shadow-[0_16px_40px_rgb(0_0_0/35%)]">
      <div class="flex items-start justify-between gap-3">
        <div class="flex gap-2.5 min-w-0">
          <span class="text-[1.5rem] leading-none">🕳️</span>
          <div>
            <h3 class="m-0 text-[1rem] text-text">{{ item.name }}</h3>
            <p class="mt-1 mb-0 text-muted text-[0.75rem] font-mono">
              {{ rarityLabel(item.rarity) }} · ×{{ item.quantity }} · {{ totalValue }} value
            </p>
          </div>
        </div>
        <button type="button" class="border-0 bg-transparent text-muted text-[1rem] cursor-pointer" autofocus @click="$emit('close')">✕</button>
      </div>

      <p class="mt-3.5 mb-0 text-text leading-normal">
        {{ item.flavor || 'No description available.' }}
      </p>

      <p v-if="isShieldRecharger(item)" class="mt-3.5 mb-0 text-accent leading-normal">
        Restores {{ item.shieldChargeAmount }} shield charge when applied from the backpack.
      </p>

      <div class="flex justify-end gap-2 mt-4 max-[600px]:flex-col-reverse">
        <button type="button" class="rounded-md px-3.5 py-2.5 font-mono cursor-pointer border border-border bg-surface-raised text-text max-[600px]:w-full" @click="$emit('close')">
          Cancel
        </button>
        <button
          v-if="isPocketedItem(item.itemId)"
          type="button"
          class="rounded-md px-3.5 py-2.5 font-mono cursor-pointer border border-border bg-surface-raised text-text disabled:opacity-50 disabled:cursor-not-allowed max-[600px]:w-full"
          :disabled="!canRemove"
          @click="$emit('remove')"
        >
          Remove From Secret Pocket
        </button>
        <button
          v-else
          type="button"
          class="rounded-md px-3.5 py-2.5 font-mono cursor-pointer border border-accent bg-accent text-bg disabled:opacity-50 disabled:cursor-not-allowed max-[600px]:w-full"
          :disabled="!canSave"
          @click="$emit('save')"
        >
          {{ hiddenPocket ? 'Replace Secret Pocket Item' : 'Save In Secret Pocket' }}
        </button>
      </div>
    </div>
  </div>
</template>
