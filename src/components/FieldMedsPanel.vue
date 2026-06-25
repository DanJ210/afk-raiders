<script setup lang="ts">
import { computed } from 'vue'
import { rarityBarClass, rarityLabel } from '../utils/rarity'
import type { HealingItemStack } from '../engine/types'

const props = defineProps<{
  items: HealingItemStack[]
  canApply: boolean
  canApplyItem?: (item: HealingItemStack) => boolean
  collapsed: boolean
}>()

const emit = defineEmits<{
  toggle: []
  apply: [itemId: string]
}>()

function moodGain(item: HealingItemStack): number {
  return item.moodGain ?? Math.max(1, Math.min(4, item.rarity))
}

function itemEffectLabel(item: HealingItemStack): string {
  if ((item.reviveAmount ?? 0) > 0) return `Revive +${item.reviveAmount} HP`
  return `+${item.healAmount} HP`
}

function applyButtonLabel(item: HealingItemStack): string {
  return (item.reviveAmount ?? 0) > 0 ? 'Revive' : 'Apply'
}

function canApplyItem(item: HealingItemStack): boolean {
  return props.canApplyItem ? props.canApplyItem(item) : props.canApply
}

const hasItems = computed(() => props.items.length > 0)
const totalQuantity = computed(() => props.items.reduce((total, item) => total + item.quantity, 0))

function toggle() {
  emit('toggle')
}

function apply(itemId: string) {
  emit('apply', itemId)
}
</script>

<template>
  <div v-if="hasItems" class="flex flex-col gap-1.5 mb-2.5">
    <div class="flex items-center justify-between gap-2">
      <span class="subpanel-label">Field Meds <span class="text-muted">x{{ totalQuantity }}</span></span>
      <button
        type="button"
        class="btn-ghost"
        :aria-expanded="!collapsed"
        aria-controls="field-meds-list"
        @click="toggle"
      >
        {{ collapsed ? 'Show' : 'Hide' }}
      </button>
    </div>
    <ul v-show="!collapsed" id="field-meds-list" class="flex flex-col gap-comms-entry-y list-none p-0 m-0">
      <li v-for="item in items" :key="item.itemId" class="item-row">
        <span :class="rarityBarClass(item.rarity)" :title="rarityLabel(item.rarity)" aria-hidden="true" />
        <span>{{ item.name }}</span>
        <span>{{ itemEffectLabel(item) }}</span>
        <span>+{{ moodGain(item) }} Mood</span>
        <span v-if="item.quantity > 1">x{{ item.quantity }}</span>
        <button
          type="button"
          class="btn-ghost"
          :disabled="!canApplyItem(item)"
          @click="apply(item.itemId)"
        >
          {{ applyButtonLabel(item) }}
        </button>
      </li>
    </ul>
  </div>
</template>
