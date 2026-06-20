<script setup lang="ts">
import type { BackpackItem } from '../engine/types'
import { rarityLabel, rarityBarClass } from '../utils/rarity'
import { getStashIcon, formatNumber } from '../utils/stash'

const props = defineProps<{
  items: BackpackItem[]
}>()

const emit = defineEmits<{
  'item-click': [itemId: string]
}>()

function handleItemClick(itemId: string) {
  emit('item-click', itemId)
}
</script>

<template>
  <div class="flex flex-col flex-1 min-h-0">
    <div v-if="items.length === 0" class="text-[0.8rem] text-muted italic text-center py-5">
      <p>No loot yet. Send the raider to bring treasures home.</p>
    </div>

    <div v-else class="flex flex-col gap-2 overflow-y-auto flex-1 pr-0.5">
      <button
        v-for="item in items"
        :key="item.itemId"
        type="button"
        class="stash-item-row bg-surface-raised border border-border-subtle rounded text-[0.8rem] w-full text-left text-inherit cursor-pointer hover:border-accent focus-visible:border-accent focus-visible:outline-none"
        @click="handleItemClick(item.itemId)"
      >
        <span class="stash-item-row__icon text-[1.1rem] text-center inline-flex items-center justify-center">
          <img
            v-if="getStashIcon(item).kind === 'image'"
            class="w-5 h-5 object-contain"
            :src="getStashIcon(item).value"
            :alt="getStashIcon(item).alt"
          >
          <span v-else :aria-label="getStashIcon(item).alt">{{ getStashIcon(item).value }}</span>
        </span>
        <span :class="rarityBarClass(item.rarity)" :title="rarityLabel(item.rarity)">
          <span class="sr-only">{{ rarityLabel(item.rarity) }}</span>
        </span>
        <div class="flex flex-col gap-1 flex-1 min-w-0">
          <div class="flex items-baseline gap-2 min-w-0">
            <span class="text-text font-mono flex-1 min-w-0 wrap-anywhere">{{ item.name }}</span>
            <span class="text-muted text-[0.7rem] font-mono">×{{ item.quantity }}</span>
          </div>
          <p v-if="item.flavor" class="m-0 text-muted text-[0.72rem] font-mono italic leading-[1.4] wrap-anywhere">{{ item.flavor }}</p>
        </div>
        <span class="text-accent font-semibold font-mono text-[0.9rem] self-center">{{ formatNumber(item.value * item.quantity) }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.stash-item-row {
  display: grid;
  grid-template-columns: 1.5rem 0.25rem minmax(0, 1fr) max-content;
  align-items: center;
  gap: 0.5rem;
  min-height: 78px;
  padding: 0.5rem 0.625rem;
  color: var(--color-text);
  font-family: var(--font-mono);
}

.stash-item-row__icon {
  width: 1.5rem;
  min-width: 1.5rem;
}
</style>
