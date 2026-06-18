<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/gameStore'
import { useBackpackViewModel } from '../composables/useBackpackViewModel'
import FieldMedsPanel from './FieldMedsPanel.vue'
import ShieldRechargersPanel from './ShieldRechargersPanel.vue'
import BackpackItemsList from './BackpackItemsList.vue'
import HiddenPocketPanel from './HiddenPocketPanel.vue'
import BackpackItemDialog from './BackpackItemDialog.vue'

const store = useGameStore()
const raid = computed(() => store.raid)
const raider = computed(() => store.raider)

// Use the composable for all view-model logic
const viewModel = useBackpackViewModel(raid, raider)

// Handlers for component events
function handleItemClick(itemId: string) {
  viewModel.openBackpackItemDetails(itemId)
}

function handleHiddenPocketClear() {
  store.clearHiddenPocketItem()
}

function handleDialogClose() {
  viewModel.closeBackpackItemDetails()
}

function handleDialogSave() {
  if (!viewModel.selectedBackpackItem.value) return
  store.setHiddenPocketItem(viewModel.selectedBackpackItem.value.itemId)
  viewModel.closeBackpackItemDetails()
}

function handleDialogRemove() {
  store.clearHiddenPocketItem()
  viewModel.closeBackpackItemDetails()
}

function handleApplyShieldRecharger(itemId: string) {
  if (!viewModel.canApplyShieldCharge.value) return
  store.applyShieldRecharger(itemId)
}
</script>

<template>
  <section class="backpack-panel" aria-label="Backpack">
    <header class="backpack-panel__header">🎒 BACKPACK</header>

    <div class="backpack-panel__value">
      <span class="backpack-panel__label">Total Value</span>
      <span class="backpack-panel__amount">{{ raid.backpackValue }}</span>
    </div>

    <div class="backpack-panel__greed">
      <span class="backpack-panel__label">Greed Level</span>
      <div class="greed-bar" :title="`Greed: ${raid.greedLevel}/100`">
        <div class="greed-bar__fill" :class="viewModel.greedClass.value" :style="{ width: raid.greedLevel + '%' }" />
      </div>
      <span class="backpack-panel__greed-label" :class="viewModel.greedClass.value">
        {{ viewModel.greedLabel(raid.greedLevel) }}
      </span>
    </div>

    <ShieldRechargersPanel
      :items="viewModel.shieldRechargerItems.value"
      :can-apply="viewModel.canApplyAnyShieldRecharger.value"
      @apply="handleApplyShieldRecharger"
    />

    <FieldMedsPanel
      :items="viewModel.healingItems.value"
      :can-apply="viewModel.canApplyHealing.value"
      @apply="store.applyHealingItem"
    />

    <HiddenPocketPanel
      :hidden-pocket="viewModel.hiddenPocket.value"
      :can-manage="viewModel.canManageHiddenPocket.value"
      @clear="handleHiddenPocketClear"
    />

    <BackpackItemsList
      :items="viewModel.backpackItems.value"
      :phase="raid.phase"
      @item-click="handleItemClick"
    />

    <BackpackItemDialog
      :item="viewModel.selectedBackpackItem.value"
      :hidden-pocket="viewModel.hiddenPocket.value"
      :total-value="viewModel.selectedBackpackItemTotalValue.value"
      :can-save="viewModel.canSaveToPocket.value"
      :can-remove="viewModel.canManageHiddenPocket.value"
      @close="handleDialogClose"
      @save="handleDialogSave"
      @remove="handleDialogRemove"
    />
  </section>
</template>

<style scoped>
.backpack-panel {
  background: var(--color-surface);
  border-radius: 8px;
  border: 1px solid var(--color-border);
  padding: 14px;
  display: flex;
  flex-direction: column;
  max-height: none;
  min-height: 0;
}

.backpack-panel__header {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  color: var(--color-accent);
  margin-bottom: 12px;
}

.backpack-panel__value {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.backpack-panel__label {
  font-size: 0.75rem;
  color: var(--color-muted);
  font-family: var(--font-mono);
}

.backpack-panel__amount {
  font-size: 1.2rem;
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--color-text);
}

.backpack-panel__greed {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.greed-bar {
  flex: 1;
  height: 8px;
  background: var(--color-surface-raised);
  border-radius: 4px;
  overflow: hidden;
}

.greed-bar__fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s ease;
}

.greed--low {
  background: var(--color-success);
  color: var(--color-success);
}
.greed--mid {
  background: var(--color-warning);
  color: var(--color-warning);
}
.greed--high {
  background: var(--color-danger);
  color: var(--color-danger);
}

.backpack-panel__greed-label {
  font-size: 0.75rem;
  font-family: var(--font-mono);
  min-width: 90px;
  text-align: right;
}

@media (max-width: 600px) {
  .backpack-panel {
    min-height: 0;
    max-height: none;
  }
}

@media (min-width: 601px) {
  .backpack-panel {
    min-height: 640px;
    max-height: none;
  }
}
</style>
