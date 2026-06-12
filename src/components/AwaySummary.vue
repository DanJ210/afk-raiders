<script setup lang="ts">
import { useGameStore } from '../stores/gameStore'

const store = useGameStore()
</script>

<template>
  <div
    v-if="store.awaySummary"
    class="away-summary"
    role="alert"
    aria-live="assertive"
  >
    <div class="away-summary__inner">
      <div class="away-summary__header">
        <span class="away-summary__icon">📡</span>
        <span class="away-summary__title">WHILE YOU WERE AWAY…</span>
      </div>
      <ul class="away-summary__lines">
        <li v-for="line in store.awaySummary.lines" :key="line">{{ line }}</li>
      </ul>
      <button class="away-summary__dismiss" @click="store.dismissAwaySummary()">
        Acknowledged
      </button>
    </div>
  </div>
</template>

<style scoped>
.away-summary {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 16px;
}

.away-summary__inner {
  background: var(--color-surface);
  border: 1px solid var(--color-accent);
  border-radius: 10px;
  padding: 24px;
  max-width: 420px;
  width: 100%;
}

.away-summary__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.away-summary__icon {
  font-size: 1.4rem;
}

.away-summary__title {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  letter-spacing: 0.1em;
  color: var(--color-accent);
  font-weight: 700;
}

.away-summary__lines {
  list-style: none;
  padding: 0;
  margin: 0 0 20px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.away-summary__lines li {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  color: var(--color-text);
  padding-left: 16px;
  position: relative;
}

.away-summary__lines li::before {
  content: '>';
  position: absolute;
  left: 0;
  color: var(--color-accent);
}

.away-summary__dismiss {
  display: block;
  width: 100%;
  padding: 10px;
  background: var(--color-accent);
  color: var(--color-bg);
  border: none;
  border-radius: 6px;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  letter-spacing: 0.05em;
}

.away-summary__dismiss:hover {
  opacity: 0.85;
}
</style>
