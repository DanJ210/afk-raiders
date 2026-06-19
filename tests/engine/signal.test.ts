/**
 * Signal meter tests:
 * - Regen timing: signal increases with elapsed time
 * - Overflow can bank Signal Amplifiers
 * - Costs correctly deducted
 * - Cannot spend below zero
 */

import { describe, it, expect } from 'vitest'
import {
  advanceSignal,
  computeSignal,
  spendSignal,
  initialSignalState,
  SIGNAL_CAP,
  SIGNAL_REGEN_MS,
  SIGNAL_COSTS,
  CALM_GREED_REDUCTION,
  applyCalmGreedReduction,
} from '../../src/engine/signal'
import type { SignalState } from '../../src/engine/types'

function makeSignal(current: number, lastRegenAt = 0): SignalState {
  return { current, cap: SIGNAL_CAP, lastRegenAt }
}

describe('signal', () => {
  it('initialises at cap', () => {
    const s = initialSignalState(0)
    expect(s.current).toBe(SIGNAL_CAP)
    expect(s.cap).toBe(SIGNAL_CAP)
  })

  it('does not regen if no time has passed', () => {
    const s = makeSignal(2, 1000)
    const updated = computeSignal(s, 1000)
    expect(updated.current).toBe(2)
  })

  it('regens 1 signal after SIGNAL_REGEN_MS ms', () => {
    const s = makeSignal(2, 0)
    const updated = computeSignal(s, SIGNAL_REGEN_MS)
    expect(updated.current).toBe(3)
  })

  it('regens 2 signals after 2 × SIGNAL_REGEN_MS ms', () => {
    const s = makeSignal(1, 0)
    const updated = computeSignal(s, 2 * SIGNAL_REGEN_MS)
    expect(updated.current).toBe(3)
  })

  it('banks a Signal Amplifier when signal overflows past cap', () => {
    const s = makeSignal(SIGNAL_CAP, 0)
    const updated = advanceSignal(s, SIGNAL_REGEN_MS)
    expect(updated.signal.current).toBe(1)
    expect(updated.amplifiersGained).toBe(1)
  })

  it('banks repeated amplifiers over long elapsed time', () => {
    const s = makeSignal(3, 0)
    const updated = advanceSignal(s, 100 * SIGNAL_REGEN_MS)
    expect(updated.signal.current).toBe(3)
    expect(updated.amplifiersGained).toBe(20)
  })

  it('resets lastRegenAt to now when regen reaches cap', () => {
    const s = makeSignal(SIGNAL_CAP - 1, 0)
    // Enough time for 1 tick to reach cap.
    const updated = computeSignal(s, SIGNAL_REGEN_MS)
    expect(updated.current).toBe(SIGNAL_CAP)
    expect(updated.lastRegenAt).toBe(SIGNAL_REGEN_MS)
  })

  it('spendSignal deducts cost for CALM', () => {
    const s = makeSignal(3)
    const updated = spendSignal(s, 'CALM')
    expect(updated?.current).toBe(3 - SIGNAL_COSTS.CALM)
  })

  it('spendSignal deducts cost for PRESSURE', () => {
    const s = makeSignal(3)
    const updated = spendSignal(s, 'PRESSURE')
    expect(updated?.current).toBe(3 - SIGNAL_COSTS.PRESSURE)
  })

  it('spendSignal deducts cost for CALL_EXTRACT', () => {
    const s = makeSignal(5)
    const updated = spendSignal(s, 'CALL_EXTRACT')
    expect(updated?.current).toBe(5 - SIGNAL_COSTS.CALL_EXTRACT)
  })

  it('spendSignal returns null when insufficient signal', () => {
    const s = makeSignal(0)
    expect(spendSignal(s, 'CALM')).toBeNull()
  })

  it('spendSignal returns null for CALL_EXTRACT when signal < 3', () => {
    const s = makeSignal(2)
    expect(spendSignal(s, 'CALL_EXTRACT')).toBeNull()
  })

  it('SIGNAL_COSTS.CALL_EXTRACT is 3', () => {
    expect(SIGNAL_COSTS.CALL_EXTRACT).toBe(3)
  })

  it('applyCalmGreedReduction reduces greed by configured amount', () => {
    expect(applyCalmGreedReduction(30)).toBe(30 - CALM_GREED_REDUCTION)
  })

  it('applyCalmGreedReduction clamps greed at zero', () => {
    expect(applyCalmGreedReduction(5)).toBe(0)
  })
})
