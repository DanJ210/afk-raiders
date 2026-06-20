import { describe, expect, it, beforeEach, vi } from 'vitest'
import { createInitialState, SAVE_VERSION } from '../../src/engine/initialState'
import { useGamePersistence } from '../../src/composables/useGamePersistence'

const STORAGE_KEY = 'afk-raiders-save'

function installLocalStorageMock() {
  const backing = new Map<string, string>()
  const localStorageMock = {
    getItem: vi.fn((key: string) => backing.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      backing.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      backing.delete(key)
    }),
  }
  vi.stubGlobal('localStorage', localStorageMock)
  return { backing, localStorageMock }
}

describe('useGamePersistence', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null when no save exists or version mismatches', () => {
    const { backing } = installLocalStorageMock()
    const persistence = useGamePersistence()

    expect(persistence.loadSave()).toBeNull()

    backing.set(STORAGE_KEY, JSON.stringify({
      state: createInitialState(0),
      seed: 1,
      lastTickAt: 0,
      version: SAVE_VERSION - 1,
    }))

    expect(persistence.loadSave()).toBeNull()
  })

  it('loads and migrates legacy fields', () => {
    installLocalStorageMock()
    const persistence = useGamePersistence()

    const legacyState: any = {
      ...createInitialState(0),
      raider: {
        ...createInitialState(0).raider,
        mood: 99,
        extractCount: 3,
        deathCount: 2,
      },
      stats: undefined,
      coins: undefined,
      signalAmplifiers: undefined,
      pendingCalm: undefined,
      pendingPressure: undefined,
      pendingEncourage: true,
      pendingScold: true,
      homeStash: [
        { itemId: 'junk_a', name: 'Junk A', value: 1, rarity: 1, quantity: 120 },
        { itemId: 'junk_b', name: 'Junk B', value: 2, rarity: 1, quantity: 10 },
      ],
      raid: {
        ...createInitialState(0).raid,
        shield: null,
        activeShieldRecharge: undefined,
        hiddenPocket: undefined,
        healingItems: undefined,
        dangerLevel: undefined,
        zoneCondition: undefined,
      },
    }

    ;(globalThis.localStorage as any).setItem(STORAGE_KEY, JSON.stringify({
      state: legacyState,
      seed: 123,
      lastTickAt: 456,
      version: SAVE_VERSION,
    }))

    const loaded = persistence.loadSave()
    expect(loaded).not.toBeNull()
    expect(loaded!.state.raider.mood).toBe(5)
    expect(loaded!.state.pendingCalm).toBe(true)
    expect(loaded!.state.pendingPressure).toBe(true)
    expect(loaded!.state.signalAmplifiers).toBe(0)
    expect(loaded!.state.raid.shield).not.toBeNull()
    expect(loaded!.state.stats.extracts.total).toBe(3)
    expect(loaded!.state.stats.deaths.total).toBe(2)
    expect(loaded!.state.coins).toBeGreaterThan(0)
    expect(loaded!.state.homeStash.reduce((sum, item) => sum + item.quantity, 0)).toBeLessThanOrEqual(120)
  })

  it('persists and clears saves', () => {
    const { localStorageMock } = installLocalStorageMock()
    const persistence = useGamePersistence()
    const state = createInitialState(0)

    persistence.persistSave(state, 11, 22)
    expect(localStorageMock.setItem).toHaveBeenCalledTimes(1)

    const loaded = persistence.loadSave()
    expect(loaded?.seed).toBe(11)
    expect(loaded?.lastTickAt).toBe(22)

    persistence.clearSave()
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(STORAGE_KEY)
  })

  it('swallows localStorage errors and returns null on bad JSON', () => {
    installLocalStorageMock()
    const persistence = useGamePersistence()

    ;(globalThis.localStorage as any).getItem.mockReturnValueOnce('not json')
    expect(persistence.loadSave()).toBeNull()

    ;(globalThis.localStorage as any).setItem.mockImplementationOnce(() => {
      throw new Error('quota')
    })
    expect(() => persistence.persistSave(createInitialState(0), 1, 1)).not.toThrow()

    ;(globalThis.localStorage as any).removeItem.mockImplementationOnce(() => {
      throw new Error('denied')
    })
    expect(() => persistence.clearSave()).not.toThrow()
  })
})
