/**
 * Raid state machine — manages phase transitions:
 *   HUB → DEPLOYING → RAIDING → (EXTRACTING | DOWNED) → HUB
 *
 * Each phase runs for a fixed number of ticks before transitioning.
 * The state machine returns a new RaidState + a phase-transition event text
 * when a transition occurs, or null if no transition happened this tick.
 */

import type { DangerLevel, Phase, RaidState, TimeOfDay, ZoneEntry } from './types.js'
import type { RNG } from './rng.js'
import zonesData from '../content/zones.json'

const zones = zonesData as ZoneEntry[]

const TIME_OF_DAY_TABLE: Array<{ id: TimeOfDay; weight: number; dangerLevel: DangerLevel }> = [
  { id: 'Day',        weight: 80, dangerLevel: 'Low' },
  { id: 'Night',      weight: 30, dangerLevel: 'Medium' },
  { id: 'Stella Red', weight: 10, dangerLevel: 'High' },
]

function enterDeploying(raid: RaidState, rng?: RNG): RaidState {
  const zone = rng ? rng.weightedPick(zones).id : zones[0].id
  const timeOfDay = rng ? rng.weightedPick(TIME_OF_DAY_TABLE).id : 'Day'
  return { ...raid, zone, timeOfDay }
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
      forcedRaid = { ...forcedRaid, backpack: [], healingItems: [], backpackValue: 0, greedLevel: 0, forceExtract: false, zone: null, timeOfDay: null }
    }
    // Healing items are lost on death — clear immediately so they aren't visible during DOWNED phase
    if (forced === 'DOWNED') {
      forcedRaid = { ...forcedRaid, healingItems: [] }
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
  const next = nextPhase(raid.phase)
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
    updatedRaid = { ...updatedRaid, backpack: [], healingItems: [], backpackValue: 0, greedLevel: 0, forceExtract: false, zone: null, timeOfDay: null }
  }

  // Pick a zone and time of day when deploying
  if (next === 'DEPLOYING') {
    updatedRaid = enterDeploying(updatedRaid, rng)
  }

  return { raid: updatedRaid, transition }
}

function nextPhase(current: Phase): Phase {
  switch (current) {
    case 'HUB':        return 'DEPLOYING'
    case 'DEPLOYING':  return 'RAIDING'
    case 'RAIDING':    return 'DOWNED' // raid timer expired before extraction; the nuke hits
    case 'EXTRACTING': return 'HUB'
    case 'DOWNED':     return 'HUB'
  }
}

function phaseTransitionText(from: Phase, to: Phase): string {
  if (from === 'HUB' && to === 'DEPLOYING')
    return 'Gear packed. Pod hatch sealed. One person capacity, zero personal space.'
  if (from === 'DEPLOYING' && to === 'RAIDING')
    return 'Pod doors hissed open. Zone is hot. Try not to die immediately.'
  if (from === 'RAIDING' && to === 'EXTRACTING')
    return 'Extract beacon deployed. Shuttle ETA about 90 seconds. Please be at the LZ.'
  if (from === 'RAIDING' && to === 'DOWNED')
    return "Raider is down. Emotional support pocket contents secured."
  if (from === 'EXTRACTING' && to === 'HUB')
    return 'Successful extraction. Welcome back to Desperanza. Please shower.'
  if (from === 'EXTRACTING' && to === 'RAIDING')
    return 'Shuttle waved off. Extraction unsuccessful. Back into the zone. The water bottles understand.'
  if (from === 'EXTRACTING' && to === 'DOWNED')
    return 'Downed at the LZ. So close. The shuttle pilot filed it under "tragic but funny."'
  if (from === 'DOWNED' && to === 'HUB')
    return 'Respawn in Desperanza. Gear lost. Dignity: pending recovery.'
  return `Phase transition: ${from} → ${to}`
}
