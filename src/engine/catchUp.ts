/**
 * Catch-up — on app load, replay elapsed ticks from the last known tick time.
 *
 * Rules:
 * - 1 tick per TICK_INTERVAL_MS of elapsed real time
 * - Capped at 8 hours' worth of ticks (MAX_CATCHUP_TICKS)
 * - Returns the new state plus a short summary of what happened
 */

import type { GameState, LogEvent } from './types.js'
import type { RNG } from './rng.js'
import { getTotalItemValue } from './homeStash.js'
import { processTick } from './tick.js'

/** Real-time ms between ticks in the live app (30 seconds) */
export const TICK_INTERVAL_MS = 30_000

/** 8 hours' worth of ticks at TICK_INTERVAL_MS cadence */
export const MAX_CATCHUP_TICKS = Math.floor((8 * 60 * 60 * 1000) / TICK_INTERVAL_MS)

const SUMMARY_EVENT_LIMIT = 4

export interface AwaySummary {
  ticksReplayed: number
  deaths: number
  extracts: number
  /** Permanent stash value gained, including overflow loot converted into coins. */
  itemsGained: number
  lines: string[]
}

export interface CatchUpResult {
  state: GameState
  summary: AwaySummary
  events: LogEvent[]
}

/**
 * Given the last-saved state and timestamps, compute and replay elapsed ticks.
 * @param state      The saved GameState
 * @param rng        Seeded RNG (restored from saved seed)
 * @param lastTickAt ms timestamp of the last processed tick
 * @param now        Current ms timestamp (default: Date.now())
 */
export function catchUp(
  state: GameState,
  rng: RNG,
  lastTickAt: number,
  now: number = Date.now(),
): CatchUpResult {
  const elapsed = Math.max(0, now - lastTickAt)
  const rawTicks = Math.floor(elapsed / TICK_INTERVAL_MS)
  const ticksToReplay = Math.min(rawTicks, MAX_CATCHUP_TICKS)

  if (ticksToReplay === 0) {
    return {
      state,
      summary: { ticksReplayed: 0, deaths: 0, extracts: 0, itemsGained: 0, lines: [] },
      events: [],
    }
  }

  // Coins count too: overflow loot auto-sells, converting item value to coins.
  const stashValueBefore = getTotalItemValue(state.homeStash) + state.coins

  let currentState = state
  const replayedEvents: LogEvent[] = []

  for (let i = 0; i < ticksToReplay; i++) {
    const tickNow = lastTickAt + (i + 1) * TICK_INTERVAL_MS
    const result = processTick(currentState, rng, tickNow)
    currentState = result.state
    replayedEvents.push(...result.events)
  }

  const deaths = replayedEvents.filter(isDeathTransition).length
  const extracts = replayedEvents.filter(isExtractionTransition).length
  const lootValueGained = Math.max(
    0,
    getTotalItemValue(currentState.homeStash) + currentState.coins - stashValueBefore,
  )

  const lines = buildSummaryLines(ticksToReplay, deaths, extracts, lootValueGained, replayedEvents)

  return {
    state: currentState,
    summary: { ticksReplayed: ticksToReplay, deaths, extracts, itemsGained: lootValueGained, lines },
    events: replayedEvents,
  }
}

function isDeathTransition(event: LogEvent): boolean {
  return event.id === 'phase_RAIDING_to_KNOCKED_OUT'
}

function isExtractionTransition(event: LogEvent): boolean {
  return event.id === 'phase_RAIDING_to_HUB'
}

function buildSummaryLines(
  ticks: number,
  deaths: number,
  extracts: number,
  lootValueGained: number,
  events: LogEvent[],
): string[] {
  const lines: string[] = []
  lines.push(`Replayed ${formatElapsed(ticks)} while you were away (${formatCount(ticks, 'tick')}).`)

  const stats = [
    deaths === 0 ? 'no new deaths' : formatCount(deaths, 'death', 'deaths'),
    extracts === 0 ? 'no successful extractions' : formatCount(extracts, 'successful extraction'),
    lootValueGained === 0 ? 'no stash value gained' : `+${lootValueGained} stash value`,
  ]
  lines.push(`Stats: ${stats.join(', ')}.`)

  const highlights = selectSummaryEvents(events)
  if (highlights.length === 0) {
    lines.push('No comms events were recorded during catch-up.')
  } else {
    lines.push(...highlights.map(event => event.text))
  }

  return lines
}

function selectSummaryEvents(events: LogEvent[]): LogEvent[] {
  const seenText = new Set<string>()
  const ranked = events
    .map((event, index) => ({ event, index, priority: summaryPriority(event) }))
    .sort((a, b) => b.priority - a.priority || b.index - a.index)

  const selected: Array<{ event: LogEvent; index: number }> = []
  for (const item of ranked) {
    if (selected.length >= SUMMARY_EVENT_LIMIT) break
    if (seenText.has(item.event.text)) continue
    seenText.add(item.event.text)
    selected.push({ event: item.event, index: item.index })
  }

  return selected
    .sort((a, b) => a.index - b.index)
    .map(item => item.event)
}

function summaryPriority(event: LogEvent): number {
  if (isDeathTransition(event) || isExtractionTransition(event)) return 5
  if (event.id === 'stash_overflow_sale' || event.id.startsWith('robot_')) return 4
  if (event.id.startsWith('healing_')) return 3
  if (event.id.startsWith('phase_')) return 2
  if (event.phase === 'RAIDING') return 1
  return 0
}

function formatElapsed(ticks: number): string {
  const seconds = Math.floor((ticks * TICK_INTERVAL_MS) / 1000)
  if (seconds < 60) return formatCount(seconds, 'second')

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) {
    return remainingSeconds === 0
      ? formatCount(minutes, 'minute')
      : `${formatCount(minutes, 'minute')} ${formatCount(remainingSeconds, 'second')}`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes === 0
    ? formatCount(hours, 'hour')
    : `${formatCount(hours, 'hour')} ${formatCount(remainingMinutes, 'minute')}`
}

function formatCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}
