<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '../stores/gameStore'

const store = useGameStore()
const raider = computed(() => store.raider)

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
      <span v-if="!editingName" class="raider-card__name" title="Click to rename" @click="startEdit">
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
        {{ phaseLabel(store.phase) }}
      </span>
    </div>

    <div class="raider-card__stats">
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
        <span class="raider-card__stat-value">{{ moodLabel(raider.mood) }}</span>
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
    </div>
  </section>
</template>

<style scoped>
.raider-card {
  background: var(--color-surface);
  border-radius: 8px;
  border: 1px solid var(--color-border);
  padding: 14px;
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
}

.raider-card__stat {
  display: flex;
  align-items: center;
  gap: 8px;
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
}

.raider-card__rat-rating {
  color: var(--color-accent-secondary);
}

.hp-bar {
  flex: 1;
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

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
}
</style>
