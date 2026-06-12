/**
 * gameStore — bridges the engine and the Vue UI.
 *
 * Responsibilities:
 * - Hold the current GameState and the seeded RNG
 * - Drive the tick loop via VueUse useIntervalFn
 * - Pause when tab is hidden, catch up when it returns
 * - Persist { state, seed, lastTickAt, version } to localStorage after each tick
 * - Expose Handler actions: encourage, scold, callExtract, resetSave
 * - Expose the away summary for AwaySummary.vue to display
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useIntervalFn, useDocumentVisibility } from '@vueuse/core'
import { watch } from 'vue'
import { createRNG } from '../engine/rng.js'
import { processTick } from '../engine/tick.js'
import { catchUp, TICK_INTERVAL_MS } from '../engine/catchUp.js'
import { computeSignal, spendSignal } from '../engine/signal.js'
import { createInitialState, SAVE_VERSION } from '../engine/initialState.js'
import type { GameState, LogEvent } from '../engine/types.js'
import type { AwaySummary } from '../engine/catchUp.js'

const STORAGE_KEY = 'afk-raiders-save'

interface SaveData {
  state: GameState
  seed: number
  lastTickAt: number
  version: number
}

function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as SaveData
    if (data.version !== SAVE_VERSION) return null
    return data
  } catch {
    return null
  }
}

function persistSave(state: GameState, seed: number, lastTickAt: number) {
  try {
    const data: SaveData = { state, seed, lastTickAt, version: SAVE_VERSION }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export const useGameStore = defineStore('game', () => {
  const now = Date.now()
  const saved = loadSave()

  // Seed is stable per save — derive from timestamp on first run
  const seedValue = ref<number>(saved?.seed ?? (now & 0xffffffff))
  const rng = createRNG(seedValue.value)

  // If we have a save, restore and catch up; otherwise start fresh
  let initialState = createInitialState(now)
  let awaySummaryData: AwaySummary | null = null

  if (saved) {
    const catchUpResult = catchUp(saved.state, rng, saved.lastTickAt, now)
    initialState = catchUpResult.state
    if (catchUpResult.summary.ticksReplayed > 0) {
      awaySummaryData = catchUpResult.summary
    }
  }

  const state = ref<GameState>(initialState)
  const lastTickAt = ref<number>(now)
  const awaySummary = ref<AwaySummary | null>(awaySummaryData)

  // Derived values for the UI
  const phase = computed(() => state.value.raid.phase)
  const raider = computed(() => state.value.raider)
  const raid = computed(() => state.value.raid)
  const signal = computed(() => computeSignal(state.value.signal, Date.now()))
  const log = computed(() => state.value.log)
  const newEvents = ref<LogEvent[]>([])

  // ------------------------------------------------------------------
  // Tick loop
  // ------------------------------------------------------------------
  function tick() {
    const tickNow = Date.now()
    const result = processTick(state.value, rng, tickNow)
    state.value = result.state
    lastTickAt.value = tickNow
    newEvents.value = result.events
    persistSave(state.value, rng.getSeed(), tickNow)
  }

  const { pause, resume } = useIntervalFn(tick, TICK_INTERVAL_MS)

  // Pause when tab hidden, catch up on return
  const visibility = useDocumentVisibility()
  let hiddenAt: number | null = null

  watch(visibility, (vis) => {
    if (vis === 'hidden') {
      pause()
      hiddenAt = Date.now()
    } else {
      if (hiddenAt !== null) {
        const result = catchUp(state.value, rng, hiddenAt, Date.now())
        state.value = result.state
        if (result.summary.ticksReplayed > 0) {
          awaySummary.value = result.summary
        }
        lastTickAt.value = Date.now()
        persistSave(state.value, rng.getSeed(), lastTickAt.value)
        hiddenAt = null
      }
      resume()
    }
  })

  // ------------------------------------------------------------------
  // Handler actions
  // ------------------------------------------------------------------
  function encourage() {
    const updated = spendSignal(computeSignal(state.value.signal, Date.now()), 'ENCOURAGE')
    if (!updated) return
    state.value = {
      ...state.value,
      signal: updated,
      pendingEncourage: true,
    }
  }

  function scold() {
    const updated = spendSignal(computeSignal(state.value.signal, Date.now()), 'SCOLD')
    if (!updated) return
    state.value = {
      ...state.value,
      signal: updated,
      pendingScold: true,
    }
  }

  function callExtract() {
    const updated = spendSignal(computeSignal(state.value.signal, Date.now()), 'CALL_EXTRACT')
    if (!updated) return
    state.value = {
      ...state.value,
      signal: updated,
      raid: { ...state.value.raid, forceExtract: true },
    }
  }

  function resetSave() {
    localStorage.removeItem(STORAGE_KEY)
    const freshNow = Date.now()
    seedValue.value = freshNow & 0xffffffff
    state.value = createInitialState(freshNow)
    lastTickAt.value = freshNow
    awaySummary.value = null
  }

  function dismissAwaySummary() {
    awaySummary.value = null
  }

  return {
    state,
    phase,
    raider,
    raid,
    signal,
    log,
    newEvents,
    awaySummary,
    encourage,
    scold,
    callExtract,
    resetSave,
    dismissAwaySummary,
  }
})
