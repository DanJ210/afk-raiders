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

const viewModel = useStashViewModel({ value: homeStash.value }, { value: coins.value })

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
  <section class="home-stash" aria-label="Home Stash">
    <header class="home-stash__header">🏠 HOME STASH</header>

    <div class="home-stash__stats">
      <div class="home-stash__stat" title="Value of unsold items currently in the stash">
        <span class="home-stash__stat-label">Stash Value</span>
        <span class="home-stash__stat-value">{{ formatNumber(viewModel.stashValue.value) }}</span>
      </div>
      <div class="home-stash__stat" title="Coins earned by selling stash items or auto-selling overflow">
        <span class="home-stash__stat-label">🪙 Coin Value</span>
        <span class="home-stash__stat-value">{{ formatNumber(viewModel.coinValue.value) }}</span>
      </div>
      <div class="home-stash__stat">
        <span class="home-stash__stat-label">Items</span>
        <span class="home-stash__stat-value">{{ viewModel.totalItemCount.value }} / {{ HOME_STASH_ITEM_LIMIT }}</span>
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

<style scoped>
.home-stash {
  background: var(--color-surface);
  border-radius: 8px;
  border: 1px solid var(--color-border);
  padding: 14px;
  display: flex;
  flex-direction: column;
  max-height: 400px;
}

.home-stash__header {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  color: var(--color-accent);
  margin-bottom: 12px;
}

.home-stash__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.home-stash__stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--color-surface-raised);
  padding: 8px;
  border-radius: 4px;
}

.home-stash__stat-label {
  font-size: 0.7rem;
  color: var(--color-muted);
  font-family: var(--font-mono);
}

.home-stash__stat-value {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text);
  font-family: var(--font-mono);
}
</style>
