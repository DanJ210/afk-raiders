/** Factory for a fresh GameState — used on first load or after resetSave() */

import type { GameState } from './types.js'
import { initialSignalState } from './signal.js'
import { PHASE_DURATIONS } from './raidStateMachine.js'
import { createInitialLifetimeStats } from './stats.js'
import { createStarterShieldState } from './shields.js'

export const SAVE_VERSION = 2

export function createInitialState(now: number = Date.now()): GameState {
  return {
    version: SAVE_VERSION,
    tick: 0,
    raider: {
      name: 'Raider Danakin',
      hp: 100,
      maxHp: 100,
      mood: 0,
      ratRating: 0,
      deploysCount: 0,
      deathCount: 0,
      extractCount: 0,
    },
    raid: {
      zone: null,
      dangerLevel: null,
      shield: createStarterShieldState(),
      activeShieldRecharge: null,
      backpack: [],
      hiddenPocket: null,
      healingItems: [],
      backpackValue: 0,
      greedLevel: 0,
      phase: 'HUB',
      phaseTicksRemaining: PHASE_DURATIONS['HUB'],
      forceExtract: false,
    },
    signal: initialSignalState(now),
    log: [],
    homeStash: [],
    coins: 0,
    stats: createInitialLifetimeStats(),
    pendingEncourage: false,
    pendingScold: false,
  }
}
