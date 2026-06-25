<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useGameStore } from '../stores/gameStore'
import { advanceSignal, SIGNAL_COSTS, SIGNAL_CAP, SIGNAL_REGEN_MS } from '../engine/signal'

const store = useGameStore()
const nowMs = ref(Date.now())

// Update current time frequently for real-time timer display
let timerInterval: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timerInterval = setInterval(() => {
    nowMs.value = Date.now()
  }, 1000) // Update once per second (timer display is second-granularity)
})
onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
})

const signalSnapshot = computed(() => advanceSignal(store.state.signal, nowMs.value))
const currentSignal = computed(() => signalSnapshot.value.signal.current)
const signalAmplifiers = computed(() => store.state.signalAmplifiers + signalSnapshot.value.amplifiersGained)
const canCalm = computed(() => currentSignal.value >= SIGNAL_COSTS.CALM)
const canReadyUp = computed(() => currentSignal.value >= SIGNAL_COSTS.READY_UP)
const canPressure = computed(() => currentSignal.value >= SIGNAL_COSTS.PRESSURE)
const canCallExtract = computed(() => currentSignal.value >= SIGNAL_COSTS.CALL_EXTRACT)
const canUseSignalAmplifier = computed(() => signalAmplifiers.value > 0 && currentSignal.value < SIGNAL_CAP)
const isActionLocked = computed(() => store.hasPendingHandlerAction)
const isRaidConditionLocked = computed(() => store.raid.extracting !== null || store.raid.downed !== null)

// Calculate time until next signal regenerates
const nextRegenMs = computed(() => {
  const nextRegenAt = signalSnapshot.value.signal.lastRegenAt + SIGNAL_REGEN_MS
  return Math.max(0, nextRegenAt - nowMs.value)
})

const regenTimerDisplay = computed(() => {
  const seconds = Math.ceil(nextRegenMs.value / 1000)
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
})
</script>

<template>
  <section class="handler-actions panel-card shrink-0" aria-label="Handler Actions">
    <header class="section-header">📶 SIGNAL</header>
    <div class="flex items-center gap-1.5 mb-3.5" role="meter" aria-valuemin="0" :aria-valuenow="currentSignal" :aria-valuemax="SIGNAL_CAP">
      <span
        v-for="i in SIGNAL_CAP"
        :key="i"
        class="text-[1.1rem] transition-colors duration-200"
        :class="i <= currentSignal ? 'text-accent' : 'text-surface-raised'"
        aria-hidden="true"
      >●</span>
      <span class="font-mono text-[0.75rem] text-muted ml-1">{{ currentSignal }}/{{ SIGNAL_CAP }}</span>
      <span v-if="isActionLocked" class="ml-auto font-mono text-[0.72rem] text-accent">Action pending...</span>
      <span v-else class="ml-auto font-mono text-[0.72rem] text-muted tracking-wider">Next gain: {{ regenTimerDisplay }}</span>
    </div>

    <div class="grid grid-cols-[auto_auto_1fr] items-center gap-2 mb-3 px-2.5 py-2 rounded-md bg-surface-raised font-mono text-[0.75rem]">
      <span class="text-muted">Signal Amplifiers</span>
      <span class="text-accent font-bold">{{ signalAmplifiers }}</span>
      <button
        type="button"
        class="btn-ghost justify-self-end"
        :disabled="!canUseSignalAmplifier"
        @click="store.applySignalAmplifier()"
      >
        Refill to 5
      </button>
    </div>

    <div class="flex flex-col gap-2 min-h-0 overflow-y-auto pr-0.5 max-[600px]:gap-1.5">
      <button
        class="flex items-center gap-2 px-3 py-handler-action-button-y rounded-md border border-border bg-surface-raised text-text font-mono text-raider-value cursor-pointer transition-[background,opacity] duration-150 text-left hover:not-disabled:bg-border disabled:opacity-40 disabled:cursor-not-allowed max-[600px]:px-2.5 max-[600px]:py-2 max-[600px]:text-raider-meta"
        :disabled="!canReadyUp || store.phase !== 'HUB'"
        @click="store.readyUp()"
      >
        <span class="text-[1rem]">🎮</span>
        <span class="flex-1 font-semibold">Ready Up!</span>
        <span class="text-[0.75rem] text-muted max-[600px]:text-raider-tiny">{{ SIGNAL_COSTS.READY_UP }}📶</span>
      </button>

      <button
        class="flex items-center gap-2 px-3 py-handler-action-button-y rounded-md border border-border bg-surface-raised text-text font-mono text-raider-value cursor-pointer transition-[background,opacity] duration-150 text-left hover:not-disabled:bg-border disabled:opacity-40 disabled:cursor-not-allowed max-[600px]:px-2.5 max-[600px]:py-2 max-[600px]:text-raider-meta"
        :disabled="!canCalm || store.phase !== 'RAIDING' || isActionLocked || isRaidConditionLocked"
        @click="() => store.calm()"
      >
        <span class="text-[1rem]">📣</span>
        <span class="flex-1 font-semibold">Calm</span>
        <span class="text-[0.75rem] text-muted max-[600px]:text-raider-tiny">{{ SIGNAL_COSTS.CALM }}📶</span>
      </button>

      <button
        class="flex items-center gap-2 px-3 py-handler-action-button-y rounded-md border border-border bg-surface-raised text-text font-mono text-raider-value cursor-pointer transition-[background,opacity] duration-150 text-left hover:not-disabled:bg-border disabled:opacity-40 disabled:cursor-not-allowed max-[600px]:px-2.5 max-[600px]:py-2 max-[600px]:text-raider-meta"
        :disabled="!canPressure || store.phase !== 'RAIDING' || isActionLocked || isRaidConditionLocked"
        @click="() => store.pressure()"
      >
        <span class="text-[1rem]">🔇</span>
        <span class="flex-1 font-semibold">Pressure</span>
        <span class="text-[0.75rem] text-muted max-[600px]:text-raider-tiny">{{ SIGNAL_COSTS.PRESSURE }}📶</span>
      </button>

      <button
        class="flex items-center gap-2 px-3 py-handler-action-button-y rounded-md border border-danger text-danger font-mono text-raider-value cursor-pointer transition-[background,opacity] duration-150 text-left hover:not-disabled:bg-danger hover:not-disabled:text-bg disabled:opacity-40 disabled:cursor-not-allowed max-[600px]:px-2.5 max-[600px]:py-2 max-[600px]:text-raider-meta"
        :disabled="!canCallExtract || store.phase !== 'RAIDING' || isActionLocked || isRaidConditionLocked"
        @click="store.callExtract()"
      >
        <span class="text-[1rem]">🚨</span>
        <span class="flex-1 font-semibold">CALL EXTRACT</span>
        <span class="text-[0.75rem] max-[600px]:text-raider-tiny">{{ SIGNAL_COSTS.CALL_EXTRACT }}📶</span>
      </button>
    </div>
  </section>
</template>
