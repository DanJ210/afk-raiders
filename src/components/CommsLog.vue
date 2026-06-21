<script setup lang="ts">
import { computed } from 'vue'
import { useDocumentVisibility, useNow } from '@vueuse/core'
import { useGameStore } from '../stores/gameStore'
import { TICK_INTERVAL_MS } from '../engine/catchUp'
import { usePinnedTopLog } from '../composables/usePinnedTopLog'
import RaiderStatusHeaderStats from './RaiderStatusHeaderStats.vue'

const store = useGameStore()
const entries = computed(() => [...store.log].reverse())
const logEntryCount = computed(() => store.log.length)
const raidShield = computed(() => store.raid.shield)
const raidShieldRecharge = computed(() => store.raid.activeShieldRecharge)
const showMobileRaiderStatus = computed(() => store.phase === 'RAIDING' || store.phase === 'EXTRACTING')
const now = useNow({ interval: 1000 })
const phaseTimerMs = computed(() => {
  if (store.raid.phaseTicksRemaining <= 0) return 0
  const phaseRemainingMs = store.raid.phaseTicksRemaining * TICK_INTERVAL_MS
  const elapsedSinceLastTick = Math.max(0, now.value.getTime() - store.lastTickAt)
  return Math.max(0, phaseRemainingMs - elapsedSinceLastTick)
})
const phaseTimerText = computed(() => formatDuration(phaseTimerMs.value))
const showPhaseTimer = computed(() => showMobileRaiderStatus.value && phaseTimerMs.value > 0)

// Re-key the tick bar on every new tick AND whenever the tab becomes visible,
// so the animation restarts from the correct elapsed offset instead of 0.
const visibility = useDocumentVisibility()
const tickBarKey = computed(() => `${store.lastTickAt}-${visibility.value}`)
const tickAnimationDelay = computed(() => {
  // Include visibility as a dependency so delay recomputes when the tab becomes visible.
  void visibility.value
  const elapsed = Math.min(TICK_INTERVAL_MS, Math.max(0, Date.now() - store.lastTickAt))
  return `-${elapsed}ms`
})

const pinnedTopLog = usePinnedTopLog(logEntryCount)

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function phaseBadge(phase: string): string {
  const badges: Record<string, string> = {
    HUB: '🏠',
    DEPLOYING: '🚁',
    RAIDING: '⚡',
    EXTRACTING: '🚨',
    DOWNED: '💀',
  }
  return badges[phase] ?? '📡'
}

</script>

<template>
  <section class="comms-log flex flex-col h-full bg-surface rounded-lg overflow-hidden border border-border" aria-label="Comms Log">
    <header class="flex items-center gap-2 px-3.5 py-2.5 bg-surface-raised border-b border-border font-mono text-[0.75rem] tracking-widest text-accent">
      <span>📻</span>
      <span>COMMS FEED</span>
    </header>
    <!-- Mobile-only raider status: hidden on desktop, shown during active field phases on small screens -->
    <div
      v-if="showMobileRaiderStatus"
      class="mt-2 px-3.5 py-2 border-b border-border bg-surface-raised hidden max-[600px]:block"
    >
      <RaiderStatusHeaderStats
        :raider="store.raider"
        :phase="store.phase"
        :show-phase-timer="showPhaseTimer"
        :phase-timer-text="phaseTimerText"
        :raid-shield="raidShield"
        :active-shield-recharge="raidShieldRecharge"
        :name-max-length="0"
        :allow-rename="false"
      />
    </div>
    <div class="h-comms-tick-bar bg-surface-raised border-b border-border overflow-hidden" aria-hidden="true">
      <div
        :key="tickBarKey"
        class="comms-log__tick-bar"
        :style="{ animationDuration: `${TICK_INTERVAL_MS}ms`, animationDelay: tickAnimationDelay }"
      ></div>
    </div>
    <div
      :ref="pinnedTopLog.logEl"
      class="flex-1 overflow-y-auto py-2 scroll-smooth"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      @scroll="pinnedTopLog.onScroll"
    >
      <p v-if="store.log.length === 0" class="px-4 py-4 text-muted italic text-raider-value">
        Waiting for transmission…
      </p>
      <div
        v-for="entry in entries"
        :key="`${entry.tick}-${entry.id}`"
        class="flex gap-2 px-3.5 py-comms-entry-y text-sm leading-normal border-b border-border-subtle last:border-b-0"
      >
        <span class="shrink-0 text-muted font-mono text-[0.75rem] pt-0.5 min-w-comms-timestamp">
          {{ phaseBadge(entry.phase) }} {{ formatTime(entry.timestamp) }}
        </span>
        <span class="text-text font-mono">{{ entry.text }}</span>
      </div>
    </div>
    <div v-if="pinnedTopLog.userScrolledDown.value" class="px-3.5 py-1.5 bg-accent text-bg text-[0.75rem] text-center cursor-pointer font-mono" @click="pinnedTopLog.jumpToTop()">
      ▲ New messages at top
    </div>
  </section>
</template>

<style scoped>
.comms-log__tick-bar {
  height: 100%;
  width: 0%;
  background: var(--color-accent);
  opacity: 0.7;
  animation: tick-fill linear forwards;
}

@media (prefers-reduced-motion: reduce) {
  .comms-log__tick-bar {
    animation: none;
    width: 100%;
  }
}

@keyframes tick-fill {
  from { width: 0%; }
  to   { width: 100%; }
}
</style>
