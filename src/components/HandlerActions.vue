<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/gameStore'
import { SIGNAL_COSTS, SIGNAL_CAP } from '../engine/signal'

const store = useGameStore()

const currentSignal = computed(() => store.signal.current)
const canEncourage = computed(() => currentSignal.value >= SIGNAL_COSTS.ENCOURAGE)
const canScold = computed(() => currentSignal.value >= SIGNAL_COSTS.SCOLD)
const canCallExtract = computed(() => currentSignal.value >= SIGNAL_COSTS.CALL_EXTRACT)
</script>

<template>
  <section class="handler-actions" aria-label="Handler Actions">
    <header class="handler-actions__header">📶 SIGNAL</header>

    <div class="signal-meter" role="meter" :aria-valuenow="currentSignal" :aria-valuemax="SIGNAL_CAP">
      <span
        v-for="i in SIGNAL_CAP"
        :key="i"
        class="signal-pip"
        :class="{ 'signal-pip--active': i <= currentSignal }"
        aria-hidden="true"
      >●</span>
      <span class="signal-meter__count">{{ currentSignal }}/{{ SIGNAL_CAP }}</span>
    </div>

    <div class="handler-actions__buttons">
      <button
        class="action-btn action-btn--encourage"
        :disabled="!canEncourage || store.phase !== 'RAIDING'"
        @click="store.encourage()"
      >
        <span class="action-btn__icon">📣</span>
        <span class="action-btn__label">Encourage</span>
        <span class="action-btn__cost">{{ SIGNAL_COSTS.ENCOURAGE }}📶</span>
      </button>

      <button
        class="action-btn action-btn--scold"
        :disabled="!canScold"
        :title="`Scold (${SIGNAL_COSTS.SCOLD} Signal) — nudge raider toward caution`"
        @click="store.scold()"
      >
        <span class="action-btn__icon">🔇</span>
        <span class="action-btn__label">Scold</span>
        <span class="action-btn__cost">{{ SIGNAL_COSTS.SCOLD }}📶</span>
      </button>

      <button
        class="action-btn action-btn--extract"
        :disabled="!canCallExtract"
        :title="`CALL EXTRACT (${SIGNAL_COSTS.CALL_EXTRACT} Signal) — force extraction attempt next tick`"
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
  background: var(--color-surface);
  border-radius: 8px;
  border: 1px solid var(--color-border);
  padding: 14px;
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

.handler-actions__buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
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
</style>
