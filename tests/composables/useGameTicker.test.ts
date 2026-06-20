import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@vueuse/core', async () => {
  const { ref } = await import('vue')
  const visibility = ref<'visible' | 'hidden'>('visible')
  return {
    useDocumentVisibility: () => visibility,
  }
})

import { createRNG } from '../../src/engine/rng'
import { createInitialState } from '../../src/engine/initialState'
import { TICK_INTERVAL_MS } from '../../src/engine/catchUp'
import { useGameTicker } from '../../src/composables/useGameTicker'

describe('useGameTicker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1000)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('ticks on cadence and persists after each scheduled tick', () => {
    const stateRef = { value: createInitialState(0) }
    stateRef.value = {
      ...stateRef.value,
      raid: { ...stateRef.value.raid, phase: 'RAIDING', phaseTicksRemaining: 60 },
    }
    const lastTickAtRef = { value: Date.now() }
    const rngRef = { current: createRNG(123) }
    const persist = vi.fn()

    useGameTicker(stateRef as any, lastTickAtRef as any, rngRef, persist)

    vi.advanceTimersByTime(TICK_INTERVAL_MS)

    expect(stateRef.value.tick).toBe(1)
    expect(persist).toHaveBeenCalledTimes(1)
  })

  it('pause stops scheduled ticks and resume restarts them', () => {
    const stateRef = { value: createInitialState(0) }
    stateRef.value = {
      ...stateRef.value,
      raid: { ...stateRef.value.raid, phase: 'RAIDING', phaseTicksRemaining: 60 },
    }
    const lastTickAtRef = { value: Date.now() }
    const rngRef = { current: createRNG(1) }
    const persist = vi.fn()

    const ticker = useGameTicker(stateRef as any, lastTickAtRef as any, rngRef, persist)

    ticker.pause()
    vi.advanceTimersByTime(TICK_INTERVAL_MS * 2)
    expect(stateRef.value.tick).toBe(0)

    lastTickAtRef.value = Date.now()
    ticker.resume()
    vi.advanceTimersByTime(TICK_INTERVAL_MS)
    expect(stateRef.value.tick).toBe(1)
    expect(persist).toHaveBeenCalledTimes(1)
  })

  it('exposes awaySummary ref', () => {
    const stateRef = { value: createInitialState(0) }
    const lastTickAtRef = { value: Date.now() }
    const rngRef = { current: createRNG(9) }

    const ticker = useGameTicker(stateRef as any, lastTickAtRef as any, rngRef, vi.fn())

    expect(ticker.awaySummary.value).toBeNull()
  })
})
