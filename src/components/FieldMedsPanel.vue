<script setup lang="ts">
import { computed } from 'vue'
import { rarityBarClass, rarityLabel } from '../utils/rarity'
import type { HealingItemStack } from '../engine/types'

const props = defineProps<{
  items: HealingItemStack[]
  canApply: boolean
}>()

const emit = defineEmits<{
  apply: [itemId: string]
}>()

function moodGain(item: HealingItemStack): number {
  return item.moodGain ?? Math.max(1, Math.min(4, item.rarity))
}

const hasItems = computed(() => props.items.length > 0)

function apply(itemId: string) {
  emit('apply', itemId)
}
</script>

<template>
  <div v-if="hasItems" class="flex flex-col gap-1.5 mb-2.5">
    <span class="subpanel-label">Field Meds</span>
    <ul class="flex flex-col gap-[5px] list-none p-0 m-0">
      <li v-for="item in items" :key="item.itemId" class="item-row">
        <span :class="rarityBarClass(item.rarity)" :title="rarityLabel(item.rarity)" aria-hidden="true" />
        <span>{{ item.name }}</span>
        <span>+{{ item.healAmount }} HP</span>
        <span>+{{ moodGain(item) }} Mood</span>
        <span v-if="item.quantity > 1">x{{ item.quantity }}</span>
        <button
          type="button"
          class="btn-ghost"
          :disabled="!canApply"
          @click="apply(item.itemId)"
        >
          Apply
        </button>
      </li>
    </ul>
  </div>
</template>
