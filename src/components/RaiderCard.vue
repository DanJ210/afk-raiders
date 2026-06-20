<script setup lang="ts">
import { computed } from 'vue'
import { useNow } from '@vueuse/core'
import { useGameStore } from '../stores/gameStore'
import { zoneConditionByDangerLevel, zoneDescription, zoneName } from '../utils/zones'
import { TICK_INTERVAL_MS } from '../engine/catchUp'
import RaiderStatusHeaderStats from './RaiderStatusHeaderStats.vue'
import RaiderLifetimeStats from './RaiderLifetimeStats.vue'

const store = useGameStore()
const raider = computed(() => store.raider)
const lifetimeStats = computed(() => store.state.stats)
const activeShieldRecharge = computed(() => store.raid.activeShieldRecharge)
const currentZoneName = computed(() => zoneName(store.raid.zone))
const currentZoneDescription = computed(() => zoneDescription(store.raid.zone))
const showCurrentZone = computed(() => store.phase === 'RAIDING' && currentZoneName.value !== null)
const currentCondition = computed(() =>
  store.raid.zoneCondition ?? zoneConditionByDangerLevel(store.raid.dangerLevel),
)
const showCurrentCondition = computed(() => store.phase === 'RAIDING' && currentCondition.value !== null)
const showRaidTimer = computed(() => store.phase === 'RAIDING')
const now = useNow({ interval: 1000 })
const phaseTimerMs = computed(() => {
  if (store.raid.phaseTicksRemaining <= 0) return 0
  const phaseRemainingMs = store.raid.phaseTicksRemaining * TICK_INTERVAL_MS
  const elapsedSinceLastTick = Math.max(0, now.value.getTime() - store.lastTickAt)
  return Math.max(0, phaseRemainingMs - elapsedSinceLastTick)
})
const raidTimerMs = computed(() => (store.phase === 'RAIDING' ? phaseTimerMs.value : 0))
const phaseTimerText = computed(() => formatDuration(phaseTimerMs.value))
const raidTimerText = computed(() => formatDuration(raidTimerMs.value))
const showPhaseTimer = computed(() => phaseTimerMs.value > 0)
const raidShield = computed(() => store.raid.shield)

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

</script>

<template>
  <section class="raider-card panel-card shrink-0 max-[600px]:p-2.5" aria-label="Raider Status">
    <RaiderStatusHeaderStats
      class="shrink-0"
      :raider="raider"
      :phase="store.phase"
      :show-phase-timer="showPhaseTimer"
      :phase-timer-text="phaseTimerText"
      :raid-shield="raidShield"
      :active-shield-recharge="activeShieldRecharge"
      :name-max-length="store.RAIDER_NAME_MAX_LENGTH"
      @rename="store.renameRaider"
    />

    <div class="flex flex-col gap-2 min-h-0">

      <div v-if="showCurrentZone" class="flex items-center gap-2 min-w-0 max-[600px]:items-start max-[600px]:flex-wrap">
        <span class="font-mono text-xs text-muted min-w-raider-label max-[600px]:min-w-0">Zone</span>
        <button
          v-if="currentZoneName"
          type="button"
          class="relative font-mono text-raider-value text-text min-w-0 [overflow-wrap:anywhere] border-none bg-transparent p-0 underline decoration-dotted underline-offset-2 cursor-help text-left group"
          :aria-label="currentZoneDescription ? `Zone ${currentZoneName}. ${currentZoneDescription}` : `Zone ${currentZoneName}`"
        >
          {{ currentZoneName }}
          <span
            v-if="currentZoneDescription"
            class="tooltip"
            role="tooltip"
          >
            {{ currentZoneDescription }}
          </span>
        </button>
      </div>

      <div v-if="showCurrentCondition" class="flex items-center gap-2 min-w-0 max-[600px]:items-start max-[600px]:flex-wrap">
        <span class="font-mono text-xs text-muted min-w-raider-label max-[600px]:min-w-0">Condition</span>
        <button
          v-if="currentCondition"
          type="button"
          class="relative font-mono text-raider-value text-text min-w-0 [overflow-wrap:anywhere] border-none bg-transparent p-0 underline decoration-dotted underline-offset-2 cursor-help text-left group"
          :aria-label="currentCondition.description ? `Condition ${currentCondition.name}. ${currentCondition.description}` : `Condition ${currentCondition.name}`"
        >
          {{ currentCondition.name }}
          <span
            v-if="currentCondition.description"
            class="tooltip"
            role="tooltip"
          >
            {{ currentCondition.description }}
          </span>
        </button>
      </div>

      <div v-if="showRaidTimer" class="flex items-center gap-2 min-w-0">
        <span class="font-mono text-xs text-muted min-w-raider-label">Zone Nuke In</span>
        <span class="font-mono text-raider-value text-danger font-bold">{{ raidTimerText }}</span>
      </div>

      <div class="flex items-center gap-2 min-w-0">
        <span class="font-mono text-xs text-muted min-w-raider-label">Rat Rating</span>
        <span class="font-mono text-raider-value text-accent-secondary">🐀 {{ raider.ratRating }}</span>
      </div>

      <div class="flex gap-4 font-mono text-raider-meta text-muted mt-1 max-[600px]:flex-wrap max-[600px]:gap-x-3 max-[600px]:gap-y-2">
        <span title="Extractions">✅ {{ raider.extractCount }}</span>
        <span title="Deaths">💀 {{ raider.deathCount }}</span>
      </div>

      <RaiderLifetimeStats :stats="lifetimeStats" />
    </div>
  </section>
</template>

<style scoped>
/* Shared tooltip — used for Zone and Condition */
.tooltip {
  position: absolute;
  left: 0;
  top: calc(100% + 6px);
  z-index: 2;
  display: none;
  width: min(42ch, 70vw);
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-text);
  font-size: 0.75rem;
  line-height: 1.35;
  text-decoration: none;
  letter-spacing: normal;
  box-shadow: 0 6px 14px color-mix(in srgb, var(--color-bg) 70%, transparent);
}

.group:hover .tooltip,
.group:focus-visible .tooltip,
.group:active .tooltip {
  display: block;
}
</style>
