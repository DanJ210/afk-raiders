/**
 * useGamePersistence — localStorage save/load and migration logic.
 *
 * Responsibilities:
 * - Load saved game from localStorage with version checking
 * - Persist state, seed, and lastTickAt after each tick
 * - Handle legacy save migrations (e.g., missing shield state, coins)
 * - Silent fallback if localStorage is unavailable
 */

import type { GameState, RaiderLifetimeStats } from '../engine/types.js'
import { SAVE_VERSION } from '../engine/initialState.js'
import { createInitialLifetimeStats } from '../engine/stats.js'
import { sellStashOverflow } from '../engine/homeStash.js'
import { createStarterShieldState } from '../engine/shields.js'

const STORAGE_KEY = 'afk-raiders-save'

export interface SaveData {
  state: GameState
  seed: number
  lastTickAt: number
  version: number
}

function clampMood(mood: unknown): number {
  const value = typeof mood === 'number' && Number.isFinite(mood) ? mood : 0
  return Math.max(-5, Math.min(5, value))
}

function seedLegacyLifetimeStats(state: GameState): RaiderLifetimeStats {
  const seeded = createInitialLifetimeStats()
  return {
    ...seeded,
    extracts: {
      ...seeded.extracts,
      total: Math.max(0, state.raider.extractCount ?? 0),
    },
    deaths: {
      ...seeded.deaths,
      total: Math.max(0, state.raider.deathCount ?? 0),
    },
  }
}

export interface GamePersistenceReturn {
  loadSave: () => SaveData | null
  persistSave: (state: GameState, seed: number, lastTickAt: number) => void
  clearSave: () => void
}

/**
 * Manage save/load and migration logic for the game.
 * Separates persistence concerns from state management and tick scheduling.
 */
export function useGamePersistence(): GamePersistenceReturn {
  function loadSave(): SaveData | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      const data = JSON.parse(raw) as SaveData
      if (data.version !== SAVE_VERSION) return null
      // Migration: older saves lack coins, and stashes saved while the limit
      // was not enforced may exceed it — sell the overflow rather than delete it.
      const { pendingReadyUp: _pendingReadyUp, ...loadedState } = data.state as GameState & { pendingReadyUp?: boolean }
      const sale = sellStashOverflow(loadedState.homeStash)
      data.state = {
        ...loadedState,
        raider: {
          ...loadedState.raider,
          mood: clampMood(loadedState.raider.mood),
        },
        signalAmplifiers: loadedState.signalAmplifiers ?? 0,
        pendingCalm: (loadedState as any).pendingCalm ?? (loadedState as any).pendingEncourage ?? false,
        pendingPressure: (loadedState as any).pendingPressure ?? (loadedState as any).pendingScold ?? false,
        homeStash: sale.homeStash,
        coins: (loadedState.coins ?? 0) + sale.coinsGained,
        stats: loadedState.stats ?? seedLegacyLifetimeStats(loadedState),
        raid: {
          ...loadedState.raid,
          shield: loadedState.raid.shield ?? createStarterShieldState(),
          activeShieldRecharge: loadedState.raid.activeShieldRecharge ?? null,
          hiddenPocket: loadedState.raid.hiddenPocket ?? null,
          healingItems: loadedState.raid.healingItems ?? [],
          dangerLevel: loadedState.raid.dangerLevel ?? null,
          zoneCondition: loadedState.raid.zoneCondition ?? null,
        },
      }
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

  function clearSave() {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // silently ignore
    }
  }

  return {
    loadSave,
    persistSave,
    clearSave,
  }
}
