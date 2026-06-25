<script setup lang="ts">
import { computed } from 'vue'
import { rarityBarClass, rarityLabel } from '../utils/rarity'

interface ShieldRechargerViewModel {
  itemId: string
  name: string
  rarity: number
  quantity: number
  shieldChargeAmount: number
}

const props = defineProps<{
  items: ShieldRechargerViewModel[]
  canApply: boolean
  collapsed: boolean
}>()

const emit = defineEmits<{
  toggle: []
  apply: [itemId: string]
}>()

const totalQuantity = computed(() => props.items.reduce((total, item) => total + item.quantity, 0))

function toggle() {
  emit('toggle')
}

function apply(itemId: string) {
  emit('apply', itemId)
}
</script>

<template>
  <div v-if="items.length > 0" class="flex flex-col gap-1.5 mb-2.5">
    <div class="flex items-center justify-between gap-2">
      <span class="subpanel-label">Shield Rechargers <span class="text-muted">x{{ totalQuantity }}</span></span>
      <button
        type="button"
        class="btn-ghost"
        :aria-expanded="!collapsed"
        aria-controls="shield-rechargers-list"
        @click="toggle"
      >
        {{ collapsed ? 'Show' : 'Hide' }}
      </button>
    </div>
    <ul v-show="!collapsed" id="shield-rechargers-list" class="flex flex-col gap-comms-entry-y list-none p-0 m-0">
      <li v-for="item in items" :key="item.itemId" class="item-row">
        <span :class="rarityBarClass(item.rarity)" :title="rarityLabel(item.rarity)" aria-hidden="true" />
        <span class="min-w-0">{{ item.name }}</span>
        <span class="text-muted">{{ rarityLabel(item.rarity) }}</span>
        <span class="text-muted">+{{ item.shieldChargeAmount }} Shield</span>
        <span v-if="item.quantity > 1" class="text-muted">x{{ item.quantity }}</span>
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
