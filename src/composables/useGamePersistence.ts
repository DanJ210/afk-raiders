/**
 * useGamePersistence — localStorage save/load and migration logic.
 *
 * Responsibilities:
 * - Load saved game from localStorage with version checking
 * - Persist state, seed, and lastTickAt after each tick
 * - Handle legacy save migrations (e.g., missing shield state, coins)
 * - Silent fallback if localStorage is unavailable
 */

import type { GameState, OutcomeContextStats, RaiderLifetimeStats } from '../engine/types.js'
import { SAVE_VERSION } from '../engine/initialState.js'
import { EXTRACTING_TICKS, PHASE_DURATIONS } from '../engine/raidStateMachine.js'
import { createInitialLifetimeStats } from '../engine/stats.js'
import { sellStashOverflow } from '../engine/homeStash.js'
import { createStarterShieldState } from '../engine/shields.js'
import { normalizeSkills } from '../engine/skills.js'
import { normalizeRaiderLevelXp } from '../engine/raiderLevel.js'
import { createStarterOwnedWeapon, findWeapon, getDefaultWeapon } from '../engine/weapons.js'

const STORAGE_KEY = 'afk-raiders-save'
const MIN_SUPPORTED_SAVE_VERSION = 3

type LegacyRaiderStats = Omit<GameState['raider'], 'levelXp'> & { levelXp?: unknown }
type LegacyRecord = Record<string, unknown>
type LegacyPhase = GameState['raid']['phase'] | 'EXTRACTING' | 'DOWNED'

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

function isRecord(value: unknown): value is LegacyRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sanitizeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0
}

function sanitizeTicksRemaining(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : fallback
}

function normalizeLegacyPhase(value: unknown): LegacyPhase {
  if (value === 'HUB' || value === 'DEPLOYING' || value === 'RAIDING' || value === 'KNOCKED_OUT' || value === 'EXTRACTING' || value === 'DOWNED') {
    return value
  }
  return 'HUB'
}

function normalizeTimedCondition(value: unknown, fallbackTicks: number): { ticksRemaining: number; totalTicks: number } | null {
  if (!isRecord(value)) return null
  const ticksRemaining = Math.max(1, sanitizeTicksRemaining(value.ticksRemaining, fallbackTicks))
  const totalTicks = Math.max(ticksRemaining, sanitizeTicksRemaining(value.totalTicks, fallbackTicks))
  return {
    ticksRemaining,
    totalTicks,
  }
}

function normalizeRaidState(raid: GameState['raid']): GameState['raid'] {
  const phase = normalizeLegacyPhase(raid.phase)
  const baseRaid: GameState['raid'] = {
    ...raid,
    shield: raid.shield ?? createStarterShieldState(),
    activeShieldRecharge: raid.activeShieldRecharge ?? null,
    activeRaidActivity: raid.activeRaidActivity ?? null,
    hiddenPocket: raid.hiddenPocket ?? null,
    healingItems: raid.healingItems ?? [],
    selectedHealingLoadout: Array.isArray(raid.selectedHealingLoadout) ? raid.selectedHealingLoadout : [],
    equippedWeaponId: typeof raid.equippedWeaponId === 'string' && findWeapon(raid.equippedWeaponId)
      ? raid.equippedWeaponId
      : getDefaultWeapon().id,
    dangerLevel: raid.dangerLevel ?? null,
    zoneCondition: raid.zoneCondition ?? null,
    downed: normalizeTimedCondition(raid.downed, PHASE_DURATIONS.KNOCKED_OUT),
    extracting: normalizeTimedCondition(raid.extracting, EXTRACTING_TICKS),
  }

  if (phase === 'EXTRACTING') {
    return {
      ...baseRaid,
      phase: 'RAIDING',
      phaseTicksRemaining: PHASE_DURATIONS.RAIDING,
      extracting: {
        ticksRemaining: Math.max(1, sanitizeTicksRemaining(raid.phaseTicksRemaining, EXTRACTING_TICKS)),
        totalTicks: EXTRACTING_TICKS,
      },
      downed: null,
    }
  }

  if (phase === 'DOWNED') {
    return {
      ...baseRaid,
      phase: 'KNOCKED_OUT',
      phaseTicksRemaining: Math.max(1, sanitizeTicksRemaining(raid.phaseTicksRemaining, PHASE_DURATIONS.KNOCKED_OUT)),
      activeShieldRecharge: null,
      healingItems: [],
      downed: null,
      extracting: null,
    }
  }

  return {
    ...baseRaid,
    phase,
    phaseTicksRemaining: sanitizeTicksRemaining(raid.phaseTicksRemaining, PHASE_DURATIONS[phase]),
  }
}

function normalizeOwnedWeapons(value: unknown): GameState['ownedWeapons'] {
  if (!Array.isArray(value)) return [createStarterOwnedWeapon()]

  const normalized = value.flatMap((entry): GameState['ownedWeapons'] => {
    if (!isRecord(entry) || typeof entry.weaponId !== 'string') return []
    const weapon = findWeapon(entry.weaponId)
    if (!weapon) return []
    const durability = typeof entry.durability === 'number' && Number.isFinite(entry.durability)
      ? Math.max(0, Math.min(weapon.durabilityMax, Math.floor(entry.durability)))
      : weapon.durabilityMax
    return [{ weaponId: weapon.id, durability }]
  })

  return normalized.length > 0 ? normalized : [createStarterOwnedWeapon()]
}

function reconcileEquippedWeaponId(
  equippedWeaponId: GameState['raid']['equippedWeaponId'],
  ownedWeapons: GameState['ownedWeapons'],
): string {
  if (typeof equippedWeaponId === 'string' && ownedWeapons.some(entry => entry.weaponId === equippedWeaponId)) {
    return equippedWeaponId
  }

  return ownedWeapons[0]?.weaponId ?? getDefaultWeapon().id
}

function normalizePurchasedHealingItems(value: unknown): GameState['purchasedHealingItems'] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry): GameState['purchasedHealingItems'] => {
    if (!isRecord(entry) || typeof entry.itemId !== 'string' || typeof entry.name !== 'string') return []
    const quantity = sanitizeCount(entry.quantity)
    if (quantity <= 0) return []

    return [{
      itemId: entry.itemId,
      name: entry.name,
      healAmount: typeof entry.healAmount === 'number' && Number.isFinite(entry.healAmount)
        ? Math.max(0, Math.floor(entry.healAmount))
        : 0,
      reviveAmount: typeof entry.reviveAmount === 'number' && Number.isFinite(entry.reviveAmount)
        ? Math.max(0, Math.floor(entry.reviveAmount))
        : undefined,
      moodGain: typeof entry.moodGain === 'number' && Number.isFinite(entry.moodGain)
        ? Math.floor(entry.moodGain)
        : 0,
      rarity: typeof entry.rarity === 'number' && Number.isFinite(entry.rarity)
        ? Math.max(1, Math.min(5, Math.floor(entry.rarity)))
        : 1,
      flavor: typeof entry.flavor === 'string' ? entry.flavor : undefined,
      quantity,
    }]
  })
}

function sanitizeCounterMap(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {}

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, count]) => [key, sanitizeCount(count)] as const)
      .filter(([, count]) => count > 0),
  )
}

function sanitizeOutcomeStats(value: unknown, fallbackTotal: number): OutcomeContextStats {
  if (!isRecord(value)) {
    return {
      total: fallbackTotal,
      byZone: {},
      byZoneAndDanger: {},
    }
  }

  const hasTotal = Object.prototype.hasOwnProperty.call(value, 'total')
  const byZone = sanitizeCounterMap(value.byZone)
  const byZoneAndDanger = sanitizeCounterMap(value.byZoneAndDanger)
  const minimumTotal = Math.max(
    0,
    ...Object.values(byZone),
    ...Object.values(byZoneAndDanger),
  )
  const baseTotal = hasTotal ? sanitizeCount(value.total) : fallbackTotal

  return {
    total: Math.max(baseTotal, minimumTotal),
    byZone,
    byZoneAndDanger,
  }
}

function sanitizeHealingItemsUsed(value: unknown): RaiderLifetimeStats['healingItemsUsed'] {
  if (!isRecord(value)) {
    return {
      total: 0,
      byItem: {},
    }
  }

  const byItem = sanitizeCounterMap(value.byItem)
  const byItemTotal = Object.values(byItem).reduce((sum, count) => sum + count, 0)
  const savedTotal = typeof value.total === 'number' && Number.isFinite(value.total)
    ? sanitizeCount(value.total)
    : byItemTotal

  return {
    total: Math.max(savedTotal, byItemTotal),
    byItem,
  }
}

function normalizeLifetimeStats(state: GameState): RaiderLifetimeStats {
  const fallback = seedLegacyLifetimeStats(state)
  if (!isRecord(state.stats)) return fallback

  return {
    extracts: sanitizeOutcomeStats(state.stats.extracts, fallback.extracts.total),
    deaths: sanitizeOutcomeStats(state.stats.deaths, fallback.deaths.total),
    robotDefeats: sanitizeCounterMap(state.stats.robotDefeats),
    healingItemsUsed: sanitizeHealingItemsUsed(state.stats.healingItemsUsed),
  }
}

function seedLegacyRaiderLevelXp(raider: Pick<GameState['raider'], 'extractCount' | 'deathCount' | 'deploysCount'>): number {
  const extracts = Math.max(0, raider.extractCount ?? 0)
  const deaths = Math.max(0, raider.deathCount ?? 0)
  const deploys = Math.max(0, raider.deploysCount ?? 0)
  return normalizeRaiderLevelXp(extracts * 60 + deaths * 15 + deploys * 4)
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
      if (data.version > SAVE_VERSION || data.version < MIN_SUPPORTED_SAVE_VERSION) return null
      // Migration: older saves lack coins, and stashes saved while the limit
      // was not enforced may exceed it — sell the overflow rather than delete it.
      const { pendingReadyUp: _pendingReadyUp, ...loadedState } = data.state as GameState & { pendingReadyUp?: boolean }
      const loadedRaider = loadedState.raider as LegacyRaiderStats
      const legacyActivityLog = (loadedState as GameState & { activityLog?: unknown }).activityLog
      const sale = sellStashOverflow(loadedState.homeStash)
      const ownedWeapons = normalizeOwnedWeapons((loadedState as unknown as Record<string, unknown>).ownedWeapons)
      const normalizedRaid = normalizeRaidState(loadedState.raid)
      data.state = {
        ...loadedState,
        raider: {
          ...loadedState.raider,
          mood: clampMood(loadedState.raider.mood),
          levelXp: loadedRaider.levelXp === undefined
            ? seedLegacyRaiderLevelXp(loadedRaider)
            : normalizeRaiderLevelXp(loadedRaider.levelXp),
          skills: normalizeSkills(loadedState.raider.skills),
        },
        signalAmplifiers: loadedState.signalAmplifiers ?? 0,
        pendingCalm: (loadedState as any).pendingCalm ?? (loadedState as any).pendingEncourage ?? false,
        pendingPressure: (loadedState as any).pendingPressure ?? (loadedState as any).pendingScold ?? false,
        activityLog: Array.isArray(legacyActivityLog) ? legacyActivityLog as GameState['activityLog'] : [],
        homeStash: sale.homeStash,
        ownedWeapons,
        purchasedHealingItems: normalizePurchasedHealingItems((loadedState as unknown as Record<string, unknown>).purchasedHealingItems),
        coins: (loadedState.coins ?? 0) + sale.coinsGained,
        stats: normalizeLifetimeStats(loadedState),
        raid: {
          ...normalizedRaid,
          equippedWeaponId: reconcileEquippedWeaponId(normalizedRaid.equippedWeaponId, ownedWeapons),
        },
      }
      data.version = SAVE_VERSION
      data.state.version = SAVE_VERSION
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
