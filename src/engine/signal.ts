/**
 * Signal meter — the only player resource in AFK Raiders.
 *
 * Signal regenerates over real time (~1 per 10 minutes), capped at 5.
 * Actions and their costs:
 *   CALM         → 1 Signal
 *   PRESSURE     → 1 Signal
 *   READY_UP     → 2 Signal
 *   CALL_EXTRACT → 3 Signal
 */

import type { SignalState } from './types.js'

export const SIGNAL_CAP = 5
export const SIGNAL_REGEN_MS = 10 * 60 * 1000  // 10 minutes in ms

export const SIGNAL_COSTS = {
  CALM: 1,
  PRESSURE: 1,
  READY_UP: 2,
  CALL_EXTRACT: 3,
} as const

export interface SignalAdvanceResult {
  signal: SignalState
  amplifiersGained: number
}

/** How much greed calm removes when consumed on the next raid tick. */
export const CALM_GREED_REDUCTION = 12
export const PRESSURE_GREED_INCREASE = 8

export type SignalAction = keyof typeof SIGNAL_COSTS

/** Advance signal regen using the 1-through-5 loop. Overflow banks Signal Amplifiers. */
export function advanceSignal(signal: SignalState, now: number): SignalAdvanceResult {
  const elapsed = now - signal.lastRegenAt
  const regenTicks = Math.floor(elapsed / SIGNAL_REGEN_MS)

  if (regenTicks <= 0) {
    return { signal, amplifiersGained: 0 }
  }

  let current = signal.current
  let amplifiersGained = 0

  for (let i = 0; i < regenTicks; i++) {
    current += 1
    if (current > SIGNAL_CAP) {
      current -= SIGNAL_CAP
      amplifiersGained += 1
    }
  }

  return {
    signal: {
      ...signal,
      current,
      lastRegenAt: signal.lastRegenAt + regenTicks * SIGNAL_REGEN_MS,
    },
    amplifiersGained,
  }
}

/** Compute the current signal level based on elapsed time since last regen tick */
export function computeSignal(signal: SignalState, now: number): SignalState {
  return advanceSignal(signal, now).signal
}

/** Attempt to spend signal for an action. Returns updated state, or null if insufficient. */
export function spendSignal(signal: SignalState, action: SignalAction): SignalState | null {
  const cost = SIGNAL_COSTS[action]
  if (signal.current < cost) return null
  return { ...signal, current: signal.current - cost }
}

/** Apply the calm action's greed reduction with floor at 0. */
export function applyCalmGreedReduction(greedLevel: number): number {
  return Math.max(0, greedLevel - CALM_GREED_REDUCTION)
}

export function applyPressureGreedIncrease(greedLevel: number): number {
  return Math.min(100, greedLevel + PRESSURE_GREED_INCREASE)
}

/** Refill signal back to cap after spending a Signal Amplifier. */
export function refillSignalWithAmplifier(signal: SignalState, now: number): SignalState | null {
  if (signal.current >= SIGNAL_CAP) return null
  return {
    ...signal,
    current: SIGNAL_CAP,
    lastRegenAt: now,
  }
}

/** Create the initial signal state */
export function initialSignalState(now: number = Date.now()): SignalState {
  return {
    current: SIGNAL_CAP,
    cap: SIGNAL_CAP,
    lastRegenAt: now,
  }
}
