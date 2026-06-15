<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { useGameStore } from './stores/gameStore'
import { zoneName } from './utils/zones'
import CommsLog from './components/CommsLog.vue'
import RaiderCard from './components/RaiderCard.vue'
import BackpackPanel from './components/BackpackPanel.vue'
import HomeStash from './components/HomeStash.vue'
import HandlerActions from './components/HandlerActions.vue'
import AwaySummary from './components/AwaySummary.vue'

const store = useGameStore()
const isMobile = useMediaQuery('(max-width: 600px)')

type MobileTabId = 'comms' | 'stash' | 'raider' | 'raid'

const mobileTabs: Array<{ id: MobileTabId; label: string; icon: string }> = [
  { id: 'comms', label: 'Comms Feed', icon: '📻' },
  { id: 'stash', label: 'Home Stash', icon: '🏠' },
  { id: 'raider', label: 'Raider', icon: '🧍' },
  { id: 'raid', label: 'Current Raid', icon: '🎒' },
]

const activeMobileTab = ref<MobileTabId>('comms')

const currentZoneName = computed(() => zoneName(store.raid.zone))
const currentTimeOfDay = computed(() => store.raid.timeOfDay)
const showZoneStrip = computed(
  () => store.phase === 'RAIDING' && currentZoneName.value !== null,
)
</script>

<template>
  <div class="app">
    <header class="app__header">
      <h1 class="app__title">📡 AFK RAIDERS</h1>
      <span class="app__subtitle">Handler Console — Desperanza Underground</span>
      <button class="app__reset" title="Reset save data" @click="store.resetSave()">↺ Reset</button>
    </header>

    <main v-if="!isMobile" class="app__main">
      <aside class="app__sidebar">
        <RaiderCard />
        <BackpackPanel />
        <HomeStash />
        <HandlerActions />
      </aside>

      <div class="app__log">
        <CommsLog />
      </div>
    </main>

    <main v-else class="app__main-mobile">
      <div v-if="showZoneStrip" class="app__zone-strip">
        📍 Zone: <strong>{{ currentZoneName }}</strong><span v-if="currentTimeOfDay"> · <span class="app__zone-tod">{{ currentTimeOfDay }}</span></span>
      </div>

      <section v-if="activeMobileTab === 'comms'" class="app__mobile-panel app__mobile-panel--fill">
        <CommsLog />
      </section>

      <section v-if="activeMobileTab === 'raid'" class="app__mobile-panel app__mobile-panel--fill">
        <BackpackPanel />
      </section>

      <section v-if="activeMobileTab === 'raider'" class="app__mobile-panel app__mobile-panel--fill">
        <RaiderCard />
        <HandlerActions />
      </section>

      <section v-if="activeMobileTab === 'stash'" class="app__mobile-panel app__mobile-panel--fill">
        <HomeStash />
      </section>
    </main>

    <nav v-if="isMobile" class="app__mobile-nav" aria-label="Primary">
      <button
        v-for="tab in mobileTabs"
        :key="tab.id"
        type="button"
        class="app__mobile-nav-btn"
        :class="{ 'app__mobile-nav-btn--active': activeMobileTab === tab.id }"
        :aria-current="activeMobileTab === tab.id ? 'page' : undefined"
        @click="activeMobileTab = tab.id">
        <span class="app__mobile-nav-icon" aria-hidden="true">{{ tab.icon }}</span>
        <span class="app__mobile-nav-label">{{ tab.label }}</span>
      </button>
    </nav>

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

.app__main-mobile {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.app__zone-strip {
  flex: none;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--color-muted);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 5px 10px;
}

.app__zone-strip strong {
  color: var(--color-accent);
  font-weight: 700;
}

.app__zone-tod {
  color: var(--color-muted);
}

.app__mobile-panel {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

.app__mobile-panel--fill > * {
  flex: 1;
  min-height: 0;
}

.app__mobile-nav {
  position: sticky;
  bottom: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  background: var(--color-bg);
  border-top: 1px solid var(--color-border);
  padding: 8px 0 calc(8px + env(safe-area-inset-bottom));
}

.app__mobile-nav-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: none;
  border: 1px solid transparent;
  color: var(--color-muted);
  border-radius: 8px;
  padding: 6px 4px;
  cursor: pointer;
  font-family: var(--font-mono);
}

.app__mobile-nav-btn--active {
  color: var(--color-accent);
  background: var(--color-surface);
  border-color: var(--color-border);
}

.app__mobile-nav-icon {
  font-size: 1rem;
}

.app__mobile-nav-label {
  font-size: 0.62rem;
  letter-spacing: 0.03em;
  text-align: center;
}

@media (max-width: 600px) {
  .app {
    padding-bottom: 0;
  }

  .app__header {
    align-items: center;
  }

  .app__subtitle {
    width: 100%;
    flex: none;
  }

  .app__mobile-panel--fill :deep(.comms-log),
  .app__mobile-panel--fill :deep(.home-stash),
  .app__mobile-panel--fill :deep(.backpack-panel) {
    height: 100%;
    max-height: none;
  }
}
</style>
