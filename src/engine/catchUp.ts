/**
 * Catch-up — on app load, replay elapsed ticks from the last known tick time.
 *
 * Rules:
 * - 1 tick per TICK_INTERVAL_MS of elapsed real time
 * - Capped at 8 hours' worth of ticks (MAX_CATCHUP_TICKS)
 * - Returns the new state plus a short summary of what happened
 */

import type { GameState } from './types.js'
import type { RNG } from './rng.js'
import { processTick } from './tick.js'

/** Real-time ms between ticks in the live app (5 seconds in dev cadence) */
export const TICK_INTERVAL_MS = 5_000

/** 8 hours' worth of ticks at TICK_INTERVAL_MS cadence */
export const MAX_CATCHUP_TICKS = Math.floor((8 * 60 * 60 * 1000) / TICK_INTERVAL_MS)

export interface AwaySummary {
  ticksReplayed: number
  deaths: number
  extracts: number
  itemsGained: number
  lines: string[]
}

export interface CatchUpResult {
  state: GameState
  summary: AwaySummary
}

/**
 * Given the last-saved state and timestamps, compute and replay elapsed ticks.
 * @param state      The saved GameState
 * @param rng        Seeded RNG (restored from saved seed)
 * @param lastTickAt ms timestamp of the last processed tick
 * @param now        Current ms timestamp (default: Date.now())
 * @param extractionPreference Optional extraction preference slider value (defaults to 50)
 */
export function catchUp(
  state: GameState,
  rng: RNG,
  lastTickAt: number,
  now: number = Date.now(),
  extractionPreference?: number,
): CatchUpResult {
  const elapsed = Math.max(0, now - lastTickAt)
  const rawTicks = Math.floor(elapsed / TICK_INTERVAL_MS)
  const ticksToReplay = Math.min(rawTicks, MAX_CATCHUP_TICKS)

  if (ticksToReplay === 0) {
    return {
      state,
      summary: { ticksReplayed: 0, deaths: 0, extracts: 0, itemsGained: 0, lines: [] },
    }
  }

  const before = {
    deathCount: state.raider.deathCount,
    extractCount: state.raider.extractCount,
    backpackValue: state.raid.backpackValue,
  }

  let currentState = state
  const tickNow = lastTickAt // advance time by tick interval each replay tick

  for (let i = 0; i < ticksToReplay; i++) {
    const result = processTick(currentState, rng, tickNow + i * TICK_INTERVAL_MS, extractionPreference)
    currentState = result.state
  }

  const deaths = currentState.raider.deathCount - before.deathCount
  const extracts = currentState.raider.extractCount - before.extractCount
  const itemsGained = Math.max(0, currentState.raid.backpackValue - before.backpackValue)

  const lines = buildSummaryLines(ticksToReplay, deaths, extracts, itemsGained)

  return {
    state: currentState,
    summary: { ticksReplayed: ticksToReplay, deaths, extracts, itemsGained, lines },
  }
}

function buildSummaryLines(
  ticks: number,
  deaths: number,
  extracts: number,
  itemsGained: number,
): string[] {
  const lines: string[] = []
  lines.push(`${ticks} tick${ticks !== 1 ? 's' : ''} elapsed while you were away.`)

  if (deaths > 0 && extracts > 0) {
    lines.push(`Raider died ${deaths} time${deaths !== 1 ? 's' : ''} and extracted ${extracts} time${extracts !== 1 ? 's' : ''}. Complicated.`)
  } else if (deaths > 0) {
    lines.push(`Raider died ${deaths} time${deaths !== 1 ? 's' : ''}. The Emotional Support Pocket survived.`)
  } else if (extracts > 0) {
    lines.push(`Raider extracted ${extracts} time${extracts !== 1 ? 's' : ''}. Without your help, somehow.`)
  } else {
    lines.push('Raider survived without incident. Suspicious.')
  }

  if (itemsGained > 0) {
    lines.push(`Loot value gained: ${itemsGained}. Mostly water bottles, probably.`)
  }

  return lines
}
