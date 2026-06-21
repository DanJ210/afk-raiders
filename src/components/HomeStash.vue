<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/gameStore'
import { HOME_STASH_ITEM_LIMIT } from '../engine/homeStash'
import { useStashViewModel } from '../composables/useStashViewModel'
import { formatNumber } from '../utils/stash'
import StashItemList from './StashItemList.vue'
import StashItemDialog from './StashItemDialog.vue'

const store = useGameStore()

const homeStash = computed(() => store.state.homeStash)
const coins = computed(() => store.state.coins)

const viewModel = useStashViewModel(homeStash, coins)

function handleItemClick(itemId: string) {
  viewModel.openItemDetails(itemId)
}

function handleDialogClose() {
  viewModel.closeItemDetails()
}

function handleDialogSell() {
  if (!viewModel.selectedItem.value) return
  store.sellHomeStashItem(viewModel.selectedItem.value.itemId)
  viewModel.closeItemDetails()
}
</script>

<template>
  <section class="home-stash panel-card max-h-home-stash-max" aria-label="Home Stash">
    <header class="section-header">🏠 HOME STASH</header>

    <div class="grid grid-cols-3 gap-2 mb-3">
      <div class="flex flex-col gap-1 bg-surface-raised p-2 rounded" title="Value of unsold items currently in the stash">
        <span class="text-raider-tiny text-muted font-mono">Stash Value</span>
        <span class="text-[1rem] font-bold text-text font-mono">{{ formatNumber(viewModel.stashValue.value) }}</span>
      </div>
      <div class="flex flex-col gap-1 bg-surface-raised p-2 rounded" title="Coins earned by selling stash items or auto-selling overflow">
        <span class="text-raider-tiny text-muted font-mono">🪙 Coin Value</span>
        <span class="text-[1rem] font-bold text-text font-mono">{{ formatNumber(viewModel.coinValue.value) }}</span>
      </div>
      <div class="flex flex-col gap-1 bg-surface-raised p-2 rounded">
        <span class="text-raider-tiny text-muted font-mono">Items</span>
        <span class="text-[1rem] font-bold text-text font-mono">{{ viewModel.totalItemCount.value }} / {{ HOME_STASH_ITEM_LIMIT }}</span>
      </div>
    </div>

    <StashItemList :items="viewModel.sortedStash.value" @item-click="handleItemClick" />

    <StashItemDialog
      :item="viewModel.selectedItem.value"
      :total-value="viewModel.selectedItemTotalValue.value"
      @close="handleDialogClose"
      @sell="handleDialogSell"
    />
  </section>
</template>
