<script setup lang="ts">
import type { BackpackItem } from '../engine/types'
import { rarityLabel, rarityBarClass } from '../utils/rarity'

withDefaults(
  defineProps<{
    items: BackpackItem[]
    phase?: string
  }>(),
  { phase: 'RAIDING' },
)

const emit = defineEmits<{
  'item-click': [itemId: string]
}>()

function handleKeydown(event: KeyboardEvent, itemId: string) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    emit('item-click', itemId)
  }
}
</script>

<template>
  <div class="backpack-items-container mt-3 flex flex-col flex-1 min-h-0">
    <p v-if="items.length === 0 && phase === 'HUB'" class="text-raider-meta text-muted italic mt-2">
      Backpack empty. Ready for terrible decisions.
    </p>
    <p v-else-if="items.length === 0" class="text-raider-meta text-muted italic mt-2">
      Nothing yet. The zone is full of possibilities and also robots.
    </p>

    <ul v-else class="list-none p-0 m-0 grid gap-2 overflow-y-auto flex-1 min-h-0 pr-0.5" style="grid-auto-rows: max-content; align-content: start;">
      <li
        v-for="item in items"
        :key="item.itemId"
        class="backpack-item-row min-h-21 border border-border-subtle rounded-md bg-surface-raised px-2.5 py-2 overflow-visible cursor-pointer hover:border-accent focus-visible:border-accent focus-visible:outline-none max-[600px]:min-h-23"
        role="button"
        tabindex="0"
        @click="$emit('item-click', item.itemId)"
        @keydown="handleKeydown($event, item.itemId)"
      >
        <span :class="[rarityBarClass(item.rarity), 'backpack-item-row__rarity']" :title="rarityLabel(item.rarity)" aria-hidden="true" />
        <div class="min-w-0">
          <div class="flex justify-between gap-2.5 min-w-0">
            <span class="flex-1 min-w-0 text-[0.86rem] text-text wrap-anywhere">{{ item.name }}</span>
            <span class="text-[0.72rem] text-muted font-mono">{{ rarityLabel(item.rarity) }}</span>
          </div>
          <div class="flex justify-between gap-2.5 min-w-0 mt-1 text-[0.72rem] text-muted font-mono">
            <span>Value {{ item.value }}</span>
            <span v-if="item.kind === 'shield_recharger'">+{{ item.shieldChargeAmount }} Shield</span>
            <span v-if="item.quantity > 1">x{{ item.quantity }}</span>
          </div>
          <p v-if="item.flavor" class="mt-1.5 mb-0 text-[0.72rem] text-muted font-mono italic leading-[1.4] wrap-anywhere">{{ item.flavor }}</p>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.backpack-item-row {
  display: grid;
  grid-template-columns: 0.25rem minmax(0, 1fr);
  column-gap: 0.625rem;
  align-items: stretch;
}

.backpack-item-row__rarity {
  grid-column: 1;
}

/* Desktop: constrain viewport to show exactly 5 rows */
@media (min-width: 601px) {
  .backpack-items-container {
    --backpack-item-row-height: 84px;
    --backpack-item-row-gap: 8px;
    --backpack-visible-item-count: 5;
    --backpack-items-viewport-height: calc(
      (var(--backpack-item-row-height) * var(--backpack-visible-item-count)) +
      (var(--backpack-item-row-gap) * (var(--backpack-visible-item-count) - 1))
    );
    flex: none;
    min-height: var(--backpack-items-viewport-height);
    max-height: var(--backpack-items-viewport-height);
  }
}
</style>
