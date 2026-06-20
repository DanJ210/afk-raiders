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

// Greed bar fill color + text color
const greedColorClass = computed(() => {
  const c = viewModel.greedClass.value
  if (c === 'greed--low') return { bar: 'bg-success', text: 'text-success' }
  if (c === 'greed--mid') return { bar: 'bg-warning', text: 'text-warning' }
  return { bar: 'bg-danger', text: 'text-danger' }
})
</script>

<template>
  <div class="backpack-container flex flex-col gap-3 w-full">
    <div class="flex flex-col gap-2 w-full">
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
    </div>

    <section class="backpack-panel panel-card max-[600px]:min-h-backpack-mobile-min min-[601px]:min-h-backpack-desktop-min" aria-label="Backpack">
      <header class="section-header">🎒 BACKPACK</header>

      <div class="flex justify-between items-center mb-2.5">
        <span class="subpanel-label">Total Value</span>
        <span class="font-mono font-bold text-[1.2rem] text-text">{{ raid.backpackValue }}</span>
      </div>

      <div class="flex items-center gap-2 mb-2.5">
        <span class="subpanel-label">Greed Level</span>
        <div class="flex-1 h-2 bg-surface-raised rounded overflow-hidden" :title="`Greed: ${raid.greedLevel}/100`">
          <div
            class="h-full rounded transition-[width] duration-(--duration-greed-fill) ease-in-out"
            :class="greedColorClass.bar"
            :style="{ width: raid.greedLevel + '%' }"
          />
        </div>
        <span class="font-mono text-[0.75rem] min-w-greed-label text-right" :class="greedColorClass.text">
          {{ viewModel.greedLabel(raid.greedLevel) }}
        </span>
      </div>

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
  </div>
</template>
