<script setup lang="ts">
import { computed, ref } from 'vue'
import { useNow } from '@vueuse/core'
import { useGameStore } from '../stores/gameStore'
import { zoneConditionByDangerLevel, zoneDescription, zoneName } from '../utils/zones'
import { TICK_INTERVAL_MS } from '../engine/catchUp'
import ShieldBar from './ShieldBar.vue'
import MoodResilienceBadge from './MoodResilienceBadge.vue'
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

const editingName = ref(false)
const nameInput = ref('')

function startEdit() {
  nameInput.value = raider.value.name
  editingName.value = true
}

function commitEdit() {
  if (!editingName.value) return
  store.renameRaider(nameInput.value)
  editingName.value = false
}

function cancelEdit() {
  editingName.value = false
}

function onNameKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') commitEdit()
  if (e.key === 'Escape') cancelEdit()
}

function phaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    HUB: 'In Hub',
    DEPLOYING: 'Deploying…',
    RAIDING: 'Raiding',
    EXTRACTING: 'Extracting!',
    DOWNED: 'DOWNED',
  }
  return labels[phase] ?? phase
}

function moodLabel(mood: number): string {
  if (mood >= 3) return '😤 Fired up'
  if (mood >= 1) return '🙂 OK'
  if (mood === 0) return '😐 Neutral'
  if (mood >= -2) return '😒 Crank Face'
  return '😩 Demoralized'
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const hpPercent = computed(() =>
  Math.round((raider.value.hp / raider.value.maxHp) * 100),
)

const hpFillColor = computed(() => {
  if (hpPercent.value > 60) return 'bg-success'
  if (hpPercent.value > 30) return 'bg-warning'
  return 'bg-danger'
})

// Phase badge classes — replaces [data-phase] selectors
const phaseBadgeClass = computed(() => {
  if (store.phase === 'DOWNED') return 'text-danger border-danger'
  if (store.phase === 'EXTRACTING') return 'text-success border-success animate-pulse'
  return 'text-accent border-accent'
})
</script>

<template>
  <section class="raider-card panel-card max-[600px]:p-2.5" aria-label="Raider Status">
    <div class="flex justify-between items-center mb-3 max-[600px]:flex-wrap max-[600px]:gap-y-1.5">
      <span
        v-if="!editingName"
        class="font-mono text-base font-bold text-text cursor-pointer flex items-center gap-1 max-[600px]:min-w-0 max-[600px]:overflow-wrap-anywhere"
        role="button"
        tabindex="0"
        title="Click to rename"
        @click="startEdit"
        @keydown.enter.prevent="startEdit"
        @keydown.space.prevent="startEdit"
      >
        {{ raider.name }}
        <span class="text-[0.7rem] opacity-30 transition-opacity duration-150 group-hover:opacity-100">✏️</span>
      </span>
      <span v-else>
        <input
          v-model="nameInput"
          class="font-mono text-base font-bold bg-surface-raised border border-accent rounded text-text px-1.5 py-px w-[14ch] outline-none"
          :maxlength="store.RAIDER_NAME_MAX_LENGTH"
          autofocus
          @keydown="onNameKeydown"
          @blur="commitEdit"
        />
      </span>
      <span
        class="font-mono text-[0.7rem] px-2 py-0.5 rounded border bg-surface-raised tracking-[0.05em] max-[600px]:ml-auto"
        :class="phaseBadgeClass"
      >
        {{ phaseLabel(store.phase) }}<span v-if="showPhaseTimer"> · {{ phaseTimerText }}</span>
      </span>
    </div>

    <div class="flex flex-col gap-2 min-h-0 overflow-y-auto pr-0.5">
      <ShieldBar :shield="raidShield" :recharge="activeShieldRecharge" />

      <!-- HP bar row -->
      <div class="flex items-center gap-2 min-w-0 max-[600px]:items-start max-[600px]:flex-wrap">
        <div
          class="flex-1 min-w-0 h-2 bg-surface-raised rounded overflow-hidden"
          role="progressbar"
          aria-valuemin="0"
          :aria-valuenow="raider.hp"
          :aria-valuemax="raider.maxHp"
        >
          <div class="h-full rounded transition-[width] duration-[400ms] ease-in-out" :class="hpFillColor" :style="{ width: hpPercent + '%' }" />
        </div>
        <span class="font-mono text-[0.85rem] text-text min-w-0 overflow-wrap-anywhere">{{ raider.hp }}/{{ raider.maxHp }}</span>
      </div>

      <div class="flex items-center gap-2 min-w-0 max-[600px]:items-start max-[600px]:flex-wrap">
        <span class="font-mono text-[0.75rem] text-muted min-w-[72px] max-[600px]:min-w-0">Mood</span>
        <span class="font-mono text-[0.85rem] text-text min-w-0 overflow-wrap-anywhere inline-flex items-center flex-wrap">
          {{ moodLabel(raider.mood) }}
          <MoodResilienceBadge :mood="raider.mood" />
        </span>
      </div>

      <div v-if="showCurrentZone" class="flex items-center gap-2 min-w-0 max-[600px]:items-start max-[600px]:flex-wrap">
        <span class="font-mono text-[0.75rem] text-muted min-w-[72px] max-[600px]:min-w-0">Zone</span>
        <button
          v-if="currentZoneName"
          type="button"
          class="relative font-mono text-[0.85rem] text-text min-w-0 overflow-wrap-anywhere border-none bg-transparent p-0 underline decoration-dotted underline-offset-2 cursor-help text-left group"
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
        <span class="font-mono text-[0.75rem] text-muted min-w-[72px] max-[600px]:min-w-0">Condition</span>
        <button
          v-if="currentCondition"
          type="button"
          class="relative font-mono text-[0.85rem] text-text min-w-0 overflow-wrap-anywhere border-none bg-transparent p-0 underline decoration-dotted underline-offset-2 cursor-help text-left group"
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
        <span class="font-mono text-[0.75rem] text-muted min-w-[72px]">Zone Nuke In</span>
        <span class="font-mono text-[0.85rem] text-danger font-bold">{{ raidTimerText }}</span>
      </div>

      <div class="flex items-center gap-2 min-w-0">
        <span class="font-mono text-[0.75rem] text-muted min-w-[72px]">Rat Rating</span>
        <span class="font-mono text-[0.85rem] text-accent-secondary">🐀 {{ raider.ratRating }}</span>
      </div>

      <div class="flex gap-4 font-mono text-[0.8rem] text-muted mt-1 max-[600px]:flex-wrap max-[600px]:gap-x-3 max-[600px]:gap-y-2">
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

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
}

.animate-pulse {
  animation: pulse 1s infinite;
}
</style>
