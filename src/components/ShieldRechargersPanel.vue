<script setup lang="ts">
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
}>()

const emit = defineEmits<{
  apply: [itemId: string]
}>()

function apply(itemId: string) {
  emit('apply', itemId)
}
</script>

<template>
  <div v-if="items.length > 0" class="flex flex-col gap-1.5 mb-2.5">
    <span class="subpanel-label">Shield Rechargers</span>
    <ul class="flex flex-col gap-[5px] list-none p-0 m-0">
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
