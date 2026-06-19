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
  <section class="handler-actions" aria-label="Handler Actions">
    <header class="handler-actions__header">📶 SIGNAL</header>
    <div class="signal-meter" role="meter" aria-valuemin="0" :aria-valuenow="currentSignal" :aria-valuemax="SIGNAL_CAP">
      <span
        v-for="i in SIGNAL_CAP"
        :key="i"
        class="signal-pip"
        :class="{ 'signal-pip--active': i <= currentSignal }"
        aria-hidden="true"
      >●</span>
      <span class="signal-meter__count">{{ currentSignal }}/{{ SIGNAL_CAP }}</span>
      <span v-if="isActionLocked" class="signal-meter__pending">Action pending...</span>
      <span v-else class="signal-meter__regen-timer">Next gain: {{ regenTimerDisplay }}</span>
    </div>

    <div class="signal-amplifiers">
      <span class="signal-amplifiers__label">Signal Amplifiers</span>
      <span class="signal-amplifiers__count">{{ signalAmplifiers }}</span>
      <button
        type="button"
        class="signal-amplifiers__use"
        :disabled="!canUseSignalAmplifier"
        @click="store.applySignalAmplifier()"
      >
        Refill to 5
      </button>
    </div>

    <div class="handler-actions__buttons">
      <button
        class="action-btn action-btn--ready-up"
        :disabled="!canReadyUp || store.phase !== 'HUB'"
        @click="store.readyUp()"
      >
        <span class="action-btn__icon">🎮</span>
        <span class="action-btn__label">Ready Up!</span>
        <span class="action-btn__cost">{{ SIGNAL_COSTS.READY_UP }}📶</span>
      </button>

      <button
        class="action-btn action-btn--calm"
        :disabled="!canCalm || store.phase !== 'RAIDING' || isActionLocked"
        @click="() => store.calm()"
      >
        <span class="action-btn__icon">📣</span>
        <span class="action-btn__label">Calm</span>
        <span class="action-btn__cost">{{ SIGNAL_COSTS.CALM }}📶</span>
      </button>

      <button
        class="action-btn action-btn--pressure"
        :disabled="!canPressure || store.phase !== 'RAIDING' || isActionLocked"
        @click="() => store.pressure()"
      >
        <span class="action-btn__icon">🔇</span>
        <span class="action-btn__label">Pressure</span>
        <span class="action-btn__cost">{{ SIGNAL_COSTS.PRESSURE }}📶</span>
      </button>

      <button
        class="action-btn action-btn--extract"
        :disabled="!canCallExtract || store.phase !== 'RAIDING' || isActionLocked"
        @click="store.callExtract()"
      >
        <span class="action-btn__icon">🚨</span>
        <span class="action-btn__label">CALL EXTRACT</span>
        <span class="action-btn__cost">{{ SIGNAL_COSTS.CALL_EXTRACT }}📶</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.handler-actions {
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-radius: 8px;
  border: 1px solid var(--color-border);
  padding: 14px;
  min-height: 0;
  overflow: hidden;
}

.handler-actions__header {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  color: var(--color-accent);
  margin-bottom: 12px;
}

.signal-meter {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 14px;
}

.signal-pip {
  font-size: 1.1rem;
  color: var(--color-surface-raised);
  transition: color 0.2s;
}

.signal-pip--active {
  color: var(--color-accent);
}

.signal-meter__count {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-muted);
  margin-left: 4px;
}

.signal-meter__pending {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--color-accent);
}

.signal-meter__regen-timer {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--color-muted);
  letter-spacing: 0.05em;
}

.signal-amplifiers {
  display: grid;
  grid-template-columns: auto auto 1fr;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--color-surface-raised);
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

.signal-amplifiers__label {
  color: var(--color-muted);
}

.signal-amplifiers__count {
  color: var(--color-accent);
  font-weight: 700;
}

.signal-amplifiers__use {
  justify-self: end;
  border: 1px solid var(--color-accent);
  border-radius: 4px;
  background: transparent;
  color: var(--color-accent);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  padding: 2px 8px;
  cursor: pointer;
}

.signal-amplifiers__use:hover:not(:disabled) {
  background: var(--color-accent);
  color: var(--color-bg);
}

.signal-amplifiers__use:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.handler-actions__buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
  text-align: left;
}

.action-btn:hover:not(:disabled) {
  background: var(--color-border);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.action-btn__icon { font-size: 1rem; }

.action-btn__label {
  flex: 1;
  font-weight: 600;
}

.action-btn__cost {
  font-size: 0.75rem;
  color: var(--color-muted);
}

.action-btn--extract {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.action-btn--extract:hover:not(:disabled) {
  background: var(--color-danger);
  color: var(--color-bg);
}

@media (max-width: 600px) {
  .handler-actions {
    padding: 10px;
  }

  .handler-actions__header {
    margin-bottom: 8px;
  }

  .signal-meter {
    margin-bottom: 10px;
  }

  .handler-actions__buttons {
    gap: 6px;
  }

  .action-btn {
    padding: 8px 10px;
    font-size: 0.8rem;
  }

  .action-btn__cost {
    font-size: 0.7rem;
  }
}
</style>
