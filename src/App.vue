<script setup lang="ts">
import { useGameStore } from './stores/gameStore'
import CommsLog from './components/CommsLog.vue'
import RaiderCard from './components/RaiderCard.vue'
import BackpackPanel from './components/BackpackPanel.vue'
import ExtractionPreference from './components/ExtractionPreference.vue'
import HomeStash from './components/HomeStash.vue'
import HandlerActions from './components/HandlerActions.vue'
import AwaySummary from './components/AwaySummary.vue'

const store = useGameStore()
</script>

<template>
  <div class="app">
    <header class="app__header">
      <h1 class="app__title">📡 AFK RAIDERS</h1>
      <span class="app__subtitle">Handler Console — Desperanza Underground</span>
      <button class="app__reset" title="Reset save data" @click="store.resetSave()">↺ Reset</button>
    </header>

    <main class="app__main">
      <aside class="app__sidebar">
        <RaiderCard />
        <BackpackPanel />
        <ExtractionPreference />
        <HomeStash />
        <HandlerActions />
      </aside>

      <div class="app__log">
        <CommsLog />
      </div>
    </main>

    <AwaySummary />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  max-width: 900px;
  margin: 0 auto;
  padding: 12px;
  gap: 12px;
}

.app__header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}

.app__title {
  font-family: var(--font-mono);
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-accent);
  margin: 0;
  letter-spacing: 0.08em;
}

.app__subtitle {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-muted);
  flex: 1;
}

.app__reset {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-muted);
  border-radius: 4px;
  padding: 3px 8px;
  cursor: pointer;
}

.app__reset:hover {
  color: var(--color-danger);
  border-color: var(--color-danger);
}

.app__main {
  flex: 1;
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 12px;
  min-height: 0;
}

.app__sidebar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

.app__log {
  min-height: 0;
}

/* Mobile: stack sidebar above log */
@media (max-width: 600px) {
  .app__main {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .app__log {
    min-height: 300px;
  }
}
</style>
