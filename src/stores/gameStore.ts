/**
 * gameStore — Pinia orchestrator for the game.
 *
 * Responsibilities:
 * - Coordinate persistence, ticker, and handler actions composables
 * - Expose the unified public API to Vue components
 * - Manage the top-level state refs and RNG
 *
 * Composition:
 * - useGamePersistence() — save/load and migration
 * - useGameTicker() — tick loop, pause/resume, catch-up
 * - useHandlerActions() — signal-gated actions
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createRNG } from '../engine/rng.js'
import { createInitialState } from '../engine/initialState.js'
import { computeSignal } from '../engine/signal.js'
import { catchUp, MAX_CATCHUP_TICKS, TICK_INTERVAL_MS } from '../engine/catchUp.js'
import type { GameState, LogEvent } from '../engine/types.js'
import type { AwaySummary } from '../engine/catchUp.js'
import { useGamePersistence } from '../composables/useGamePersistence.js'
import { useGameTicker } from '../composables/useGameTicker.js'
import { useHandlerActions } from '../composables/useHandlerActions.js'

export const useGameStore = defineStore('game', () => {
  // Initialize persistence and RNG
  const persistence = useGamePersistence()
  const now = Date.now()
  const saved = persistence.loadSave()

  // Seed is stable per save — derive from timestamp on first run
  const seedValue = ref<number>(saved?.seed ?? (now & 0xffffffff))
  const rngRef = { current: createRNG(seedValue.value) }

  // If we have a save, restore; otherwise start fresh
  let initialState = createInitialState(now)
  let initialLastTickAt = saved?.lastTickAt ?? now
  let initialAwaySummary: AwaySummary | null = null
  if (saved) {
    const elapsed = Math.max(0, now - saved.lastTickAt)
    const rawTicks = Math.floor(elapsed / TICK_INTERVAL_MS)
    const startupCatchUp = catchUp(saved.state, rngRef.current, saved.lastTickAt, now)
    initialState = startupCatchUp.state
    const wasCapped = rawTicks > MAX_CATCHUP_TICKS
    initialLastTickAt = wasCapped
      ? now
      : saved.lastTickAt + (startupCatchUp.summary.ticksReplayed * TICK_INTERVAL_MS)
    if (startupCatchUp.summary.ticksReplayed > 0) {
      initialAwaySummary = startupCatchUp.summary
      persistence.persistSave(initialState, seedValue.value, initialLastTickAt)
    }
  }

  const state = ref<GameState>(initialState)
  const lastTickAt = ref<number>(initialLastTickAt)
  const newEvents = ref<LogEvent[]>([])

  // Derived values for the UI
  const phase = computed(() => state.value.raid.phase)
  const raider = computed(() => state.value.raider)
  const raid = computed(() => state.value.raid)
  const signal = computed(() => computeSignal(state.value.signal, Date.now()))
  const hasPendingHandlerAction = computed(
    () => state.value.pendingCalm || state.value.pendingPressure || state.value.raid.forceExtract,
  )
  const log = computed(() => state.value.log)

  // Initialize ticker (pause/resume, visibility, catch-up)
  const ticker = useGameTicker(
    state,
    lastTickAt,
    rngRef,
    (updatedState, seed, tickTime) => {
      newEvents.value = updatedState.log.slice(-1) // latest event(s) for UI reactivity
      persistence.persistSave(updatedState, seed, tickTime)
    },
  )

  // Initialize handler actions (all signal-gated player actions)
  const actions = useHandlerActions(
    state,
    rngRef,
    lastTickAt,
    () => hasPendingHandlerAction.value,
    (updatedState, seed, tickTime) => {
      persistence.persistSave(updatedState, seed, tickTime)
    },
    (freshState, newSeed, tickTime) => {
      // resetSave callback
      seedValue.value = newSeed
      rngRef.current = createRNG(newSeed)
      state.value = freshState
      lastTickAt.value = tickTime
      ticker.awaySummary.value = null
      persistence.persistSave(freshState, newSeed, tickTime)
    },
    () => {
      // dismissAwaySummary callback
      ticker.awaySummary.value = null
    },
  )

  if (initialAwaySummary) {
    ticker.awaySummary.value = initialAwaySummary
  }

  return {
    state,
    phase,
    raider,
    raid,
    signal,
    hasPendingHandlerAction,
    log,
    newEvents,
    lastTickAt,
    awaySummary: ticker.awaySummary,
    calm: actions.calm,
    pressure: actions.pressure,
    applySignalAmplifier: actions.applySignalAmplifier,
    readyUp: actions.readyUp,
    callExtract: actions.callExtract,
    applyHealingItem: actions.applyHealingItem,
    applyShieldRecharger: actions.applyShieldRecharger,
    setHiddenPocketItem: actions.setHiddenPocketItem,
    clearHiddenPocketItem: actions.clearHiddenPocketItem,
    sellHomeStashItem: actions.sellHomeStashItem,
    resetSave: actions.resetSave,
    dismissAwaySummary: actions.dismissAwaySummary,
    renameRaider: actions.renameRaider,
    RAIDER_NAME_MAX_LENGTH: actions.RAIDER_NAME_MAX_LENGTH,
  }
})

