/**
 * Signal meter — the only player resource in AFK Raiders.
 *
 * Signal regenerates over real time (~1 per 10 minutes), capped at 5.
 * Actions and their costs:
 *   ENCOURAGE    → 1 Signal
 *   SCOLD        → 1 Signal
 *   READY_UP     → 2 Signal
 *   CALL_EXTRACT → 3 Signal
 */

import type { SignalState } from './types.js'

export const SIGNAL_CAP = 5
export const SIGNAL_REGEN_MS = 10 * 60 * 1000  // 10 minutes in ms

export const SIGNAL_COSTS = {
  ENCOURAGE: 1,
  SCOLD: 1,
  READY_UP: 2,
  CALL_EXTRACT: 3,
} as const

/** How much greed a scold removes when consumed on the next raid tick. */
export const SCOLD_GREED_REDUCTION = 12
export const ENCOURAGE_GREED_INCREASE = 8

export type SignalAction = keyof typeof SIGNAL_COSTS

/** Compute the current signal level based on elapsed time since last regen tick */
export function computeSignal(signal: SignalState, now: number): SignalState {
  // While full, don't bank regen time; keep baseline at "now".
  if (signal.current >= SIGNAL_CAP) {
    if (signal.lastRegenAt === now) return signal
    return { ...signal, lastRegenAt: now }
  }

  const elapsed = now - signal.lastRegenAt
  const regenTicks = Math.floor(elapsed / SIGNAL_REGEN_MS)

  if (regenTicks <= 0) return signal

  const newCurrent = Math.min(SIGNAL_CAP, signal.current + regenTicks)
  // If we reached cap, reset the baseline to now so full-time cannot be banked.
  const newLastRegenAt = newCurrent >= SIGNAL_CAP
    ? now
    : signal.lastRegenAt + regenTicks * SIGNAL_REGEN_MS

  return { ...signal, current: newCurrent, lastRegenAt: newLastRegenAt }
}

/** Attempt to spend signal for an action. Returns updated state, or null if insufficient. */
export function spendSignal(signal: SignalState, action: SignalAction): SignalState | null {
  const cost = SIGNAL_COSTS[action]
  if (signal.current < cost) return null
  return { ...signal, current: signal.current - cost }
}

/** Apply the scold action's greed reduction with floor at 0. */
export function applyScoldGreedReduction(greedLevel: number): number {
  return Math.max(0, greedLevel - SCOLD_GREED_REDUCTION)
}

export function applyEncourageGreedIncrease(greedLevel: number): number {
  return Math.min(100, greedLevel + ENCOURAGE_GREED_INCREASE)
}

/** Create the initial signal state */
export function initialSignalState(now: number = Date.now()): SignalState {
  return {
    current: SIGNAL_CAP,
    cap: SIGNAL_CAP,
    lastRegenAt: now,
  }
}
