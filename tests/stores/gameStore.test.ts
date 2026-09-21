import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { createInitialState } from '../../src/engine/initialState'
import { generateIdentityForSeed } from '../../src/engine/identity'

const persistence = {
  loadSave: vi.fn(),
  persistSave: vi.fn(),
  clearSave: vi.fn(),
  loadCreationPending: vi.fn(),
  setCreationPending: vi.fn(),
}

const tickerPause = vi.fn()
const tickerResume = vi.fn()
let capturedResetSave:
  | ((freshState: ReturnType<typeof createInitialState>, newSeed: number, tickTime: number) => void)
  | null = null

vi.mock('../../src/composables/useGamePersistence.js', () => ({
  useGamePersistence: () => persistence,
}))

vi.mock('../../src/composables/useGameTicker.js', () => ({
  useGameTicker: () => ({
    awaySummary: ref(null),
    pause: tickerPause,
    resume: tickerResume,
  }),
}))

vi.mock('../../src/composables/useHandlerActions.js', () => ({
  useHandlerActions: (
    _state: unknown,
    _rngRef: unknown,
    _lastTickAt: unknown,
    _hasPending: unknown,
    _persist: unknown,
    resetSaveCallback: typeof capturedResetSave,
  ) => {
    capturedResetSave = resetSaveCallback
    return {
      calm: vi.fn(),
      pressure: vi.fn(),
      applySignalAmplifier: vi.fn(),
      readyUp: vi.fn(),
      callExtract: vi.fn(),
      revive: vi.fn(),
      applyHealingItem: vi.fn(),
      applyShieldRecharger: vi.fn(),
      setHiddenPocketItem: vi.fn(),
      clearHiddenPocketItem: vi.fn(),
      sellHomeStashItem: vi.fn(),
      resetSave: vi.fn(),
      dismissAwaySummary: vi.fn(),
      renameRaider: vi.fn(),
      RAIDER_NAME_MAX_LENGTH: 37,
    }
  },
}))

vi.mock('../../src/composables/usePreparationActions.js', () => ({
  usePreparationActions: () => ({
    purchaseWeapon: vi.fn(),
    purchaseHealingItem: vi.fn(),
    purchaseShieldRecharger: vi.fn(),
    equipWeapon: vi.fn(),
    setHealingLoadoutQuantity: vi.fn(),
    setShieldRechargerLoadoutQuantity: vi.fn(),
  }),
}))

describe('gameStore raider creation flow', () => {
  beforeEach(() => {
    vi.resetModules()
    setActivePinia(createPinia())
    persistence.loadSave.mockReset()
    persistence.persistSave.mockReset()
    persistence.clearSave.mockReset()
    persistence.loadCreationPending.mockReset()
    persistence.setCreationPending.mockReset()
    tickerPause.mockReset()
    tickerResume.mockReset()
    capturedResetSave = null
  })

  it('skips startup catch-up and pauses ticking while creation is pending', async () => {
    const saved = {
      state: createInitialState(1000, generateIdentityForSeed(123)),
      seed: 123,
      lastTickAt: 0,
      version: 11,
    }
    persistence.loadSave.mockReturnValue(saved)
    persistence.loadCreationPending.mockReturnValue(true)

    const { useGameStore } = await import('../../src/stores/gameStore')
    const store = useGameStore()

    expect(store.needsRaiderCreation).toBe(true)
    expect(store.state.tick).toBe(saved.state.tick)
    expect(persistence.persistSave).not.toHaveBeenCalled()
    expect(tickerPause).toHaveBeenCalledTimes(1)
  })

  it('resumes ticking after raider creation is confirmed', async () => {
    persistence.loadSave.mockReturnValue(null)
    persistence.loadCreationPending.mockReturnValue(false)

    const { useGameStore } = await import('../../src/stores/gameStore')
    const store = useGameStore()

    store.confirmRaiderCreation('Custom Name', ['coward', 'hoarder'])

    expect(store.needsRaiderCreation).toBe(false)
    expect(store.raider.name).toBe('Custom Name')
    expect(persistence.setCreationPending).toHaveBeenLastCalledWith(false)
    expect(persistence.persistSave).toHaveBeenCalledTimes(1)
    expect(tickerResume).toHaveBeenCalledTimes(1)
  })

  it('uses the current suggestion as the confirmation fallback identity', async () => {
    persistence.loadSave.mockReturnValue(null)
    persistence.loadCreationPending.mockReturnValue(false)

    const { useGameStore } = await import('../../src/stores/gameStore')
    const store = useGameStore()

    const suggestion = store.suggestIdentity()
    store.confirmRaiderCreation('   ', [])

    expect(store.raider.name).toBe(suggestion.name)
    expect(store.raider.traits).toEqual(suggestion.traits)
  })

  it('pauses ticking again when reset returns to the creation flow', async () => {
    persistence.loadSave.mockReturnValue(null)
    persistence.loadCreationPending.mockReturnValue(false)

    const { useGameStore } = await import('../../src/stores/gameStore')
    const store = useGameStore()

    capturedResetSave?.(createInitialState(2000, generateIdentityForSeed(456)), 456, 2000)

    expect(store.needsRaiderCreation).toBe(true)
    expect(persistence.setCreationPending).toHaveBeenLastCalledWith(true)
    expect(tickerPause).toHaveBeenCalledTimes(2)
  })
})
