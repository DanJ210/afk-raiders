/**
 * Signal meter — the only player resource in AFK Raiders.
 *
 * Signal regenerates over real time (~1 per 10 minutes), capped at 5.
 * Actions and their costs:
 *   ENCOURAGE    → 1 Signal
 *   SCOLD        → 1 Signal
 *   CALL_EXTRACT → 3 Signal
 */

import type { SignalState } from './types.js'

export const SIGNAL_CAP = 5
export const SIGNAL_REGEN_MS = 10 * 60 * 1000  // 10 minutes in ms

export const SIGNAL_COSTS = {
  ENCOURAGE: 1,
  SCOLD: 1,
  CALL_EXTRACT: 3,
} as const

export type SignalAction = keyof typeof SIGNAL_COSTS

/** Compute the current signal level based on elapsed time since last regen tick */
export function computeSignal(signal: SignalState, now: number): SignalState {
  const elapsed = now - signal.lastRegenAt
  const regenTicks = Math.floor(elapsed / SIGNAL_REGEN_MS)

  if (regenTicks <= 0) return signal

  const newCurrent = Math.min(SIGNAL_CAP, signal.current + regenTicks)
  const consumed = newCurrent - signal.current
  // Advance lastRegenAt only by the ticks actually consumed
  const newLastRegenAt = signal.lastRegenAt + consumed * SIGNAL_REGEN_MS

  return { ...signal, current: newCurrent, lastRegenAt: newLastRegenAt }
}

/** Attempt to spend signal for an action. Returns updated state, or null if insufficient. */
export function spendSignal(signal: SignalState, action: SignalAction): SignalState | null {
  const cost = SIGNAL_COSTS[action]
  if (signal.current < cost) return null
  return { ...signal, current: signal.current - cost }
}

/** Create the initial signal state */
export function initialSignalState(now: number = Date.now()): SignalState {
  return {
    current: SIGNAL_CAP,
    cap: SIGNAL_CAP,
    lastRegenAt: now,
  }
}
