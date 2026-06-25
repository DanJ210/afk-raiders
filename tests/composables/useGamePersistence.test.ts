import { afterEach, describe, expect, it, vi } from 'vitest'
import { useGamePersistence } from '../../src/composables/useGamePersistence'
import { createInitialState, SAVE_VERSION } from '../../src/engine/initialState'

const STORAGE_KEY = 'afk-raiders-save'

function stubLocalStorage(initialEntries: Array<[string, string]> = []) {
  const storage = new Map<string, string>(initialEntries)
  const localStorageStub: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key)
    }),
  }

  vi.stubGlobal('localStorage', localStorageStub)
  return { storage, localStorageStub }
}

describe('useGamePersistence', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('upgrades old saves and removes stale lifetime stat fields', () => {
    const initial = createInitialState(1000)
    const legacySave = {
      state: {
        ...initial,
        version: 5,
        raider: {
          ...initial.raider,
          extractCount: 9,
          deathCount: 4,
        },
        stats: {
          extracts: {
            total: 0,
            byZone: { damp_battlegrounds: 3 },
            byZoneAndDanger: { damp_battlegrounds__Medium: 2 },
            removedExtractBreakdown: { old: 99 },
          },
          deaths: {
            total: 'lost to old schema',
            byZone: { damp_battlegrounds: 1 },
            byZoneAndDanger: { damp_battlegrounds__High: 5 },
            removedDeathBreakdown: { old: 88 },
          },
          robotDefeats: { anxietick: 3 },
          healingItemsUsed: {
            total: 'lost to old schema',
            byItem: { bandage_blue: 4, bandage_purple: 2 },
            removedHealingBreakdown: { old: 77 },
          },
          shieldRechargersUsed: {
            total: 6,
            byItem: { fizz_cell: 6 },
          },
          removedLifetimeScore: 12345,
        },
      },
      seed: 123,
      lastTickAt: 1000,
      version: 5,
    }
    stubLocalStorage([[STORAGE_KEY, JSON.stringify(legacySave)]])

    const loaded = useGamePersistence().loadSave()

    expect(loaded?.version).toBe(SAVE_VERSION)
    expect(loaded?.state.version).toBe(SAVE_VERSION)
    expect(loaded?.state.stats).toEqual({
      extracts: {
        total: 3,
        byZone: { damp_battlegrounds: 3 },
        byZoneAndDanger: { damp_battlegrounds__Medium: 2 },
      },
      deaths: {
        total: 5,
        byZone: { damp_battlegrounds: 1 },
        byZoneAndDanger: { damp_battlegrounds__High: 5 },
      },
      robotDefeats: { anxietick: 3 },
      healingItemsUsed: {
        total: 6,
        byItem: { bandage_blue: 4, bandage_purple: 2 },
      },
    })
  })

  it('migrates legacy EXTRACTING phase saves into a RAIDING extraction condition', () => {
    const initial = createInitialState(1000)
    const legacySave = {
      state: {
        ...initial,
        version: 6,
        raid: {
          ...initial.raid,
          phase: 'EXTRACTING',
          phaseTicksRemaining: 3,
        },
      },
      seed: 123,
      lastTickAt: 1000,
      version: 6,
    }
    stubLocalStorage([[STORAGE_KEY, JSON.stringify(legacySave)]])

    const loaded = useGamePersistence().loadSave()

    expect(loaded?.state.raid.phase).toBe('RAIDING')
    expect(loaded?.state.raid.phaseTicksRemaining).toBe(60)
    expect(loaded?.state.raid.extracting).toEqual({ ticksRemaining: 3 })
    expect(loaded?.state.raid.downed).toBeNull()
  })

  it('migrates legacy DOWNED phase saves into KNOCKED_OUT recovery', () => {
    const initial = createInitialState(1000)
    const legacySave = {
      state: {
        ...initial,
        version: 6,
        raid: {
          ...initial.raid,
          phase: 'DOWNED',
          phaseTicksRemaining: 1,
          extracting: { ticksRemaining: 2 },
          downed: { ticksRemaining: 1 },
          healingItems: [
            {
              itemId: 'bandage_blue',
              name: 'Blue Bandage',
              healAmount: 25,
              moodGain: 3,
              rarity: 3,
              quantity: 1,
            },
          ],
        },
      },
      seed: 123,
      lastTickAt: 1000,
      version: 6,
    }
    stubLocalStorage([[STORAGE_KEY, JSON.stringify(legacySave)]])

    const loaded = useGamePersistence().loadSave()

    expect(loaded?.state.raid.phase).toBe('KNOCKED_OUT')
    expect(loaded?.state.raid.phaseTicksRemaining).toBe(1)
    expect(loaded?.state.raid.extracting).toBeNull()
    expect(loaded?.state.raid.downed).toBeNull()
    expect(loaded?.state.raid.healingItems).toEqual([])
  })
})
