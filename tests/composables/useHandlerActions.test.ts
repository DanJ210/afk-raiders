import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createRNG } from '../../src/engine/rng'
import { createInitialState } from '../../src/engine/initialState'
import { useHandlerActions } from '../../src/composables/useHandlerActions'

describe('useHandlerActions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(Date, 'now').mockReturnValue(0)
  })

  function setup(opts: { pending?: boolean } = {}) {
    const stateRef = { value: createInitialState(0) }
    const rngRef = { current: createRNG(123) }
    const lastTickAtRef = { value: 0 }
    const persistCallback = vi.fn()
    const onResetSave = vi.fn()
    const onAwaySummaryDismiss = vi.fn()

    const actions = useHandlerActions(
      stateRef,
      rngRef,
      lastTickAtRef,
      () => !!opts.pending,
      persistCallback,
      onResetSave,
      onAwaySummaryDismiss,
    )

    return { stateRef, persistCallback, onResetSave, onAwaySummaryDismiss, actions }
  }

  it('calm consumes signal and sets pendingCalm during RAIDING', () => {
    const { stateRef, persistCallback, actions } = setup()
    stateRef.value = { ...stateRef.value, raid: { ...stateRef.value.raid, phase: 'RAIDING' } }

    actions.calm()

    expect(stateRef.value.pendingCalm).toBe(true)
    expect(stateRef.value.signal.current).toBe(4)
    expect(persistCallback).toHaveBeenCalledTimes(1)
  })

  it('pressure is blocked when another handler action is pending', () => {
    const { stateRef, persistCallback, actions } = setup({ pending: true })
    stateRef.value = { ...stateRef.value, raid: { ...stateRef.value.raid, phase: 'RAIDING' } }

    actions.pressure()

    expect(stateRef.value.pendingPressure).toBe(false)
    expect(stateRef.value.signal.current).toBe(5)
    expect(persistCallback).not.toHaveBeenCalled()
  })

  it('readyUp in HUB transitions to DEPLOYING and logs transition', () => {
    const { stateRef, persistCallback, actions } = setup()

    actions.readyUp()

    expect(stateRef.value.raid.phase).toBe('DEPLOYING')
    expect(stateRef.value.signal.current).toBe(3)
    expect(stateRef.value.log.at(-1)?.id).toBe('phase_HUB_to_DEPLOYING')
    expect(persistCallback).toHaveBeenCalledTimes(1)
  })

  it('callExtract flags forceExtract and spends signal in RAIDING', () => {
    const { stateRef, actions } = setup()
    stateRef.value = { ...stateRef.value, raid: { ...stateRef.value.raid, phase: 'RAIDING' } }

    actions.callExtract()

    expect(stateRef.value.raid.forceExtract).toBe(true)
    expect(stateRef.value.signal.current).toBe(2)
  })

  it('set/clear hidden pocket and sell stash update state and persist', () => {
    const { stateRef, persistCallback, actions } = setup()
    stateRef.value = {
      ...stateRef.value,
      raid: {
        ...stateRef.value.raid,
        phase: 'RAIDING',
        backpack: [
          { itemId: 'water_bottle', name: 'Water Bottle', value: 5, rarity: 1, quantity: 3 },
        ],
      },
      homeStash: [
        { itemId: 'scrap', name: 'Scrap', value: 2, rarity: 1, quantity: 4 },
      ],
    }

    actions.setHiddenPocketItem('water_bottle')
    expect(stateRef.value.raid.hiddenPocket?.itemId).toBe('water_bottle')

    actions.clearHiddenPocketItem()
    expect(stateRef.value.raid.hiddenPocket).toBeNull()

    actions.sellHomeStashItem('scrap', 2)
    expect(stateRef.value.coins).toBe(4)
    expect(stateRef.value.homeStash[0].quantity).toBe(2)
    expect(persistCallback).toHaveBeenCalled()
  })

  it('renameRaider trims and caps length', () => {
    const { stateRef, actions } = setup()

    actions.renameRaider('   This name is definitely way too long for limit   ')

    expect(stateRef.value.raider.name.length).toBeLessThanOrEqual(actions.RAIDER_NAME_MAX_LENGTH)
    expect(stateRef.value.raider.name.startsWith('This name')).toBe(true)
  })

  it('resetSave and dismissAwaySummary trigger callbacks', () => {
    const { onResetSave, onAwaySummaryDismiss, actions } = setup()

    actions.resetSave()
    actions.dismissAwaySummary()

    expect(onResetSave).toHaveBeenCalledTimes(1)
    expect(onAwaySummaryDismiss).toHaveBeenCalledTimes(1)
  })
})
