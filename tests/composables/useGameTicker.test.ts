import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { createInitialState } from '../../src/engine/initialState'
import { generateIdentityForSeed } from '../../src/engine/identity'

let visibility = ref<'visible' | 'hidden'>('visible')
const catchUp = vi.fn()
const processTick = vi.fn()

vi.mock('@vueuse/core', () => ({
  useDocumentVisibility: () => visibility,
}))

vi.mock('../../src/engine/catchUp.js', () => ({
  catchUp,
  TICK_INTERVAL_MS: 30_000,
}))

vi.mock('../../src/engine/tick.js', () => ({
  processTick,
}))

describe('useGameTicker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    vi.clearAllTimers()
    vi.resetModules()
    visibility = ref<'visible' | 'hidden'>('visible')
    catchUp.mockReset()
    processTick.mockReset()
  })

  it('does not schedule ticks or replay catch-up while canRun is false', async () => {
    const now = Date.now()
    const state = createInitialState(now, generateIdentityForSeed(1))
    const stateRef = ref(state)
    const lastTickAtRef = ref(now)
    const persist = vi.fn()
    const publishEvents = vi.fn()

    const { useGameTicker } = await import('../../src/composables/useGameTicker')
    useGameTicker(
      stateRef,
      lastTickAtRef,
      { current: { getSeed: () => 1 } as never },
      persist,
      publishEvents,
      () => false,
    )

    vi.advanceTimersByTime(30_000)
    expect(processTick).not.toHaveBeenCalled()

    visibility.value = 'hidden'
    await nextTick()
    visibility.value = 'visible'
    await nextTick()

    expect(catchUp).not.toHaveBeenCalled()
    expect(persist).not.toHaveBeenCalled()
  })

  it('schedules ticks once canRun becomes true and resume is called', async () => {
    const now = Date.now()
    const state = createInitialState(now, generateIdentityForSeed(2))
    const stateRef = ref(state)
    const lastTickAtRef = ref(now)
    const persist = vi.fn()
    const canRun = ref(false)

    processTick.mockImplementation((currentState) => ({
      state: { ...currentState, tick: currentState.tick + 1 },
      events: [],
    }))

    const { useGameTicker } = await import('../../src/composables/useGameTicker')
    const ticker = useGameTicker(
      stateRef,
      lastTickAtRef,
      { current: { getSeed: () => 2 } as never },
      persist,
      undefined,
      () => canRun.value,
    )

    canRun.value = true
    ticker.resume()
    vi.advanceTimersByTime(29_999)
    expect(processTick).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)

    expect(processTick).toHaveBeenCalledTimes(1)
    expect(persist).toHaveBeenCalledTimes(1)
    expect(stateRef.value.tick).toBe(state.tick + 1)
  })
})
