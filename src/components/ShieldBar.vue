<script setup lang="ts">
import { computed } from 'vue'

interface ShieldViewModel {
  charge: number
  maxCharge: number
  durability: number
  mitigation?: number
}

interface ShieldRechargeViewModel {
  name: string
  totalTicks: number
  ticksRemaining: number
}

const props = defineProps<{
  shield: unknown
  label?: string
  recharge?: unknown
  compact?: boolean
}>()

function isShieldViewModel(value: unknown): value is ShieldViewModel {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.charge === 'number'
    && typeof record.maxCharge === 'number'
    && typeof record.durability === 'number'
  )
}

const shield = computed<ShieldViewModel | null>(() => {
  if (!isShieldViewModel(props.shield)) return null
  return props.shield
})

function isShieldRechargeViewModel(value: unknown): value is ShieldRechargeViewModel {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.name === 'string'
    && typeof record.totalTicks === 'number'
    && typeof record.ticksRemaining === 'number'
  )
}

const recharge = computed<ShieldRechargeViewModel | null>(() => {
  if (!isShieldRechargeViewModel(props.recharge)) return null
  return props.recharge
})

const shieldPercent = computed(() => {
  if (!shield.value || shield.value.maxCharge <= 0) return 0
  const percent = (shield.value.charge / shield.value.maxCharge) * 100
  return Math.max(0, Math.min(100, Math.round(percent)))
})

const shieldClass = computed(() => {
  if (!shield.value || shield.value.durability <= 0) return 'shield-bar__fill--broken'
  if (shieldPercent.value > 60) return 'shield-bar__fill--strong'
  if (shieldPercent.value > 30) return 'shield-bar__fill--warning'
  return 'shield-bar__fill--weak'
})

const shieldStatus = computed(() => {
  if (!shield.value) return 'No shield'
  if (shield.value.durability <= 0) return 'Broken'
  if (shield.value.charge <= 0) return 'Depleted'
  if (recharge.value) return 'Recharging'
  if (typeof shield.value.mitigation === 'number') {
    return `${Math.round(shield.value.mitigation * 100)}% mitigation`
  }
  return 'Active'
})

const displayedCharge = computed(() => shield.value?.charge ?? 0)
const displayedMaxCharge = computed(() => shield.value?.maxCharge ?? 100)
const displayedDurability = computed(() => Math.round(shield.value?.durability ?? 0))

const shieldRechargeProgress = computed(() => {
  const active = recharge.value
  if (!active || active.totalTicks <= 0) return 0
  const completedTicks = active.totalTicks - active.ticksRemaining
  return Math.max(0, Math.min(100, Math.round((completedTicks / active.totalTicks) * 100)))
})
</script>

<template>
  <div class="shield-bar" :class="{ 'shield-bar--compact': compact }">
    <p v-if="recharge" class="shield-bar__recharge-note">
      Shield is still recharging...
    </p>

    <div class="shield-bar__row">
      <span class="shield-bar__label">{{ label ?? 'Shield' }}</span>
      <div
        class="shield-bar__track"
        role="progressbar"
        aria-valuemin="0"
        :aria-valuenow="displayedCharge"
        :aria-valuemax="displayedMaxCharge"
        aria-label="Raider shield"
      >
        <div class="shield-bar__fill" :class="shieldClass" :style="{ width: shieldPercent + '%' }" />
      </div>
      <span class="shield-bar__value">{{ displayedCharge }}/{{ displayedMaxCharge }}</span>
    </div>

    <div v-if="!compact" class="shield-bar__details-row">
      <span class="shield-bar__status">{{ shieldStatus }}</span>
      <span class="shield-bar__durability">Durability {{ displayedDurability }}%</span>
    </div>

    <div v-if="!compact && recharge" class="shield-recharge">
      <div class="shield-recharge__header">
        <span class="shield-bar__label">Recharge</span>
        <span class="shield-bar__value">
          {{ recharge.name }} · {{ recharge.totalTicks - recharge.ticksRemaining }}/{{ recharge.totalTicks }} ticks
        </span>
      </div>
      <div class="shield-recharge__bar" role="progressbar" aria-valuemin="0" :aria-valuenow="shieldRechargeProgress" aria-valuemax="100">
        <div class="shield-recharge__fill" :style="{ width: shieldRechargeProgress + '%' }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.shield-bar {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  min-width: 0;
}

.shield-bar__row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  width: 100%;
}

.shield-bar__recharge-note {
  margin: 0;
  font-size: 0.68rem;
  color: var(--color-accent);
  font-family: var(--font-mono);
}

.shield-bar__details-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  width: 100%;
}

.shield-bar__label {
  flex-shrink: 0;
  min-width: 58px;
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  color: var(--color-muted);
  font-family: var(--font-mono);
}

.shield-bar__track {
  flex: 1;
  min-width: 0;
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
}

.shield-bar__fill {
  height: 100%;
  transition: width 0.2s ease;
}

.shield-bar__fill--strong {
  background: var(--color-accent);
}

.shield-bar__fill--warning {
  background: var(--color-warning);
}

.shield-bar__fill--weak {
  background: var(--color-danger);
}

.shield-bar__fill--broken {
  background: var(--color-muted);
}

.shield-bar__value,
.shield-bar__status,
.shield-bar__durability {
  flex-shrink: 0;
  font-size: 0.72rem;
  color: var(--color-text);
  font-family: var(--font-mono);
  
}

.shield-bar__status {
  color: var(--color-muted);
  min-width: 0;
  overflow-wrap: anywhere;
}

.shield-bar__durability {
  color: var(--color-muted);
}

.shield-recharge {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.shield-recharge__header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.shield-recharge__bar {
  height: 8px;
  background: var(--color-border-subtle);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  overflow: hidden;
}

.shield-recharge__fill {
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, #4b9ef0, #7b9ef0, #f0c84b);
  transition: width 0.25s ease;
}

.shield-bar--compact .shield-bar__label {
  min-width: 42px;
}

.shield-bar--compact .shield-bar__details-row,
.shield-bar--compact .shield-bar__status,
.shield-bar--compact .shield-bar__durability {
  display: none;
}

@media (max-width: 600px) {
  .shield-bar__row {
    gap: 6px;
  }

  .shield-bar__details-row {
    padding-left: 48px;
    gap: 6px;
  }

  .shield-bar__label {
    min-width: 42px;
    font-size: 0.68rem;
  }

  .shield-bar__value,
  .shield-bar__status,
  .shield-bar__durability {
    font-size: 0.68rem;
  }

  .shield-bar__status {
    display: none;
  }
}
</style>
