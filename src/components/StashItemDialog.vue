<script setup lang="ts">
import type { BackpackItem } from '../engine/types'
import { rarityLabel } from '../utils/rarity'
import { getStashIcon, formatNumber } from '../utils/stash'

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
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Sell stash item"
    @click.self="handleClose"
    @keydown.esc="handleClose"
  >
    <div class="modal-card w-[min(100%,420px)] shadow-[0_16px_40px_rgb(0_0_0/35%)]">
      <div class="flex items-start justify-between gap-3">
        <div class="flex gap-2.5 min-w-0">
          <span class="text-[1.5rem] leading-none inline-flex items-center justify-center">
            <img
              v-if="getStashIcon(item).kind === 'image'"
              class="w-7 h-7 object-contain"
              :src="getStashIcon(item).value"
              :alt="getStashIcon(item).alt"
            >
            <span v-else :aria-label="getStashIcon(item).alt">{{ getStashIcon(item).value }}</span>
          </span>
          <div>
            <h3 class="m-0 text-[1rem] text-text">{{ item.name }}</h3>
            <p class="mt-1 mb-0 text-muted text-[0.75rem] font-mono">
              {{ rarityLabel(item.rarity) }} · ×{{ item.quantity }} · {{ formatNumber(totalValue) }} value
            </p>
          </div>
        </div>
        <button type="button" class="border-0 bg-transparent text-muted text-[1rem] cursor-pointer" autofocus @click="handleClose">✕</button>
      </div>

      <p class="mt-3.5 mb-0 text-text leading-normal">
        {{ item.flavor || 'No description available.' }}
      </p>

      <div class="flex justify-end gap-2 mt-4 max-[600px]:flex-col-reverse">
        <button type="button" class="rounded-md px-3.5 py-2.5 font-mono cursor-pointer border border-border bg-surface-raised text-text max-[600px]:w-full" @click="handleClose">
          Cancel
        </button>
        <button type="button" class="rounded-md px-3.5 py-2.5 font-mono cursor-pointer border border-accent bg-accent text-bg max-[600px]:w-full" @click="handleSell">
          Sell for {{ formatNumber(totalValue) }}
        </button>
      </div>
    </div>
  </div>
</template>
