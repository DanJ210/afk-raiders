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
  <div class="flex flex-col gap-1.5 mb-2.5 p-2.5 rounded-md font-mono" style="border: 1px solid color-mix(in oklab, var(--color-accent-secondary) 70%, var(--color-border)); background: linear-gradient(135deg, rgb(255 255 255 / 2%), rgb(0 0 0 / 8%)), var(--color-surface-raised); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 3%);">
    <div class="flex items-center justify-between gap-2">
      <span class="subpanel-label">Secret Hidden Pocket</span>
      <button
        v-if="hiddenPocket"
        type="button"
        class="border border-border rounded bg-transparent text-muted font-mono text-[0.68rem] px-2 py-0.5 cursor-pointer hover:border-danger hover:text-danger disabled:opacity-40 disabled:cursor-not-allowed"
        :disabled="!canManage"
        @click="$emit('clear')"
      >
        Remove
      </button>
    </div>
    <p v-if="!hiddenPocket" class="m-0 text-[0.72rem] text-accent-secondary italic">
      The dark safe spot that no one wants to check 😬
    </p>
    <div v-else class="flex items-center gap-2 text-[0.75rem] text-text">
      <span :class="rarityBarClass(hiddenPocket.rarity)" :title="rarityLabel(hiddenPocket.rarity)" aria-hidden="true" />
      <span class="flex-1">{{ hiddenPocket.name }}</span>
      <span class="text-accent-secondary">Value {{ hiddenPocket.value }}</span>
      <span v-if="hiddenPocket.quantity > 1">×{{ hiddenPocket.quantity }}</span>
    </div>
  </div>
</template>
