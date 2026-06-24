/**
 * Raid state machine — manages phase transitions:
 *   HUB → DEPLOYING → RAIDING → (EXTRACTING | DOWNED) → HUB
 *
 * Each phase runs for a fixed number of ticks before transitioning.
 * The state machine returns a new RaidState + a phase-transition event text
 * when a transition occurs, or null if no transition happened this tick.
 */

import type { DangerLevel, Phase, RaidState, ZoneEntry } from './types.js'
import type { RNG } from './rng.js'
import zonesData from '../content/zones/zones.json'
import phaseTransitionsData from '../content/phase_transitions.json'
import type { ContentEntry } from './types.js'
import zoneConditionsData from '../content/zones/zone_conditions.json'
import { restoreShieldAtHub } from './shields.js'
import { decayGreedForHubReturn, majorConditionChanceFromGreed, resetGreedAfterDowned } from './greed.js'

const zones = zonesData as ZoneEntry[]

type Condition = ContentEntry & {
  name: string
  description: string
  dangerLevel: string
}
const minorConditions = zoneConditionsData.minor_conditions as Condition[]
const majorConditions = zoneConditionsData.major_conditions as Condition[]
const phaseTransitionContent = phaseTransitionsData as {
  transitions: Record<string, string>
  fallback: string
}

function pickCondition(raid: RaidState, rng?: RNG): Condition {
  if (!rng) return minorConditions[0]

  const useMajorCondition = rng.next() < majorConditionChanceFromGreed(raid.greedLevel)
  const pool = useMajorCondition ? majorConditions : minorConditions
  return rng.weightedPick(pool)
}

function normalizeDangerLevel(input: string): DangerLevel {
  const trimmed = input.trim()
  if (trimmed === 'Low' || trimmed === 'Medium' || trimmed === 'High') return trimmed
  return 'Low'
}

function enterDeploying(raid: RaidState, rng?: RNG): RaidState {
  const zone = rng ? rng.weightedPick(zones).id : zones[0].id
  const condition = pickCondition(raid, rng)
  const dangerLevel = normalizeDangerLevel(condition.dangerLevel)
  const zoneCondition = {
    id: condition.id,
    name: condition.name,
    description: condition.description,
  }
  return { ...raid, zone, dangerLevel, zoneCondition }
}

// Ticks each phase lasts before auto-transitioning (1 tick = 30s)
export const PHASE_DURATIONS: Record<Phase, number> = {
  HUB: 20,         // 10 minutes max resting and prepping in Desperanza
  DEPLOYING: 4,    // 2 minutes riding a one-person pod through the tunnel system
  RAIDING: 60,     // 60 ticks = 30 minutes max looting at 30s cadence; timer expiry means the zone gets nuked
  EXTRACTING: 4,   // ~90s extraction window + final tick = calling the return shuttle (~2 minutes total)
  DOWNED: 2,       // death rattle flavor before respawning
}

export interface PhaseTransition {
  from: Phase
  to: Phase
  eventText: string
}

/** Tick down the phase counter. Returns a transition if one occurred. */
export function tickPhase(
  raid: RaidState,
  forced?: Phase,
  rng?: RNG,
): { raid: RaidState; transition: PhaseTransition | null } {
  // Forced phase override (e.g. CALL_EXTRACT or death event)
  if (forced !== undefined && forced !== raid.phase) {
    const transition: PhaseTransition = {
      from: raid.phase,
      to: forced,
      eventText: phaseTransitionText(raid.phase, forced),
    }
    let forcedRaid: RaidState = {
      ...raid,
      phase: forced,
      phaseTicksRemaining: PHASE_DURATIONS[forced],
    }
    // Reset raid state when forced back to HUB (mirror of the natural-expiry path)
    if (forced === 'HUB') {
      forcedRaid = {
        ...forcedRaid,
        activeShieldRecharge: null,
        shield: restoreShieldAtHub(forcedRaid.shield),
        backpack: [],
        hiddenPocket: null,
        healingItems: [],
        backpackValue: 0,
        greedLevel: decayGreedForHubReturn(raid.greedLevel),
        forceExtract: false,
        zone: null,
        dangerLevel: null,
        zoneCondition: null,
      }
    }
    // Healing items are lost on death — clear immediately so they aren't visible during DOWNED phase
    if (forced === 'DOWNED') {
      forcedRaid = { ...forcedRaid, activeShieldRecharge: null, healingItems: [], greedLevel: resetGreedAfterDowned() }
    }
    if (forced === 'EXTRACTING') {
      forcedRaid = { ...forcedRaid, activeShieldRecharge: null }
    }
    if (forced === 'DEPLOYING') {
      forcedRaid = enterDeploying(forcedRaid, rng)
    }
    return { raid: forcedRaid, transition }
  }

  const remaining = raid.phaseTicksRemaining - 1

  // Still in current phase
  if (remaining > 0) {
    return { raid: { ...raid, phaseTicksRemaining: remaining }, transition: null }
  }

  // Natural expiry → determine next phase
  const next = nextPhase(raid)
  const transition: PhaseTransition = {
    from: raid.phase,
    to: next,
    eventText: phaseTransitionText(raid.phase, next),
  }

  let updatedRaid: RaidState = {
    ...raid,
    phase: next,
    phaseTicksRemaining: PHASE_DURATIONS[next],
  }

  // Reset raid state when returning to HUB
  if (next === 'HUB') {
    updatedRaid = {
      ...updatedRaid,
      activeShieldRecharge: null,
      shield: restoreShieldAtHub(updatedRaid.shield),
      backpack: [],
      hiddenPocket: null,
      healingItems: [],
      backpackValue: 0,
      greedLevel: decayGreedForHubReturn(raid.greedLevel),
      forceExtract: false,
      zone: null,
      dangerLevel: null,
      zoneCondition: null,
    }
  }

  // Healing items are lost on death — clear on natural DOWNED transitions too.
  if (next === 'DOWNED') {
    updatedRaid = { ...updatedRaid, activeShieldRecharge: null, healingItems: [], greedLevel: resetGreedAfterDowned() }
  }

  if (next === 'EXTRACTING') {
    updatedRaid = { ...updatedRaid, activeShieldRecharge: null }
  }

  // Pick a zone and condition when deploying
  if (next === 'DEPLOYING') {
    updatedRaid = enterDeploying(updatedRaid, rng)
  }

  return { raid: updatedRaid, transition }
}

function nextPhase(raid: RaidState): Phase {
  switch (raid.phase) {
    case 'HUB':        return 'DEPLOYING'
    case 'DEPLOYING':  return 'RAIDING'
    case 'RAIDING':    return raid.forceExtract ? 'EXTRACTING' : 'DOWNED' // raid timer expired before extraction; the nuke hits unless Call Extract was already queued
    case 'EXTRACTING': return 'HUB'
    case 'DOWNED':     return 'HUB'
  }
}

function phaseTransitionText(from: Phase, to: Phase): string {
  const text = phaseTransitionContent.transitions[`${from}_to_${to}`] ?? phaseTransitionContent.fallback
  return text.replaceAll('{from}', from).replaceAll('{to}', to)
}
