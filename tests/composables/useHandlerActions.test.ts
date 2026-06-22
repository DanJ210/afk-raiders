import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../../src/engine/initialState'
import { createRNG } from '../../src/engine/rng'
import { SIGNAL_CAP } from '../../src/engine/signal'
import type { GameState } from '../../src/engine/types'
import { useHandlerActions } from '../../src/composables/useHandlerActions'

function createHarness(state: GameState = createInitialState(0)) {
  const stateRef = { value: state }
  const rngRef = { current: createRNG(123) }
  const lastTickAtRef = { value: 0 }
  const persistCallback = vi.fn()

  const actions = useHandlerActions(
    stateRef,
    rngRef,
    lastTickAtRef,
    () => stateRef.value.pendingCalm || stateRef.value.pendingPressure || stateRef.value.raid.forceExtract,
    persistCallback,
    (newState, _seed, tickTime) => {
      stateRef.value = newState
      lastTickAtRef.value = tickTime
    },
    () => undefined,
  )

  return { actions, stateRef, persistCallback }
}

describe('useHandlerActions Signal Handling skill', () => {
  it('awards Signal Handling XP when Signal is successfully spent', () => {
    const initial = createInitialState(0)
    const now = Date.now()
    const { actions, stateRef, persistCallback } = createHarness({
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING',
      },
      signal: {
        ...initial.signal,
        current: SIGNAL_CAP,
        lastRegenAt: now,
      },
    })

    actions.callExtract()

    expect(stateRef.value.signal.current).toBe(SIGNAL_CAP - 3)
    expect(stateRef.value.raider.skills.signal_handling.xp).toBeGreaterThan(0)
    expect(stateRef.value.raider.skills.cardio.xp).toBe(0)
    expect(stateRef.value.raider.skills.hoarding.xp).toBe(0)
    expect(stateRef.value.raider.skills.hiding_in_lockers.xp).toBe(0)
    expect(persistCallback).toHaveBeenCalledOnce()
  })

  it('does not award Signal Handling XP when a Signal action is blocked', () => {
    const initial = createInitialState(0)
    const now = Date.now()
    const { actions, stateRef, persistCallback } = createHarness({
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'HUB',
      },
      signal: {
        ...initial.signal,
        current: SIGNAL_CAP,
        lastRegenAt: now,
      },
    })

    actions.callExtract()

    expect(stateRef.value.signal.current).toBe(SIGNAL_CAP)
    expect(stateRef.value.raider.skills.signal_handling.xp).toBe(0)
    expect(persistCallback).not.toHaveBeenCalled()
  })
})