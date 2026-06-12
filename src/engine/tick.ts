/**
 * processTick — the heart of the AFK Raiders simulation engine.
 *
 * Immutable-style: never mutates the input state. Always returns a new state.
 * One tick = one resolved event (or phase transition).
 *
 * Tick flow:
 *   1. Tick phase counter; if transitioning apply transition event.
 *   2. If RAIDING, run the Greed Check to decide push-deeper / extract / downed.
 *   3. Resolve a flavor event for the current phase.
 *   4. Apply event effects.
 *   5. Consume pending Handler actions (encourage / scold).
 *   6. Increment tick counter, append events to log.
 */

import type { GameState, LogEvent, TickResult } from './types.js'
import type { RNG } from './rng.js'
import { tickPhase } from './raidStateMachine.js'
import { runGreedCheck } from './greedCheck.js'
import { transferBackpackToHomeStash } from './homeStash.js'
import { resolveEvent, resolveFlavorKey, applyEffects, events as allEvents } from './eventResolver.js'

/** Maximum log entries to keep in memory (avoids unbounded growth) */
const MAX_LOG_SIZE = 200

export function processTick(state: GameState, rng: RNG, now: number = Date.now(), extractionPreference?: number): TickResult {
  const emitted: LogEvent[] = []
  const backpackBeforePhaseTick = state.raid.backpack

  // ------------------------------------------------------------------
  // 1. Run phase state machine
  // ------------------------------------------------------------------
  const { raid: nextRaid, transition } = tickPhase(state.raid)
  let currentState: GameState = { ...state, raid: nextRaid }

  if (transition) {
    emitted.push({
      id: `phase_${transition.from}_to_${transition.to}`,
      tick: state.tick,
      timestamp: now,
      text: transition.eventText,
      phase: transition.to,
    })

    // Reset raider HP on HUB return; bookkeep deaths and extractions; transfer loot to home stash
    if (transition.to === 'HUB') {
      if (transition.from === 'DOWNED') {
        currentState = {
          ...currentState,
          raider: {
            ...currentState.raider,
            hp: currentState.raider.maxHp,
            deathCount: currentState.raider.deathCount + 1,
          },
        }
      } else if (transition.from === 'EXTRACTING') {
        const { homeStash } = transferBackpackToHomeStash(currentState.homeStash, backpackBeforePhaseTick)

        currentState = {
          ...currentState,
          raider: {
            ...currentState.raider,
            hp: currentState.raider.maxHp,
            extractCount: currentState.raider.extractCount + 1,
          },
          homeStash,
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // 2. Greed Check (RAIDING phase only, once per tick)
  // ------------------------------------------------------------------
  if (currentState.raid.phase === 'RAIDING') {
    const greedResult = runGreedCheck(
      currentState.raid,
      rng,
      {
        encouraged: currentState.pendingEncourage,
        scolded: currentState.pendingScold,
        extractionPreference,
      },
    )

    // Update greed level
    currentState = {
      ...currentState,
      raid: { ...currentState.raid, greedLevel: greedResult.newGreedLevel },
    }

    if (greedResult.outcome === 'EXTRACT') {
      const { raid: r2, transition: t2 } = tickPhase(
        { ...currentState.raid, forceExtract: false },
        'EXTRACTING',
      )
      currentState = { ...currentState, raid: r2 }
      if (t2) {
        emitted.push({
          id: 'phase_RAIDING_to_EXTRACTING',
          tick: state.tick,
          timestamp: now,
          text: t2.eventText,
          phase: 'EXTRACTING',
        })
      }
    } else if (greedResult.outcome === 'DOWNED') {
      const { raid: r2, transition: t2 } = tickPhase(currentState.raid, 'DOWNED')
      currentState = { ...currentState, raid: r2 }
      if (t2) {
        emitted.push({
          id: 'phase_RAIDING_to_DOWNED',
          tick: state.tick,
          timestamp: now,
          text: t2.eventText,
          phase: 'DOWNED',
        })
      }
    }
    // PUSH_DEEPER → stay in RAIDING (greedLevel already updated above)
  }

  // ------------------------------------------------------------------
  // 3. Resolve flavor event for current phase
  // ------------------------------------------------------------------
  const event = resolveEvent(currentState, rng, now)
  if (event) {
    const template = allEvents.find(e => e.id === event.id)
    if (template) {
      currentState = applyEffects(currentState, template, rng)
    }
    emitted.push(event)
  }

  // ------------------------------------------------------------------
  // 4. Consume pending Handler actions (emit a feedback line)
  // ------------------------------------------------------------------
  if (currentState.pendingEncourage) {
    emitted.push({
      id: 'handler_encourage',
      tick: state.tick,
      timestamp: now,
      text: resolveFlavorKey('encourage_responses', rng),
      phase: currentState.raid.phase,
    })
  }
  if (currentState.pendingScold) {
    emitted.push({
      id: 'handler_scold',
      tick: state.tick,
      timestamp: now,
      text: resolveFlavorKey('scold_responses', rng),
      phase: currentState.raid.phase,
    })
  }

  currentState = {
    ...currentState,
    pendingEncourage: false,
    pendingScold: false,
    raid: { ...currentState.raid, forceExtract: false },
  }

  // ------------------------------------------------------------------
  // 5. Finalize: increment tick, append events to log
  // ------------------------------------------------------------------
  const newLog = [...currentState.log, ...emitted].slice(-MAX_LOG_SIZE)

  return {
    state: {
      ...currentState,
      tick: currentState.tick + 1,
      log: newLog,
    },
    events: emitted,
  }
}
