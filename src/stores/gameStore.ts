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
import {
  PERSONALITY_TRAIT_COUNT,
  generateIdentityForSeed,
  generateRaiderIdentity,
  personalityTraits,
  sanitizePersonalityTraits,
  type RaiderIdentity,
} from '../engine/identity.js'
import { computeSignal } from '../engine/signal.js'
import { catchUp, MAX_CATCHUP_TICKS, TICK_INTERVAL_MS } from '../engine/catchUp.js'
import type { GameState, LogEvent } from '../engine/types.js'
import type { AwaySummary } from '../engine/catchUp.js'
import { useGamePersistence } from '../composables/useGamePersistence.js'
import { useGameTicker } from '../composables/useGameTicker.js'
import { useHandlerActions } from '../composables/useHandlerActions.js'
import { usePreparationActions } from '../composables/usePreparationActions.js'

export const useGameStore = defineStore('game', () => {
  // Initialize persistence and RNG
  const persistence = useGamePersistence()
  const now = Date.now()
  const saved = persistence.loadSave()

  // Seed is stable per save — derive from timestamp on first run
  const seedValue = ref<number>(saved?.seed ?? (now & 0xffffffff))
  const identitySuggestionCounter = ref(0)
  const rngRef = { current: createRNG(seedValue.value) }

  // First-time users create their raider before the story starts. The flag
  // persists so closing the tab mid-creation re-opens the flow next visit.
  const needsRaiderCreation = ref(!saved || persistence.loadCreationPending())
  if (!saved) {
    persistence.setCreationPending(true)
  }

  // If we have a save, restore; otherwise start fresh with a seeded identity
  let initialState = createInitialState(now, generateIdentityForSeed(seedValue.value))
  let initialLastTickAt = saved?.lastTickAt ?? now
  let initialAwaySummary: AwaySummary | null = null
  if (saved) {
    initialState = saved.state
    if (!needsRaiderCreation.value) {
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
  const activityLog = computed(() => state.value.activityLog)
  const ownedWeapons = computed(() => state.value.ownedWeapons)
  const purchasedHealingItems = computed(() => state.value.purchasedHealingItems)
  const purchasedShieldRechargers = computed(() => state.value.purchasedShieldRechargers)
  const selectedHealingLoadout = computed(() => state.value.raid.selectedHealingLoadout)
  const selectedShieldRechargerLoadout = computed(() => state.value.raid.selectedShieldRechargerLoadout)

  // Initialize ticker (pause/resume, visibility, catch-up)
  const ticker = useGameTicker(
    state,
    lastTickAt,
    rngRef,
    (updatedState, seed, tickTime) => {
      persistence.persistSave(updatedState, seed, tickTime)
    },
    (events) => {
      newEvents.value = events
    },
  )
  if (needsRaiderCreation.value) {
    ticker.pause()
  }

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
      ticker.pause()
      persistence.persistSave(freshState, newSeed, tickTime)
      // A reset raider is a new raider — let the player name them too.
      persistence.setCreationPending(true)
      needsRaiderCreation.value = true
    },
    () => {
      // dismissAwaySummary callback
      ticker.awaySummary.value = null
    },
    (events) => {
      newEvents.value = events
    },
  )

  const preparationActions = usePreparationActions(
    state,
    lastTickAt,
    (updatedState, seed, tickTime) => {
      persistence.persistSave(updatedState, seed, tickTime)
    },
    (events) => {
      newEvents.value = events
    },
    () => seedValue.value,
  )

  if (initialAwaySummary) {
    ticker.awaySummary.value = initialAwaySummary
  }

  /** Fresh random identity suggestion for the creation screen (UI-only roll). */
  function suggestIdentity(): RaiderIdentity {
    identitySuggestionCounter.value += 1
    const suggestionSeed = (seedValue.value ^ 0x51f15eed ^ Math.imul(identitySuggestionCounter.value, 0x9e3779b1)) >>> 0
    return generateRaiderIdentity(createRNG(suggestionSeed))
  }

  /**
   * Finish first-run raider creation: start a brand-new deterministic run
   * with the chosen identity. Any placeholder ticks that landed while the
   * creation screen was open are discarded with the old state.
   */
  function confirmRaiderCreation(name: string, traits: string[]) {
    const freshNow = Date.now()
    const newSeed = freshNow & 0xffffffff
    const fallback = generateIdentityForSeed(newSeed)
    const trimmedName = name.trim().slice(0, actions.RAIDER_NAME_MAX_LENGTH)
    const sanitizedTraits = sanitizePersonalityTraits(traits)
    const identity: RaiderIdentity = {
      name: trimmedName || fallback.name,
      traits: sanitizedTraits.length === PERSONALITY_TRAIT_COUNT ? sanitizedTraits : fallback.traits,
    }

    const freshState = createInitialState(freshNow, identity)
    seedValue.value = newSeed
    rngRef.current = createRNG(newSeed)
    state.value = freshState
    lastTickAt.value = freshNow
    ticker.awaySummary.value = null
    persistence.persistSave(freshState, newSeed, freshNow)
    persistence.setCreationPending(false)
    needsRaiderCreation.value = false
    ticker.resume()
  }

  return {
    state,
    phase,
    raider,
    raid,
    signal,
    hasPendingHandlerAction,
    log,
    activityLog,
    ownedWeapons,
    purchasedHealingItems,
    purchasedShieldRechargers,
    selectedHealingLoadout,
    selectedShieldRechargerLoadout,
    newEvents,
    lastTickAt,
    awaySummary: ticker.awaySummary,
    calm: actions.calm,
    pressure: actions.pressure,
    applySignalAmplifier: actions.applySignalAmplifier,
    readyUp: actions.readyUp,
    callExtract: actions.callExtract,
    revive: actions.revive,
    applyHealingItem: actions.applyHealingItem,
    applyShieldRecharger: actions.applyShieldRecharger,
    setHiddenPocketItem: actions.setHiddenPocketItem,
    clearHiddenPocketItem: actions.clearHiddenPocketItem,
    sellHomeStashItem: actions.sellHomeStashItem,
    resetSave: actions.resetSave,
    dismissAwaySummary: actions.dismissAwaySummary,
    renameRaider: actions.renameRaider,
    RAIDER_NAME_MAX_LENGTH: actions.RAIDER_NAME_MAX_LENGTH,
    needsRaiderCreation,
    personalityTraits,
    PERSONALITY_TRAIT_COUNT,
    suggestIdentity,
    confirmRaiderCreation,
    purchaseWeapon: preparationActions.purchaseWeapon,
    repairWeapon: preparationActions.repairWeapon,
    equipWeapon: preparationActions.equipWeapon,
    purchaseHealingItem: preparationActions.purchaseHealingItem,
    purchaseShieldRecharger: preparationActions.purchaseShieldRecharger,
    setSelectedHealingLoadout: preparationActions.setSelectedHealingLoadout,
    setSelectedShieldRechargerLoadout: preparationActions.setSelectedShieldRechargerLoadout,
    clearSelectedHealingLoadout: preparationActions.clearSelectedHealingLoadout,
    clearSelectedShieldRechargerLoadout: preparationActions.clearSelectedShieldRechargerLoadout,
  }
})
