<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useDocumentVisibility, useNow } from '@vueuse/core'
import { useGameStore } from '../stores/gameStore'
import { TICK_INTERVAL_MS } from '../engine/catchUp'
import type { LogEvent } from '../engine/types'
import { usePinnedTopLog } from '../composables/usePinnedTopLog'
import RaiderStatusHeaderStats from './RaiderStatusHeaderStats.vue'

const props = withDefaults(defineProps<{
  isActive?: boolean
}>(), {
  isActive: true,
})

const store = useGameStore()
const entries = computed(() => [...store.log].reverse())
const logEntryCount = computed(() => store.log.length)
const raidShield = computed(() => store.raid.shield)
const raidShieldRecharge = computed(() => store.raid.activeShieldRecharge)
const showMobileRaiderStatus = computed(() => Boolean(store.phase))
const now = useNow({ interval: 1000 })
const phaseTimerMs = computed(() => {
  if (store.raid.phaseTicksRemaining <= 0) return 0
  const phaseRemainingMs = store.raid.phaseTicksRemaining * TICK_INTERVAL_MS
  const elapsedSinceLastTick = Math.max(0, now.value.getTime() - store.lastTickAt)
  return Math.max(0, phaseRemainingMs - elapsedSinceLastTick)
})
const phaseTimerText = computed(() => formatDuration(phaseTimerMs.value))
const downedTimerMs = computed(() => {
  if (!store.raid.downed) return 0
  const downedRemainingMs = store.raid.downed.ticksRemaining * TICK_INTERVAL_MS
  const elapsedSinceLastTick = Math.max(0, now.value.getTime() - store.lastTickAt)
  return Math.max(0, downedRemainingMs - elapsedSinceLastTick)
})
const downedTimerText = computed(() => formatDuration(downedTimerMs.value))
const showPhaseTimer = computed(() => showMobileRaiderStatus.value && phaseTimerMs.value > 0)

// Re-key the tick bar on every new tick AND whenever the tab becomes visible,
// so the animation restarts from the correct elapsed offset instead of 0.
const visibility = useDocumentVisibility()
const tickBarKey = computed(() => `${store.lastTickAt}-${visibility.value}-${props.isActive}`)
const tickAnimationDelay = computed(() => {
  // Include visibility/activity as dependencies so delay recomputes when the tab becomes visible.
  void visibility.value
  void props.isActive
  const elapsed = Math.min(TICK_INTERVAL_MS, Math.max(0, Date.now() - store.lastTickAt))
  return `-${elapsed}ms`
})

const pinnedTopLog = usePinnedTopLog(logEntryCount)
const unseenEntryKeys = ref<Set<string>>(new Set())
const logEntryKeys = computed(() => store.log.map(logEntryKey))
const entryElements = new Map<string, HTMLElement>()
const seenDissipationTimers = new Map<string, number>()
let entrySeenObserver: IntersectionObserver | null = null

watch(logEntryKeys, (keys, previousKeys = []) => {
  const previousKeySet = new Set(previousKeys)
  const currentKeySet = new Set(keys)
  const nextUnseenKeys = new Set([...unseenEntryKeys.value].filter(key => currentKeySet.has(key)))
  for (const key of keys) {
    if (!previousKeySet.has(key)) nextUnseenKeys.add(key)
  }
  unseenEntryKeys.value = nextUnseenKeys

  void nextTick(() => observeUnseenEntries())
})

onBeforeUnmount(() => {
  entrySeenObserver?.disconnect()
  for (const timerId of seenDissipationTimers.values()) window.clearTimeout(timerId)
})

function logEntryKey(entry: LogEvent): string {
  return `${entry.tick}-${entry.id}`
}

function isEntryUnseen(entry: LogEvent): boolean {
  return unseenEntryKeys.value.has(logEntryKey(entry))
}

function bindEntryElement(entry: LogEvent, element: Element | ComponentPublicInstance | null) {
  const key = logEntryKey(entry)
  const existingElement = entryElements.get(key)
  if (existingElement) entrySeenObserver?.unobserve(existingElement)

  if (element instanceof HTMLElement) {
    entryElements.set(key, element)
    if (unseenEntryKeys.value.has(key)) getEntrySeenObserver().observe(element)
    return
  }

  entryElements.delete(key)
}

function markEntrySeen(entry: LogEvent) {
  const key = logEntryKey(entry)
  markEntryKeySeen(key)
}

function markEntryKeySeen(key: string) {
  if (!unseenEntryKeys.value.has(key)) return

  const timerId = seenDissipationTimers.get(key)
  if (timerId !== undefined) {
    window.clearTimeout(timerId)
    seenDissipationTimers.delete(key)
  }

  const nextUnseenKeys = new Set(unseenEntryKeys.value)
  nextUnseenKeys.delete(key)
  unseenEntryKeys.value = nextUnseenKeys

  const element = entryElements.get(key)
  if (element) entrySeenObserver?.unobserve(element)
}

function observeUnseenEntries() {
  for (const key of unseenEntryKeys.value) {
    const element = entryElements.get(key)
    if (element) getEntrySeenObserver().observe(element)
  }
}

function getEntrySeenObserver(): IntersectionObserver {
  if (entrySeenObserver) return entrySeenObserver

  entrySeenObserver = new IntersectionObserver(entries => {
    for (const observerEntry of entries) {
      const key = (observerEntry.target as HTMLElement).dataset.logEntryKey
      if (!key) continue

      if (observerEntry.isIntersecting) {
        scheduleEntrySeen(key)
      } else {
        cancelScheduledEntrySeen(key)
      }
    }
  }, { threshold: 0.7 })

  return entrySeenObserver
}

function scheduleEntrySeen(key: string) {
  if (!unseenEntryKeys.value.has(key) || seenDissipationTimers.has(key)) return

  const timerId = window.setTimeout(() => markEntryKeySeen(key), 900)
  seenDissipationTimers.set(key, timerId)
}

function cancelScheduledEntrySeen(key: string) {
  const timerId = seenDissipationTimers.get(key)
  if (timerId === undefined) return

  window.clearTimeout(timerId)
  seenDissipationTimers.delete(key)
}

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
    KNOCKED_OUT: '💀',
  }
  return badges[phase] ?? '📡'
}

function logBadge(entry: LogEvent): string {
  const badges = entry.conditions?.map(condition => condition === 'EXTRACTING' ? '🚨' : '🛏️')
  if (badges && badges.length > 0) return badges.join('')
  return phaseBadge(entry.phase)
}

</script>

<template>
  <section class="comms-log flex flex-col h-full bg-surface rounded-lg overflow-hidden border border-border" aria-label="Comms Log">
    <header class="flex items-center gap-2 px-3.5 py-2.5 bg-surface-raised border-b border-border font-mono text-[0.75rem] tracking-widest text-accent">
      <span>📻</span>
      <span>COMMS FEED</span>
    </header>
    <!-- Mobile-only raider status: hidden on desktop, shown during all phases on small screens -->
    <div
      v-if="showMobileRaiderStatus"
      class="mt-2 px-3.5 py-2 border-b border-border bg-surface-raised hidden max-[600px]:block"
    >
      <RaiderStatusHeaderStats
        :raider="store.raider"
        :phase="store.phase"
        :is-extracting="store.raid.extracting !== null"
        :is-downed="store.raid.downed !== null"
        :downed-timer-text="downedTimerText"
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
        :key="logEntryKey(entry)"
        :ref="element => bindEntryElement(entry, element)"
        :data-log-entry-key="logEntryKey(entry)"
        class="comms-log__entry flex gap-2 px-3.5 py-comms-entry-y text-sm leading-normal border-b border-border-subtle last:border-b-0"
        :class="{ 'comms-log__entry--unseen': isEntryUnseen(entry) }"
        :tabindex="isEntryUnseen(entry) ? 0 : undefined"
        @focusin="markEntrySeen(entry)"
      >
        <span class="shrink-0 text-muted font-mono text-[0.75rem] pt-0.5 min-w-comms-timestamp">
          {{ logBadge(entry) }} {{ formatTime(entry.timestamp) }}
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
.comms-log__entry {
  transition: background-color 0.18s ease, box-shadow 0.18s ease;
}

.comms-log__entry--unseen {
  background: color-mix(in srgb, var(--color-accent) 22%, transparent);
  box-shadow: inset 3px 0 0 var(--color-accent);
}

.comms-log__entry--unseen:focus-visible {
  outline: 1px solid var(--color-accent);
  outline-offset: -2px;
}

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
