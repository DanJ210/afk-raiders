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
})
