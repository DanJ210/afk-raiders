<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMediaQuery, useNow } from '@vueuse/core'
import { useGameStore } from './stores/gameStore'
import { zoneConditionByDangerLevel, zoneName } from './utils/zones'
import { TICK_INTERVAL_MS } from './engine/catchUp'
import CommsLog from './components/CommsLog.vue'
import RaiderCard from './components/RaiderCard.vue'
import BackpackPanel from './components/BackpackPanel.vue'
import HomeStash from './components/HomeStash.vue'
import HandlerActions from './components/HandlerActions.vue'
import AwaySummary from './components/AwaySummary.vue'
import PWAInstallPrompt from './components/PWAInstallPrompt.vue'
import PhaseStatusStrip from './components/PhaseStatusStrip.vue'

const store = useGameStore()
const isMobile = useMediaQuery('(max-width: 600px)')

type MobileTabId = 'comms' | 'stash' | 'raider' | 'raid'

const mobileTabs: Array<{ id: MobileTabId; label: string; icon: string }> = [
  { id: 'comms', label: 'Comms Feed', icon: '📻' },
  { id: 'raid', label: 'Current Raid', icon: '🎒' },
  { id: 'raider', label: 'Raider', icon: '🧍' },
  { id: 'stash', label: 'Home Stash', icon: '🏠' },
]

const activeMobileTab = ref<MobileTabId>('comms')
const now = useNow({ interval: 1000 })
const logCount = computed(() => store.log.length)
const latestLogKey = computed(() => {
  const latest = store.log.at(-1)
  if (!latest) return ''
  return `${latest.tick}-${latest.id}-${latest.timestamp}`
})

// Badge: track how many log entries the user has seen while on the comms tab.
const unseenCommsCount = ref(0)
watch(
  [activeMobileTab, logCount, latestLogKey],
  ([tab, count, key], [, previousCount, previousKey]) => {
    if (tab === 'comms') {
      unseenCommsCount.value = 0
      return
    }

    if (!key || key === previousKey) return

    // Log is capped, so once full the length can stay flat while new entries arrive.
    const delta = Math.max(0, count - (previousCount ?? count))
    unseenCommsCount.value += delta > 0 ? delta : 1
  },
  { immediate: true },
)

const currentZoneName = computed(() => zoneName(store.raid.zone))
const currentDangerLevel = computed(() => store.raid.dangerLevel)
const fallbackCondition = computed(() => zoneConditionByDangerLevel(store.raid.dangerLevel))
const currentConditionName = computed(() => store.raid.zoneCondition?.name ?? fallbackCondition.value?.name ?? null)
const currentConditionDescription = computed(() => store.raid.zoneCondition?.description ?? fallbackCondition.value?.description ?? null)

const phaseTimerMs = computed(() => {
  if (store.raid.phaseTicksRemaining <= 0) return 0
  const phaseRemainingMs = store.raid.phaseTicksRemaining * TICK_INTERVAL_MS
  const elapsedSinceLastTick = Math.max(0, now.value.getTime() - store.lastTickAt)
  return Math.max(0, phaseRemainingMs - elapsedSinceLastTick)
})

const phaseTimeText = computed(() => {
  if (phaseTimerMs.value <= 0) return null
  const totalSeconds = Math.floor(phaseTimerMs.value / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})
</script>

<template>
  <div class="flex flex-col min-h-dvh max-w-225 mx-auto p-3 gap-3 max-[600px]:h-dvh max-[600px]:min-h-0 max-[600px]:pb-0">
    <header class="flex items-baseline gap-3 flex-wrap max-[600px]:items-center">
      <h1 class="font-mono text-[1.1rem] font-bold text-accent m-0 tracking-[0.08em]">📡 AFK RAIDERS</h1>
      <span class="font-mono text-[0.75rem] text-muted flex-1 max-[600px]:w-full max-[600px]:flex-none">Handler Console — Desperanza Underground</span>
      <button
        class="font-mono text-[0.7rem] bg-transparent border border-border text-muted rounded px-2 py-0.5 cursor-pointer hover:text-danger hover:border-danger"
        title="Reset save data"
        @click="store.resetSave()"
      >↺ Reset</button>
    </header>

    <main v-if="!isMobile" class="app__desktop-main flex-1 grid gap-3 min-h-0" style="grid-template-columns: minmax(240px,260px) minmax(0,1fr) minmax(240px,260px)">
      <aside class="flex flex-col gap-2.5 overflow-visible">
        <HandlerActions />
        <RaiderCard />
        <HomeStash />
      </aside>

      <div class="min-h-0">
        <CommsLog />
      </div>

      <aside class="app__raid flex flex-col min-h-0">
        <BackpackPanel />
      </aside>
    </main>

    <main v-else class="flex-1 min-h-0 flex flex-col gap-2">
      <PhaseStatusStrip
        :phase="store.phase"
        :zone-name="currentZoneName"
        :danger-level="currentDangerLevel"
        :phase-time-text="phaseTimeText"
        :condition-name="currentConditionName"
        :condition-description="currentConditionDescription"
      />

      <section v-if="activeMobileTab === 'comms'" class="app__mobile-fill min-h-0 flex-1 flex flex-col gap-2.5 overflow-y-auto">
        <CommsLog />
      </section>

      <section v-if="activeMobileTab === 'raid'" class="app__mobile-fill min-h-0 flex-1 flex flex-col gap-2.5 overflow-y-auto">
        <BackpackPanel />
      </section>

      <section v-if="activeMobileTab === 'raider'" class="min-h-0 flex-1 flex flex-col gap-2.5 overflow-y-auto pb-3">
        <HandlerActions />
        <RaiderCard />
      </section>

      <section v-if="activeMobileTab === 'stash'" class="app__mobile-fill min-h-0 flex-1 flex flex-col gap-2.5 overflow-y-auto">
        <HomeStash />
      </section>
    </main>

    <nav
      v-if="isMobile"
      class="sticky bottom-0 grid grid-cols-4 gap-1.5 bg-bg border-t border-border pt-2"
      :style="{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }"
      aria-label="Primary"
    >
      <button
        v-for="tab in mobileTabs"
        :key="tab.id"
        type="button"
        class="flex flex-col items-center gap-1 bg-transparent border border-transparent text-muted rounded-lg py-1.5 px-1 cursor-pointer font-mono"
        :class="activeMobileTab === tab.id ? 'text-accent bg-surface border-border' : ''"
        :aria-current="activeMobileTab === tab.id ? 'page' : undefined"
        @click="activeMobileTab = tab.id"
      >
        <span class="relative inline-flex items-center justify-center">
          <span class="text-[1rem]" aria-hidden="true">{{ tab.icon }}</span>
          <span
            v-if="tab.id === 'comms' && unseenCommsCount > 0"
            class="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-danger text-bg text-[0.58rem] font-mono font-bold leading-4 text-center pointer-events-none"
            :aria-label="`${unseenCommsCount} unread messages`"
          >
            {{ unseenCommsCount > 99 ? '99+' : unseenCommsCount }}
          </span>
        </span>
        <span class="text-[0.62rem] tracking-[0.03em] text-center">{{ tab.label }}</span>
      </button>
    </nav>

    <AwaySummary />
    <PWAInstallPrompt />
  </div>
</template>

<style scoped>
/* Desktop: force backpack panel to fill the column height */
.app__raid :deep(.backpack-panel) {
  height: 100%;
  max-height: none;
}

/* Mobile: force full-bleed panels to fill available height */
.app__mobile-fill > * {
  flex: 1;
  min-height: 0;
}

.app__mobile-fill :deep(.comms-log),
.app__mobile-fill :deep(.home-stash),
.app__mobile-fill :deep(.backpack-panel) {
  height: 100%;
  max-height: none;
}
</style>
