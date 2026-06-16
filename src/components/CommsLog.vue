<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted } from 'vue'
import { useGameStore } from '../stores/gameStore'
import { TICK_INTERVAL_MS } from '../engine/catchUp'
import ShieldBar from './ShieldBar.vue'
import HealthBar from './HealthBar.vue'

const store = useGameStore()
const logEl = ref<HTMLElement | null>(null)
const userScrolledDown = ref(false)
const entries = computed(() => [...store.log].reverse())
const raidShield = computed(() => store.raid.shield)

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

function onScroll() {
  if (!logEl.value) return
  const { scrollTop } = logEl.value
  // Consider "scrolled away" if more than 60px from the top
  userScrolledDown.value = scrollTop > 60
}

async function scrollToTop() {
  if (userScrolledDown.value) return
  await nextTick()
  if (logEl.value) {
    logEl.value.scrollTop = 0
  }
}

// Auto-scroll when new events arrive
watch(() => store.log.length, scrollToTop)

onMounted(scrollToTop)
</script>

<template>
  <section class="comms-log" aria-label="Comms Log">
    <header class="comms-log__header">
      <span class="comms-log__icon">📻</span>
      <span class="comms-log__title">COMMS FEED</span>
    </header>
    <div class="comms-log__mobile-health">
      <ShieldBar :shield="raidShield" label="SHIELD" compact />
      <HealthBar :current="store.raider.hp" :max="store.raider.maxHp" label="RAIDER HP" />
    </div>
    <div class="comms-log__tick-track" aria-hidden="true">
      <div
        :key="store.lastTickAt"
        class="comms-log__tick-bar"
        :style="{ animationDuration: `${TICK_INTERVAL_MS}ms` }"
      ></div>
    </div>
    <div
      ref="logEl"
      class="comms-log__feed"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      @scroll="onScroll"
    >
      <p v-if="store.log.length === 0" class="comms-log__empty">
        Waiting for transmission…
      </p>
      <div
        v-for="entry in entries"
        :key="`${entry.tick}-${entry.id}`"
        class="comms-log__entry"
      >
        <span class="comms-log__meta">
          {{ phaseBadge(entry.phase) }} {{ formatTime(entry.timestamp) }}
        </span>
        <span class="comms-log__text">{{ entry.text }}</span>
      </div>
    </div>
    <div v-if="userScrolledDown" class="comms-log__scroll-hint" @click="userScrolledDown = false; scrollToTop()">
      ▲ New messages at top
    </div>
  </section>
</template>

<style scoped>
.comms-log {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-surface);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.comms-log__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--color-surface-raised);
  border-bottom: 1px solid var(--color-border);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  color: var(--color-accent);
}

.comms-log__mobile-health {
  display: none;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  padding: 8px 14px;
  background: var(--color-surface-raised);
  border-bottom: 1px solid var(--color-border);
  font-family: var(--font-mono);
}

.comms-log__tick-track {
  height: 3px;
  background: var(--color-surface-raised);
  border-bottom: 1px solid var(--color-border);
  overflow: hidden;
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
  from {
    width: 0%;
  }
  to {
    width: 100%;
  }
}

.comms-log__feed {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  scroll-behavior: smooth;
}

.comms-log__empty {
  padding: 16px;
  color: var(--color-muted);
  font-style: italic;
  font-size: 0.85rem;
}

.comms-log__entry {
  display: flex;
  gap: 8px;
  padding: 5px 14px;
  font-size: 0.875rem;
  line-height: 1.5;
  border-bottom: 1px solid var(--color-border-subtle);
}

.comms-log__entry:last-child {
  border-bottom: none;
}

.comms-log__meta {
  flex-shrink: 0;
  color: var(--color-muted);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  padding-top: 2px;
  min-width: 60px;
}

.comms-log__text {
  color: var(--color-text);
  font-family: var(--font-mono);
}

.comms-log__scroll-hint {
  padding: 6px 14px;
  background: var(--color-accent);
  color: var(--color-bg);
  font-size: 0.75rem;
  text-align: center;
  cursor: pointer;
  font-family: var(--font-mono);
}

@media (max-width: 600px) {
  .comms-log__mobile-health {
    display: flex;
  }
}
</style>
