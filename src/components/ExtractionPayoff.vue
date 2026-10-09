<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '../stores/gameStore'
import { formatNumber } from '../utils/stash'
import { zoneName } from '../utils/zones'

const store = useGameStore()
const receipt = computed(() => store.state.lastExtraction)
const details = ref<HTMLDetailsElement | null>(null)
const emit = defineEmits<{
  openStash: []
  openPrep: []
}>()
function signed(value: number): string {
  return `${value >= 0 ? '+' : ''}${formatNumber(value)}`
}
function openStash() {
  if (details.value) details.value.open = false
  emit('openStash')
}
function openPrep() {
  if (details.value) details.value.open = false
  emit('openPrep')
}
</script>

<template>
  <details v-if="receipt && store.phase === 'HUB'" ref="details" class="panel-card shrink-0 max-h-[40dvh] overflow-y-auto font-mono text-raider-meta" aria-label="Latest extraction receipt">
    <summary class="cursor-pointer text-success">
      Latest extraction #{{ receipt.extractionNumber }} · {{ formatNumber(receipt.lootValue) }} loot value secured
    </summary>
    <p class="my-2 text-muted">
      <time :datetime="new Date(receipt.timestamp).toISOString()">{{ new Date(receipt.timestamp).toLocaleString() }}</time>
      <template v-if="receipt.zone"> · {{ zoneName(receipt.zone) }}</template>
      <template v-if="receipt.dangerLevel"> · {{ receipt.dangerLevel }}</template>
    </p>
    <dl class="grid grid-cols-2 gap-x-3 gap-y-1 m-0">
      <dt>Loot secured</dt><dd class="m-0">{{ receipt.lootItemCount }} units · {{ formatNumber(receipt.lootValue) }} value</dd>
      <dt>Net stash value change</dt><dd class="m-0">{{ signed(receipt.stashValueChange) }}</dd>
      <dt>Overflow sales</dt><dd class="m-0">{{ receipt.overflowItemCount }} units · +{{ formatNumber(receipt.overflowCoins) }} coins</dd>
      <dt>Extraction stipend</dt><dd class="m-0">+{{ formatNumber(receipt.stipendCoins) }} coins</dd>
      <dt>Coins credited</dt><dd class="m-0 text-accent">+{{ formatNumber(receipt.overflowCoins + receipt.stipendCoins) }}</dd>
    </dl>
    <p class="my-2 text-muted">Unsold loot stays in your stash. Overflow sales may include older stash items. Sell items manually to fund preparation.</p>
    <div class="flex flex-wrap gap-2">
      <button type="button" class="btn-ghost" @click="openStash">Open stash / sell loot</button>
      <button type="button" class="btn-ghost" @click="openPrep">Plan next purchase</button>
    </div>
  </details>
</template>
