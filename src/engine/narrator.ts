/**
 * Narrator callbacks — turns lifetime stats and outcome milestones into
 * continuity comms. Pure engine module: no Vue, DOM, or browser APIs.
 */

import narratorEventsData from '../content/narrator_events.json'
import robotsData from '../content/robots.json'
import zonesData from '../content/zones/zones.json'
import { CommsPriority, type DangerLevel, type GameState, type LogEvent, type RaiderLifetimeStats, type RobotEntry, type ZoneEntry } from './types.js'
import type { RNG } from './rng.js'

interface NarratorEntry {
  id: string
  weight: number
  text: string
}

interface NarratorMilestoneGroup {
  count: number
  entries: NarratorEntry[]
}

interface NarratorContent {
  firstExtract: NarratorEntry[]
  extractMilestones: NarratorMilestoneGroup[]
  firstDeath: NarratorEntry[]
  deathMilestones: NarratorMilestoneGroup[]
  zoneExtractReputation: NarratorMilestoneGroup[]
  zoneDeathReputation: NarratorMilestoneGroup[]
  waterBottleMilestones: NarratorMilestoneGroup[]
  nemesisEstablished: NarratorEntry[]
  nemesisDeepens: NarratorMilestoneGroup[]
}

const narratorEvents = narratorEventsData as NarratorContent
const robots = robotsData as RobotEntry[]
const zones = zonesData as ZoneEntry[]

export interface NarratorOutcomeContext {
  kind: 'extract' | 'death'
  zone: string | null
  dangerLevel: DangerLevel | null
}

function zoneName(zoneId: string | null): string {
  if (!zoneId) return 'that zone'
  return zones.find(zone => zone.id === zoneId)?.name ?? zoneId
}

function fillNarratorSlots(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, slot: string) => (
    slot in vars ? String(vars[slot]) : match
  ))
}

function makeNarratorEvent(entry: NarratorEntry, vars: Record<string, string | number>, tick: number, now: number): LogEvent {
  return {
    id: entry.id,
    tick,
    timestamp: now,
    text: fillNarratorSlots(entry.text, vars),
    phase: 'HUB',
    commsPriority: CommsPriority.Priority,
  }
}

function pickMilestoneGroup(groups: NarratorMilestoneGroup[], count: number): NarratorMilestoneGroup | null {
  return groups.find(group => group.count === count) ?? null
}

function waterBottleCount(state: GameState): number {
  return state.homeStash
    .filter(item => item.itemId.startsWith('water_bottle'))
    .reduce((sum, item) => sum + item.quantity, 0)
}

export function getNemesisRobotId(stats: RaiderLifetimeStats): string | null {
  const entries = Object.entries(stats.robotDownings)
  if (entries.length === 0) return null

  let bestId: string | null = null
  let bestCount = 0
  let tied = false
  for (const [robotId, count] of entries) {
    if (count > bestCount) {
      bestId = robotId
      bestCount = count
      tied = false
    } else if (count === bestCount && count > 0) {
      tied = true
    }
  }

  if (!bestId || bestCount <= 0 || tied) return null
  return bestId
}

export function getNemesisRobot(stats: RaiderLifetimeStats): RobotEntry | null {
  const robotId = getNemesisRobotId(stats)
  if (!robotId) return null
  return robots.find(robot => robot.id === robotId) ?? null
}

function queueEntry(events: LogEvent[], pool: NarratorEntry[], vars: Record<string, string | number>, rng: RNG, tick: number, now: number) {
  if (pool.length === 0) return
  events.push(makeNarratorEvent(rng.weightedPick(pool), vars, tick, now))
}

function queueMilestone(events: LogEvent[], groups: NarratorMilestoneGroup[], count: number, vars: Record<string, string | number>, rng: RNG, tick: number, now: number) {
  const group = pickMilestoneGroup(groups, count)
  if (!group || group.entries.length === 0) return
  events.push(makeNarratorEvent(rng.weightedPick(group.entries), vars, tick, now))
}

function queueCrossedMilestones(
  events: LogEvent[],
  groups: NarratorMilestoneGroup[],
  previousCount: number,
  nextCount: number,
  varsForCount: (count: number) => Record<string, string | number>,
  rng: RNG,
  tick: number,
  now: number,
) {
  if (nextCount <= previousCount) return
  for (const group of groups) {
    if (group.count <= previousCount || group.count > nextCount || group.entries.length === 0) continue
    events.push(makeNarratorEvent(rng.weightedPick(group.entries), varsForCount(group.count), tick, now))
  }
}

export function narrateOutcomeCallbacks(
  previous: GameState,
  next: GameState,
  context: NarratorOutcomeContext,
  rng: RNG,
  tick: number,
  now: number,
): LogEvent[] {
  const events: LogEvent[] = []
  const vars = {
    raider_name: next.raider.name,
    zone_name: zoneName(context.zone),
    danger_level: context.dangerLevel ?? 'Low',
  }

  if (context.kind === 'extract') {
    if (previous.raider.extractCount === 0 && next.raider.extractCount === 1) {
      queueEntry(events, narratorEvents.firstExtract, vars, rng, tick, now)
    }
    queueMilestone(events, narratorEvents.extractMilestones, next.raider.extractCount, vars, rng, tick, now)

    if (context.zone) {
      const zoneCount = next.stats.extracts.byZone[context.zone] ?? 0
      const previousZoneCount = previous.stats.extracts.byZone[context.zone] ?? 0
      if (zoneCount !== previousZoneCount) {
        queueMilestone(events, narratorEvents.zoneExtractReputation, zoneCount, { ...vars, count: zoneCount }, rng, tick, now)
      }
    }

    const previousWater = waterBottleCount(previous)
    const nextWater = waterBottleCount(next)
    queueCrossedMilestones(
      events,
      narratorEvents.waterBottleMilestones,
      previousWater,
      nextWater,
      count => ({ ...vars, water_count: count }),
      rng,
      tick,
      now,
    )
  }

  if (context.kind === 'death') {
    if (previous.raider.deathCount === 0 && next.raider.deathCount === 1) {
      queueEntry(events, narratorEvents.firstDeath, vars, rng, tick, now)
    }
    queueMilestone(events, narratorEvents.deathMilestones, next.raider.deathCount, vars, rng, tick, now)

    if (context.zone) {
      const zoneCount = next.stats.deaths.byZone[context.zone] ?? 0
      const previousZoneCount = previous.stats.deaths.byZone[context.zone] ?? 0
      if (zoneCount !== previousZoneCount) {
        queueMilestone(events, narratorEvents.zoneDeathReputation, zoneCount, { ...vars, count: zoneCount }, rng, tick, now)
      }
    }
  }

  return events
}

export function narrateNemesisCallbacks(
  previous: GameState,
  next: GameState,
  rng: RNG,
  tick: number,
  now: number,
): LogEvent[] {
  const events: LogEvent[] = []
  const previousNemesisId = getNemesisRobotId(previous.stats)
  const nextNemesisId = getNemesisRobotId(next.stats)
  if (!nextNemesisId) return events

  const previousNemesisCount = previous.stats.robotDownings[nextNemesisId] ?? 0
  const nextNemesisCount = next.stats.robotDownings[nextNemesisId] ?? 0
  const nextNemesisName = robots.find(robot => robot.id === nextNemesisId)?.name ?? nextNemesisId
  const vars = {
    raider_name: next.raider.name,
    robot_name: nextNemesisName,
    count: nextNemesisCount,
  }

  if (previousNemesisId !== nextNemesisId) {
    queueEntry(events, narratorEvents.nemesisEstablished, vars, rng, tick, now)
  } else if (nextNemesisCount !== previousNemesisCount) {
    queueMilestone(events, narratorEvents.nemesisDeepens, nextNemesisCount, vars, rng, tick, now)
  }

  return events
}
