<script setup lang="ts">
import { computed, ref } from 'vue'
import { useNow } from '@vueuse/core'
import { useGameStore } from '../stores/gameStore'
import { zoneName } from '../utils/zones'
import { TICK_INTERVAL_MS } from '../engine/catchUp'
import ShieldBar from './ShieldBar.vue'
import MoodResilienceBadge from './MoodResilienceBadge.vue'
import RaiderLifetimeStats from './RaiderLifetimeStats.vue'

const store = useGameStore()
const raider = computed(() => store.raider)
const lifetimeStats = computed(() => store.state.stats)
const activeShieldRecharge = computed(() => store.raid.activeShieldRecharge)
const currentZoneName = computed(() => zoneName(store.raid.zone))
const showCurrentZone = computed(() => store.phase === 'RAIDING' && currentZoneName.value !== null)
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
  if (mood >= -2) return '😒 Grumpy'
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

const hpClass = computed(() => {
  if (hpPercent.value > 60) return 'hp-bar--good'
  if (hpPercent.value > 30) return 'hp-bar--warning'
  return 'hp-bar--danger'
})
</script>

<template>
  <section class="raider-card" aria-label="Raider Status">
    <div class="raider-card__header">
      <span v-if="!editingName" class="raider-card__name" role="button" tabindex="0" title="Click to rename" @click="startEdit" @keydown.enter.prevent="startEdit" @keydown.space.prevent="startEdit">
        {{ raider.name }}
        <span class="raider-card__name-edit-icon">✏️</span>
      </span>
      <span v-else class="raider-card__name-edit">
        <input
          v-model="nameInput"
          class="raider-card__name-input"
          :maxlength="store.RAIDER_NAME_MAX_LENGTH"
          autofocus
          @keydown="onNameKeydown"
          @blur="commitEdit"
        />
      </span>
      <span class="raider-card__phase-badge" :data-phase="store.phase">
        {{ phaseLabel(store.phase) }}<span v-if="showPhaseTimer"> · {{ phaseTimerText }}</span>
      </span>
    </div>

    <div class="raider-card__stats">
      <ShieldBar :shield="raidShield" :recharge="activeShieldRecharge" />

      <div class="raider-card__stat">
        <div
          class="hp-bar"
          role="progressbar"
          aria-valuemin="0"
          :aria-valuenow="raider.hp"
          :aria-valuemax="raider.maxHp"
        >
          <div class="hp-bar__fill" :class="hpClass" :style="{ width: hpPercent + '%' }" />
        </div>
        <span class="raider-card__stat-value">{{ raider.hp }}/{{ raider.maxHp }}</span>
      </div>

      <div class="raider-card__stat">
        <span class="raider-card__stat-label">Mood</span>
        <span class="raider-card__stat-value raider-card__mood-value">
          {{ moodLabel(raider.mood) }}
          <MoodResilienceBadge :mood="raider.mood" />
        </span>
      </div>

      <div v-if="showCurrentZone" class="raider-card__stat">
        <span class="raider-card__stat-label">Zone</span>
        <span class="raider-card__stat-value">{{ currentZoneName }}</span>
      </div>

      <div v-if="showRaidTimer" class="raider-card__stat">
        <span class="raider-card__stat-label">Zone Nuke In</span>
        <span class="raider-card__stat-value raider-card__timer">{{ raidTimerText }}</span>
      </div>

      <div class="raider-card__stat">
        <span class="raider-card__stat-label">Rat Rating</span>
        <span class="raider-card__stat-value raider-card__rat-rating">
          🐀 {{ raider.ratRating }}
        </span>
      </div>

      <div class="raider-card__counters">
        <span title="Extractions">✅ {{ raider.extractCount }}</span>
        <span title="Deaths">💀 {{ raider.deathCount }}</span>
      </div>

      <RaiderLifetimeStats :stats="lifetimeStats" />
    </div>
  </section>
</template>

<style scoped>
.raider-card {
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-radius: 8px;
  border: 1px solid var(--color-border);
  padding: 14px;
  min-height: 0;
  overflow: hidden;
}

.raider-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.raider-card__name {
  font-family: var(--font-mono);
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.raider-card__name:hover .raider-card__name-edit-icon {
  opacity: 1;
}

.raider-card__name-edit-icon {
  font-size: 0.7rem;
  opacity: 0.3;
  transition: opacity 0.15s;
}

.raider-card__name-input {
  font-family: var(--font-mono);
  font-size: 1rem;
  font-weight: 700;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-accent);
  border-radius: 4px;
  color: var(--color-text);
  padding: 1px 6px;
  width: 14ch;
  outline: none;
}

.raider-card__phase-badge {
  font-size: 0.7rem;
  font-family: var(--font-mono);
  padding: 2px 8px;
  border-radius: 4px;
  letter-spacing: 0.05em;
  background: var(--color-surface-raised);
  color: var(--color-accent);
  border: 1px solid var(--color-accent);
}

.raider-card__phase-badge[data-phase="DOWNED"] {
  color: var(--color-danger);
  border-color: var(--color-danger);
}

.raider-card__phase-badge[data-phase="EXTRACTING"] {
  color: var(--color-success);
  border-color: var(--color-success);
  animation: pulse 1s infinite;
}

.raider-card__stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}

.raider-card__stat {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.raider-card__stat-label {
  font-size: 0.75rem;
  color: var(--color-muted);
  font-family: var(--font-mono);
  min-width: 72px;
}

.raider-card__stat-value {
  font-size: 0.85rem;
  color: var(--color-text);
  font-family: var(--font-mono);
  min-width: 0;
  overflow-wrap: anywhere;
}

.raider-card__mood-value {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0;
}

.raider-card__rat-rating {
  color: var(--color-accent-secondary);
}

.raider-card__timer {
  color: var(--color-danger);
  font-weight: 700;
}

.hp-bar {
  flex: 1;
  min-width: 0;
  height: 8px;
  background: var(--color-surface-raised);
  border-radius: 4px;
  overflow: hidden;
}

.hp-bar__fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s ease;
}

.hp-bar--good   { background: var(--color-success); }
.hp-bar--warning { background: var(--color-warning); }
.hp-bar--danger  { background: var(--color-danger); }

.raider-card__counters {
  display: flex;
  gap: 16px;
  font-size: 0.8rem;
  font-family: var(--font-mono);
  color: var(--color-muted);
  margin-top: 4px;
}

@media (max-width: 600px) {
  .raider-card {
    padding: 10px;
  }

  .raider-card__header {
    flex-wrap: wrap;
    row-gap: 6px;
  }

  .raider-card__name {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .raider-card__phase-badge {
    margin-left: auto;
  }

  .raider-card__stat {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .raider-card__stat-label {
    min-width: 0;
  }

  .raider-card__counters {
    flex-wrap: wrap;
    gap: 8px 12px;
  }

  .raider-card__history {
    margin-top: 10px;
  }

  .raider-card__history-grid {
    gap: 10px;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
}
</style>
