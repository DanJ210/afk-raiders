<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useDocumentVisibility, useNow } from '@vueuse/core'
import { useGameStore } from '../stores/gameStore'
import { TICK_INTERVAL_MS } from '../engine/catchUp'
import type { ActivityLogEvent, LogEvent } from '../engine/types'
import { usePinnedTopLog } from '../composables/usePinnedTopLog'
import RaiderStatusHeaderStats from './RaiderStatusHeaderStats.vue'

const props = withDefaults(defineProps<{
  isActive?: boolean
}>(), {
  isActive: true,
})

const store = useGameStore()
const entries = computed(() => [...store.log].reverse())
const activityEntries = computed(() => [...store.activityLog].reverse())
const currentActivityName = computed(() => store.raid.activeRaidActivity?.name ?? activityEntries.value[0]?.activityName ?? null)
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

function activityBadge(entry: ActivityLogEvent): string {
  const badges: Record<ActivityLogEvent['activity'], string> = {
    SEARCH: '🔎',
    ROBOT_ENCOUNTER: '🤖',
    EXTRACTION: '🚨',
    DOWNED: '🛏️',
    SHIELD_RECHARGE: '🛡️',
  }
  return badges[entry.activity]
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
    <section class="comms-log__activity" aria-label="Activity Log">
      <header class="comms-log__activity-header">
        <span>ACTIVE ACTIVITY</span>
        <span v-if="currentActivityName" class="comms-log__activity-current">{{ currentActivityName }}</span>
      </header>
      <div class="comms-log__activity-list" role="log" aria-live="polite" aria-relevant="additions">
        <p v-if="activityEntries.length === 0" class="comms-log__activity-empty">
          No active thread.
        </p>
        <div
          v-for="entry in activityEntries"
          :key="`${entry.tick}-${entry.id}-${entry.timestamp}`"
          class="comms-log__activity-entry"
        >
          <span class="comms-log__activity-time">{{ activityBadge(entry) }} {{ formatTime(entry.timestamp) }}</span>
          <span class="comms-log__activity-text">
            <span v-if="entry.activityName" class="comms-log__activity-name">{{ entry.activityName }}</span>
            {{ entry.text }}
          </span>
        </div>
      </div>
    </section>
    <section class="comms-log__handler" aria-label="Handler Comms">
      <header class="comms-log__handler-header">
        <span>HANDLER COMMS</span>
      </header>
      <div
        :ref="pinnedTopLog.logEl"
        class="comms-log__handler-list flex-1 overflow-y-auto py-2 scroll-smooth"
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
  </section>
</template>

<style scoped>
.comms-log__activity {
  margin: 0.55rem 0.75rem 0;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 0.45rem;
  background: color-mix(in srgb, var(--color-surface-raised) 80%, var(--color-bg));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-accent-secondary) 10%, transparent);
  min-height: 10.5rem;
}

.comms-log__activity-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.875rem 0.2rem;
  color: var(--color-accent-secondary);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.comms-log__activity-current {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text);
  font-size: 0.72rem;
  letter-spacing: 0;
  text-transform: none;
}

.comms-log__activity-list {
  max-height: 7.5rem;
  overflow-y: auto;
  padding: 0.15rem 0 0.45rem;
}

.comms-log__handler {
  min-height: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  margin-top: 0.65rem;
  border-top: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface) 88%, var(--color-bg));
}

.comms-log__handler-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem 0.35rem;
  border-bottom: 1px solid var(--color-border-subtle);
  color: var(--color-accent);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.comms-log__handler-list {
  min-height: 0;
}

.comms-log__activity-empty,
.comms-log__activity-entry {
  margin: 0;
  padding: 0.25rem 0.875rem;
  font-family: var(--font-mono);
  font-size: 0.78rem;
}

.comms-log__activity-empty {
  color: var(--color-muted);
  font-style: italic;
}

.comms-log__activity-entry {
  display: flex;
  gap: 0.5rem;
  border-top: 1px solid var(--color-border-subtle);
}

.comms-log__activity-time {
  flex: 0 0 var(--spacing-comms-timestamp);
  color: var(--color-muted);
}

.comms-log__activity-text {
  min-width: 0;
  color: var(--color-text);
}

.comms-log__activity-name {
  color: var(--color-accent-secondary);
  font-weight: 700;
}

.comms-log__activity-name::after {
  content: ': ';
  color: var(--color-text);
  font-weight: 400;
}

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
