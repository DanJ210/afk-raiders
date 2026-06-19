/**
 * Signal meter tests:
 * - Regen timing: signal increases with elapsed time
 * - Cap at SIGNAL_CAP (5)
 * - Costs correctly deducted
 * - Cannot spend below zero
 */

import { describe, it, expect } from 'vitest'
import {
  computeSignal,
  spendSignal,
  initialSignalState,
  SIGNAL_CAP,
  SIGNAL_REGEN_MS,
  SIGNAL_COSTS,
  SCOLD_GREED_REDUCTION,
  applyScoldGreedReduction,
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

  it('caps at SIGNAL_CAP regardless of time elapsed', () => {
    const s = makeSignal(3, 0)
    const updated = computeSignal(s, 100 * SIGNAL_REGEN_MS)
    expect(updated.current).toBe(SIGNAL_CAP)
  })

  it('resets lastRegenAt to now when regen reaches cap', () => {
    const s = makeSignal(SIGNAL_CAP - 1, 0)
    // Enough time for 3 ticks but only 1 is consumable (cap = 5, current = 4)
    const updated = computeSignal(s, 3 * SIGNAL_REGEN_MS)
    expect(updated.current).toBe(SIGNAL_CAP)
    expect(updated.lastRegenAt).toBe(3 * SIGNAL_REGEN_MS)
  })

  it('does not immediately refill after spending when signal was full for a long time', () => {
    const now = 100 * SIGNAL_REGEN_MS
    const fullForAWhile = makeSignal(SIGNAL_CAP, 0)

    const normalized = computeSignal(fullForAWhile, now)
    const spent = spendSignal(normalized, 'ENCOURAGE')
    expect(spent).not.toBeNull()

    const afterSpend = computeSignal(spent!, now)
    expect(afterSpend.current).toBe(SIGNAL_CAP - SIGNAL_COSTS.ENCOURAGE)
  })

  it('spendSignal deducts cost for ENCOURAGE', () => {
    const s = makeSignal(3)
    const updated = spendSignal(s, 'ENCOURAGE')
    expect(updated?.current).toBe(3 - SIGNAL_COSTS.ENCOURAGE)
  })

  it('spendSignal deducts cost for SCOLD', () => {
    const s = makeSignal(3)
    const updated = spendSignal(s, 'SCOLD')
    expect(updated?.current).toBe(3 - SIGNAL_COSTS.SCOLD)
  })

  it('spendSignal deducts cost for CALL_EXTRACT', () => {
    const s = makeSignal(5)
    const updated = spendSignal(s, 'CALL_EXTRACT')
    expect(updated?.current).toBe(5 - SIGNAL_COSTS.CALL_EXTRACT)
  })

  it('spendSignal returns null when insufficient signal', () => {
    const s = makeSignal(0)
    expect(spendSignal(s, 'ENCOURAGE')).toBeNull()
  })

  it('spendSignal returns null for CALL_EXTRACT when signal < 3', () => {
    const s = makeSignal(2)
    expect(spendSignal(s, 'CALL_EXTRACT')).toBeNull()
  })

  it('SIGNAL_COSTS.CALL_EXTRACT is 3', () => {
    expect(SIGNAL_COSTS.CALL_EXTRACT).toBe(3)
  })

  it('applyScoldGreedReduction reduces greed by configured amount', () => {
    expect(applyScoldGreedReduction(30)).toBe(30 - SCOLD_GREED_REDUCTION)
  })

  it('applyScoldGreedReduction clamps greed at zero', () => {
    expect(applyScoldGreedReduction(5)).toBe(0)
  })
})

