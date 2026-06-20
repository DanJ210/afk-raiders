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

const shieldFillClass = computed(() => {
  if (!shield.value || shield.value.durability <= 0) return 'bg-muted'
  if (shieldPercent.value > 60) return 'bg-accent'
  if (shieldPercent.value > 30) return 'bg-warning'
  return 'bg-danger'
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
  <div class="flex flex-col gap-1 w-full min-w-0">
    <p v-if="recharge" class="m-0 text-[0.68rem] text-accent font-mono">
      Shield is still recharging...
    </p>

    <div class="flex items-center gap-2 min-w-0 w-full max-[600px]:gap-1.5">
      <span class="shrink-0 font-mono text-[0.72rem] tracking-[0.04em] text-muted max-[600px]:text-[0.68rem]" :class="compact ? 'min-w-[42px]' : 'min-w-[58px]'">{{ label ?? 'Shield' }}</span>
      <div
        class="flex-1 min-w-0 h-2 rounded-full overflow-hidden border border-border bg-bg"
        role="progressbar"
        aria-valuemin="0"
        :aria-valuenow="displayedCharge"
        :aria-valuemax="displayedMaxCharge"
        aria-label="Raider shield"
      >
        <div class="h-full transition-[width] duration-200 ease-in-out" :class="shieldFillClass" :style="{ width: shieldPercent + '%' }" />
      </div>
      <span class="shrink-0 font-mono text-[0.72rem] text-text max-[600px]:text-[0.68rem]">{{ displayedCharge }}/{{ displayedMaxCharge }}</span>
    </div>

    <div class="flex justify-between gap-2 min-w-0 w-full max-[600px]:pl-[48px] max-[600px]:gap-1.5">
      <span class="shrink-0 font-mono text-[0.72rem] text-muted min-w-0 [overflow-wrap:anywhere] max-[600px]:hidden">{{ shieldStatus }}</span>
      <span class="shrink-0 font-mono text-[0.72rem] text-muted max-[600px]:text-[0.68rem]">Durability {{ displayedDurability }}%</span>
    </div>

    <div v-if="recharge" class="flex flex-col gap-1 w-full">
      <div class="flex justify-between gap-2 flex-wrap">
        <span class="shrink-0 font-mono text-[0.72rem] tracking-[0.04em] text-muted" :class="compact ? 'min-w-[42px]' : 'min-w-[58px]'">Recharge</span>
        <span class="shrink-0 font-mono text-[0.72rem] text-text">
          {{ recharge.name }} · {{ recharge.totalTicks - recharge.ticksRemaining }}/{{ recharge.totalTicks }} ticks
        </span>
      </div>
      <div
        class="h-2 bg-border-subtle border border-border rounded-full overflow-hidden"
        role="progressbar"
        aria-valuemin="0"
        :aria-valuenow="shieldRechargeProgress"
        aria-valuemax="100"
      >
        <div
          class="w-full h-full transition-[width] duration-[250ms] ease-in-out"
          :style="{ width: shieldRechargeProgress + '%', background: 'linear-gradient(90deg, #4b9ef0, #7b9ef0, #f0c84b)' }"
        />
      </div>
    </div>
  </div>
</template>
