<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ActiveShieldRecharge, GameState, ShieldState } from '../engine/types'
import ShieldBar from './ShieldBar.vue'
import MoodResilienceBadge from './MoodResilienceBadge.vue'

interface Props {
  raider: GameState['raider']
  phase: GameState['raid']['phase']
  showPhaseTimer: boolean
  phaseTimerText: string
  raidShield: ShieldState | null
  activeShieldRecharge: ActiveShieldRecharge | null
  nameMaxLength: number
  allowRename?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  allowRename: true,
})

const emit = defineEmits<{
  rename: [newName: string]
}>()

const editingName = ref(false)
const nameInput = ref('')

function startEdit() {
  if (!props.allowRename) return
  nameInput.value = props.raider.name
  editingName.value = true
}

function commitEdit() {
  if (!props.allowRename) return
  if (!editingName.value) return
  emit('rename', nameInput.value)
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

const hpPercent = computed(() =>
  Math.round((props.raider.hp / props.raider.maxHp) * 100),
)

const hpFillColor = computed(() => {
  if (hpPercent.value > 60) return 'bg-success'
  if (hpPercent.value > 30) return 'bg-warning'
  return 'bg-danger'
})

const phaseBadgeClass = computed(() => {
  if (props.phase === 'DOWNED') return 'text-danger border-danger'
  if (props.phase === 'EXTRACTING') return 'text-success border-success animate-pulse'
  return 'text-accent border-accent'
})
</script>

<template>
  <div class="flex flex-col gap-2 shrink-0 pr-0.5">
    <div class="flex justify-between items-center mb-1 max-[600px]:flex-wrap max-[600px]:gap-y-1.5">
      <span
        v-if="props.allowRename && !editingName"
        class="group font-mono text-base font-bold text-text cursor-pointer flex items-center gap-1 max-[600px]:min-w-0 max-[600px]:[overflow-wrap:anywhere]"
        role="button"
        tabindex="0"
        title="Click to rename"
        @click="startEdit"
        @keydown.enter.prevent="startEdit"
        @keydown.space.prevent="startEdit"
      >
        {{ raider.name }}
        <span class="text-raider-tiny opacity-30 transition-opacity duration-150 group-hover:opacity-100">✏️</span>
      </span>
      <span v-else-if="props.allowRename && editingName">
        <input
          v-model="nameInput"
          class="font-mono text-base font-bold bg-surface-raised border border-accent rounded text-text px-1.5 py-px w-[14ch] outline-none"
          :maxlength="nameMaxLength"
          autofocus
          @keydown="onNameKeydown"
          @blur="commitEdit"
        />
      </span>
      <span
        v-else
        class="font-mono text-base font-bold text-text max-[600px]:min-w-0 max-[600px]:[overflow-wrap:anywhere]"
      >
        {{ raider.name }}
      </span>
      <span
        class="font-mono text-raider-tiny px-2 py-0.5 rounded border bg-surface-raised tracking-wider max-[600px]:ml-auto"
        :class="phaseBadgeClass"
      >
        {{ phaseLabel(phase) }}<span v-if="showPhaseTimer"> · {{ phaseTimerText }}</span>
      </span>
    </div>

    <ShieldBar :shield="raidShield" :recharge="activeShieldRecharge" />

    <div class="flex items-center gap-2 min-w-0 max-[600px]:items-start max-[600px]:flex-wrap">
      <div
        class="flex-1 min-w-0 h-2 bg-surface-raised rounded overflow-hidden"
        role="progressbar"
        aria-valuemin="0"
        :aria-valuenow="raider.hp"
        :aria-valuemax="raider.maxHp"
      >
        <div class="h-full rounded transition-[width] duration-(--duration-greed-fill) ease-in-out" :class="hpFillColor" :style="{ width: hpPercent + '%' }" />
      </div>
      <span class="font-mono text-raider-value text-text min-w-0 [overflow-wrap:anywhere]">{{ raider.hp }}/{{ raider.maxHp }}</span>
    </div>

    <div class="flex items-center gap-2 min-w-0 max-[600px]:items-start max-[600px]:flex-wrap">
      <span class="font-mono text-xs text-muted min-w-raider-label max-[600px]:min-w-0">Mood</span>
      <span class="font-mono text-raider-value text-text min-w-0 [overflow-wrap:anywhere] inline-flex items-center flex-wrap">
        {{ moodLabel(raider.mood) }}
        <MoodResilienceBadge :mood="raider.mood" />
      </span>
    </div>
  </div>
</template>

<style scoped>
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.animate-pulse {
  animation: pulse 1s infinite;
}
</style>
