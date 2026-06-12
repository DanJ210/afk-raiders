/**
 * Raid state machine — manages phase transitions:
 *   HUB → DEPLOYING → RAIDING → (EXTRACTING | DOWNED) → HUB
 *
 * Each phase runs for a fixed number of ticks before transitioning.
 * The state machine returns a new RaidState + a phase-transition event text
 * when a transition occurs, or null if no transition happened this tick.
 */

import type { Phase, RaidState } from './types.js'

// Ticks each phase lasts before auto-transitioning
export const PHASE_DURATIONS: Record<Phase, number> = {
  HUB: 4,          // a few hub-gossip ticks before auto-deploying
  DEPLOYING: 2,    // loading screen / shuttle ride flavor
  RAIDING: 1800,   // 30 minutes max
  EXTRACTING: 4,   // ~45s extraction window + final tick = calling the return shuttle (60s at 15s/tick)
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
      forcedRaid = { ...forcedRaid, backpack: [], backpackValue: 0, greedLevel: 0, forceExtract: false }
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
    updatedRaid = { ...updatedRaid, backpack: [], backpackValue: 0, greedLevel: 0, forceExtract: false }
  }

  // Pick a zone when deploying
  if (next === 'DEPLOYING') {
    updatedRaid = { ...updatedRaid, zone: 'damp_battlegrounds' }
  }

  return { raid: updatedRaid, transition }
}

function nextPhase(current: Phase): Phase {
  switch (current) {
    case 'HUB':        return 'DEPLOYING'
    case 'DEPLOYING':  return 'RAIDING'
    case 'RAIDING':    return 'HUB'      // shouldn't happen naturally; greed check exits RAIDING
    case 'EXTRACTING': return 'HUB'
    case 'DOWNED':     return 'HUB'
  }
}

function phaseTransitionText(from: Phase, to: Phase): string {
  if (from === 'HUB' && to === 'DEPLOYING')
    return 'Gear packed. Shuttle inbound. Radio silence advised.'
  if (from === 'DEPLOYING' && to === 'RAIDING')
    return 'Touchdown. Zone is hot. Try not to die immediately.'
  if (from === 'RAIDING' && to === 'EXTRACTING')
    return 'Extract beacon deployed. Shuttle ETA 45 seconds. Please be at the LZ.'
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
