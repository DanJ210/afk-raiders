<script setup lang="ts">
import { computed } from 'vue'
import { ref } from 'vue'
import { useGameStore } from '../stores/gameStore'
import FieldMedsPanel from './FieldMedsPanel.vue'
import ShieldRechargersPanel from './ShieldRechargersPanel.vue'
import { rarityLabel, rarityBarClass } from '../utils/rarity'
import type { BackpackItem } from '../engine/types'

const store = useGameStore()
const raid = computed(() => store.raid)
const hiddenPocket = computed(() => raid.value.hiddenPocket)
const shield = computed(() => raid.value.shield)
const selectedBackpackItemId = ref<string | null>(null)

const backpackItems = computed(() =>
  [...raid.value.backpack]
    .filter(item => item.itemId !== hiddenPocket.value?.itemId)
    .filter(item => !isShieldRecharger(item))
    .sort((a, b) => {
    if (b.rarity !== a.rarity) return b.rarity - a.rarity
    if (b.value !== a.value) return b.value - a.value
    return a.name.localeCompare(b.name)
    }),
)

const healingItems = computed(() =>
  [...raid.value.healingItems].sort((a, b) => {
    if (b.healAmount !== a.healAmount) return b.healAmount - a.healAmount
    return a.name.localeCompare(b.name)
  }),
)

const shieldRechargerItems = computed(() =>
  [...raid.value.backpack]
    .filter(item => item.itemId !== hiddenPocket.value?.itemId)
    .filter(isShieldRecharger)
    .sort((a, b) => {
      if (b.shieldChargeAmount !== a.shieldChargeAmount) return b.shieldChargeAmount - a.shieldChargeAmount
      if (b.rarity !== a.rarity) return b.rarity - a.rarity
      return a.name.localeCompare(b.name)
    }),
)

function greedLabel(level: number): string {
  if (level < 20) return '😌 Chill'
  if (level < 40) return '🤑 Interested'
  if (level < 60) return '😤 Pushing It'
  if (level < 80) return '🚨 Reckless'
  return '☠️ DEATH WISH'
}

function isShieldRecharger(item: BackpackItem | null): item is BackpackItem & { kind: 'shield_recharger'; shieldChargeAmount: number } {
  return item?.kind === 'shield_recharger' && typeof item.shieldChargeAmount === 'number'
}

const greedClass = computed(() => {
  const g = raid.value.greedLevel
  if (g < 40) return 'greed--low'
  if (g < 70) return 'greed--mid'
  return 'greed--high'
})

const canApplyHealing = computed(() =>
  raid.value.phase !== 'HUB' &&
  raid.value.phase !== 'DOWNED' &&
  store.raider.hp > 0 &&
  store.raider.hp < store.raider.maxHp,
)

const canManageHiddenPocket = computed(() =>
  raid.value.phase !== 'HUB' && raid.value.phase !== 'DOWNED',
)

const canApplyShieldCharge = computed(() =>
  raid.value.phase === 'RAIDING' &&
  raid.value.activeShieldRecharge === null &&
  shield.value !== null &&
  shield.value.durability > 0 &&
  shield.value.charge < shield.value.maxCharge,
)

function isPocketed(itemId: string): boolean {
  return hiddenPocket.value?.itemId === itemId
}

const selectedBackpackItem = computed(() => {
  if (!selectedBackpackItemId.value) return null
  return raid.value.backpack.find(item => item.itemId === selectedBackpackItemId.value) ?? null
})

const selectedBackpackItemTotalValue = computed(() =>
  selectedBackpackItem.value ? selectedBackpackItem.value.value * selectedBackpackItem.value.quantity : 0,
)

const canSaveToPocket = computed(() =>
  !!selectedBackpackItem.value &&
  !isPocketed(selectedBackpackItem.value.itemId) &&
  canManageHiddenPocket.value,
)

const canApplyAnyShieldRecharger = computed(() =>
  canApplyShieldCharge.value && shieldRechargerItems.value.length > 0,
)

function openBackpackItemDetails(itemId: string) {
  selectedBackpackItemId.value = itemId
}

function closeBackpackItemDetails() {
  selectedBackpackItemId.value = null
}

function saveSelectedItemToPocket() {
  if (!selectedBackpackItem.value || !canManageHiddenPocket.value) return
  store.setHiddenPocketItem(selectedBackpackItem.value.itemId)
  closeBackpackItemDetails()
}

function removePocketItem() {
  if (!hiddenPocket.value || !canManageHiddenPocket.value) return
  store.clearHiddenPocketItem()
}

function applyShieldRecharger(itemId: string) {
  if (!canApplyShieldCharge.value) return
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
        <div
          class="greed-bar__fill"
          :class="greedClass"
          :style="{ width: raid.greedLevel + '%' }"
        />
      </div>
      <span class="backpack-panel__greed-label" :class="greedClass">
        {{ greedLabel(raid.greedLevel) }}
      </span>
    </div>

    <FieldMedsPanel
      :items="healingItems"
      :can-apply="canApplyHealing"
      @apply="store.applyHealingItem"
    />

    <ShieldRechargersPanel
      :items="shieldRechargerItems"
      :can-apply="canApplyAnyShieldRecharger"
      @apply="applyShieldRecharger"
    />

    <div class="backpack-panel__hidden-pocket">
      <div class="backpack-panel__hidden-pocket-header">
        <span class="backpack-panel__label">Secret Hidden Pocket</span>
        <button
          v-if="hiddenPocket"
          type="button"
          class="backpack-panel__hidden-pocket-clear"
          :disabled="!canManageHiddenPocket"
          @click="store.clearHiddenPocketItem()"
        >
          Remove
        </button>
      </div>
      <p v-if="!hiddenPocket" class="backpack-panel__hidden-pocket-empty">
        Empty. Pick 1 backpack item to save if the raid fails.
      </p>
      <div v-else class="backpack-panel__hidden-pocket-item">
        <span :class="rarityBarClass(hiddenPocket.rarity)" :title="rarityLabel(hiddenPocket.rarity)" aria-hidden="true" />
        <span class="backpack-panel__hidden-pocket-name">{{ hiddenPocket.name }}</span>
        <span class="backpack-panel__hidden-pocket-meta">Value {{ hiddenPocket.value }}</span>
      </div>
    </div>

    <p v-if="raid.backpack.length === 0 && raid.phase === 'HUB'" class="backpack-panel__empty">
      Backpack empty. Ready for terrible decisions.
    </p>
    <p v-else-if="raid.backpack.length === 0" class="backpack-panel__empty">
      Nothing yet. The zone is full of possibilities and also robots.
    </p>

    <ul v-else class="backpack-panel__items">
      <li
        v-for="item in backpackItems"
        :key="item.itemId"
        class="backpack-panel__item backpack-panel__item--clickable"
        role="button"
        tabindex="0"
        @click="openBackpackItemDetails(item.itemId)"
        @keydown.enter.prevent="openBackpackItemDetails(item.itemId)"
        @keydown.space.prevent="openBackpackItemDetails(item.itemId)"
      >
        <div class="backpack-panel__item-main">
          <span :class="rarityBarClass(item.rarity)" :title="rarityLabel(item.rarity)" aria-hidden="true" />
          <span class="backpack-panel__item-name">{{ item.name }}</span>
          <span class="backpack-panel__item-meta">{{ rarityLabel(item.rarity) }}</span>
        </div>
        <div class="backpack-panel__item-sub">
          <span>Value {{ item.value }}</span>
          <span v-if="item.kind === 'shield_recharger'">+{{ item.shieldChargeAmount }} Shield</span>
          <span v-if="item.quantity > 1">x{{ item.quantity }}</span>
        </div>
        <p v-if="item.flavor" class="backpack-panel__item-flavor">{{ item.flavor }}</p>
      </li>
    </ul>

    <div
      v-if="selectedBackpackItem"
      class="stash-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Secret Hidden Pocket"
      @click.self="closeBackpackItemDetails"
      @keydown.esc="closeBackpackItemDetails"
    >
      <div class="stash-dialog__card">
        <div class="stash-dialog__header">
          <div class="stash-dialog__title">
            <span class="stash-dialog__emoji">🕳️</span>
            <div>
              <h3 class="stash-dialog__name">{{ selectedBackpackItem.name }}</h3>
              <p class="stash-dialog__meta">
                {{ rarityLabel(selectedBackpackItem.rarity) }} · ×{{ selectedBackpackItem.quantity }} ·
                {{ selectedBackpackItemTotalValue }} value
              </p>
            </div>
          </div>
          <button type="button" class="stash-dialog__close" autofocus @click="closeBackpackItemDetails">✕</button>
        </div>

        <p class="stash-dialog__description">
          {{ selectedBackpackItem.flavor || 'No description available.' }}
        </p>

        <p v-if="selectedBackpackItem.kind === 'shield_recharger'" class="stash-dialog__description stash-dialog__description--utility">
          Restores {{ selectedBackpackItem.shieldChargeAmount }} shield charge when applied from the backpack.
        </p>

        <div class="stash-dialog__actions">
          <button type="button" class="stash-dialog__button stash-dialog__button--secondary" @click="closeBackpackItemDetails">
            Cancel
          </button>
          <button
            v-if="hiddenPocket && hiddenPocket.itemId === selectedBackpackItem.itemId"
            type="button"
            class="stash-dialog__button stash-dialog__button--secondary"
            :disabled="!canManageHiddenPocket"
            @click="removePocketItem(); closeBackpackItemDetails()"
          >
            Remove From Secret Pocket
          </button>
          <button
            v-else
            type="button"
            class="stash-dialog__button stash-dialog__button--primary"
            :disabled="!canSaveToPocket"
            @click="saveSelectedItemToPocket"
          >
            {{ hiddenPocket ? 'Replace Secret Pocket Item' : 'Save In Secret Pocket' }}
          </button>
        </div>
      </div>
    </div>
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
  max-height: 400px;
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

.backpack-panel__hidden-pocket {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
  padding: 10px;
  border: 1px solid color-mix(in oklab, var(--color-accent-secondary) 70%, var(--color-border));
  border-radius: 6px;
  background:
    linear-gradient(135deg, rgb(255 255 255 / 2%), rgb(0 0 0 / 8%)),
    var(--color-surface-raised);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 3%);
}

.backpack-panel__hidden-pocket-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.backpack-panel__hidden-pocket-clear {
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: transparent;
  color: var(--color-muted);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  padding: 2px 8px;
  cursor: pointer;
}

.backpack-panel__hidden-pocket-clear:hover:not(:disabled) {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.backpack-panel__hidden-pocket-clear:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.backpack-panel__hidden-pocket-empty {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--color-accent-secondary);
  font-style: italic;
}

.backpack-panel__hidden-pocket-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-text);
}

.backpack-panel__hidden-pocket-name {
  flex: 1;
}

.backpack-panel__hidden-pocket-meta {
  color: var(--color-accent-secondary);
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

.greed--low  { background: var(--color-success); color: var(--color-success); }
.greed--mid  { background: var(--color-warning); color: var(--color-warning); }
.greed--high { background: var(--color-danger);  color: var(--color-danger); }

.backpack-panel__greed-label {
  font-size: 0.75rem;
  font-family: var(--font-mono);
  min-width: 90px;
  text-align: right;
}

.backpack-panel__empty {
  font-size: 0.8rem;
  color: var(--color-muted);
  font-style: italic;
  margin-top: 8px;
}

.backpack-panel__items {
  list-style: none;
  padding: 0;
  margin: 12px 0 0;
  display: grid;
  gap: 8px;
  align-content: start;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  padding-right: 2px;
}

.backpack-panel__item {
  border: 1px solid var(--color-border-subtle);
  border-radius: 6px;
  background: var(--color-surface-raised);
  padding: 8px 10px;
}

.backpack-panel__item--clickable {
  cursor: pointer;
}

.backpack-panel__item--clickable:hover,
.backpack-panel__item--clickable:focus-visible {
  border-color: var(--color-accent);
  outline: none;
}

.backpack-panel__item-main,
.backpack-panel__item-sub {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.backpack-panel__item-name {
  flex: 1;
  font-size: 0.86rem;
  color: var(--color-text);
}

.backpack-panel__item-meta,
.backpack-panel__item-sub,
.backpack-panel__item-flavor {
  font-size: 0.72rem;
  color: var(--color-muted);
  font-family: var(--font-mono);
}

.stash-dialog__description--utility {
  color: var(--color-accent);
}

.backpack-panel__item-sub {
  margin-top: 4px;
}

.backpack-panel__item-flavor {
  margin: 6px 0 0;
  font-style: italic;
  line-height: 1.4;
}

.stash-dialog {
  position: fixed;
  inset: 0;
  background: rgb(5 10 16 / 78%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 50;
}

.stash-dialog__card {
  width: min(100%, 420px);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 16px;
  box-shadow: 0 16px 40px rgb(0 0 0 / 35%);
}

.stash-dialog__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.stash-dialog__title {
  display: flex;
  gap: 10px;
  min-width: 0;
}

.stash-dialog__emoji {
  font-size: 1.5rem;
  line-height: 1;
}

.stash-dialog__name {
  margin: 0;
  font-size: 1rem;
  color: var(--color-text);
}

.stash-dialog__meta {
  margin: 4px 0 0;
  color: var(--color-muted);
  font-size: 0.75rem;
  font-family: var(--font-mono);
}

.stash-dialog__close {
  border: 0;
  background: transparent;
  color: var(--color-muted);
  font-size: 1rem;
  cursor: pointer;
}

.stash-dialog__description {
  margin: 14px 0 0;
  color: var(--color-text);
  line-height: 1.5;
}

.stash-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.stash-dialog__button {
  border-radius: 6px;
  padding: 10px 14px;
  font-family: var(--font-mono);
  cursor: pointer;
  border: 1px solid var(--color-border);
}

.stash-dialog__button--secondary {
  background: var(--color-surface-raised);
  color: var(--color-text);
}

.stash-dialog__button--primary {
  background: var(--color-accent);
  color: var(--color-bg);
  border-color: var(--color-accent);
}

.stash-dialog__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 600px) {
  .stash-dialog__actions {
    flex-direction: column-reverse;
  }

  .stash-dialog__button {
    width: 100%;
  }
}
</style>
