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
 *   4. Apply event effects. If HP hits 0, the raider goes DOWNED and returns
 *      home with nothing.
 *   5. Consume pending Handler actions (encourage / scold).
 *   6. Increment tick counter, append events to log.
 */

import type { BackpackItem, GameState, LogEvent, TickResult } from './types.js'
import type { RNG } from './rng.js'
import { tickPhase } from './raidStateMachine.js'
import { runGreedCheck } from './greedCheck.js'
import { applyScoldGreedReduction } from './signal.js'
import { resolveEvent, resolveFlavorKey, applyEffects, resolveHealingItemFind, resolveRobotEncounter, events as allEvents } from './eventResolver.js'
import { transferBackpackToHomeStash, HOME_STASH_ITEM_LIMIT } from './homeStash.js'
import { appendLogEntries } from './log.js'

/**
 * Apply successful-extraction bookkeeping: transfer loot home, heal up, count
 * the win. If the stash overflows the item limit, the lowest-value items are
 * auto-sold and their value is credited to the raider's coin stash — nothing
 * is ever deleted. Returns sale info so the tick can narrate it.
 */
function applySuccessfulExtraction(
  state: GameState,
  extractedBackpack: BackpackItem[],
): { state: GameState; coinsGained: number; soldItemCount: number } {
  const transfer = transferBackpackToHomeStash(state.homeStash, extractedBackpack)
  return {
    state: {
      ...state,
      raider: {
        ...state.raider,
        hp: state.raider.maxHp,
        extractCount: state.raider.extractCount + 1,
      },
      homeStash: transfer.homeStash,
      coins: state.coins + transfer.coinsGained,
    },
    coinsGained: transfer.coinsGained,
    soldItemCount: transfer.soldItemCount,
  }
}

/** Comms line for overflow loot auto-sold from a full stash — the log IS the product. */
function stashSaleEvent(sold: number, coins: number, tick: number, now: number): LogEvent {
  return {
    id: 'stash_overflow_sale',
    tick,
    timestamp: now,
    text: `Home stash hit ${HOME_STASH_ITEM_LIMIT} items. Auto-sold the ${sold} cheapest item${sold === 1 ? '' : 's'} for ${coins} coin${coins === 1 ? '' : 's'}. The Desperanza pawn guy didn't even haggle.`,
    phase: 'HUB',
  }
}

export function processTick(state: GameState, rng: RNG, now: number = Date.now()): TickResult {
  const emitted: LogEvent[] = []

  // ------------------------------------------------------------------
  // 1. Run phase state machine
  // ------------------------------------------------------------------
  const { raid: nextRaid, transition } = tickPhase(state.raid, undefined, rng)
  let currentState: GameState = { ...state, raid: nextRaid }

  if (transition) {
    const transitionText =
      transition.from === 'RAIDING' && transition.to === 'DOWNED'
        ? 'Raid timer hit zero. Zone nuke confirmed. Raider was still in the blast radius.'
        : transition.eventText
    emitted.push({
      id: `phase_${transition.from}_to_${transition.to}`,
      tick: state.tick,
      timestamp: now,
      text: transitionText,
      phase: transition.to,
    })

    // Reset raider HP on HUB return; bookkeep deaths and extractions; transfer loot to home stash.
    // NOTE: tickPhase already cleared the backpack on HUB entry, so read the
    // pre-tick backpack from the input state.
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
        const extraction = applySuccessfulExtraction(currentState, state.raid.backpack)
        currentState = extraction.state
        if (extraction.soldItemCount > 0) {
          emitted.push(stashSaleEvent(extraction.soldItemCount, extraction.coinsGained, state.tick, now))
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // 2. Greed Check (RAIDING phase only, once per tick)
  // ------------------------------------------------------------------
  if (currentState.raid.phase === 'RAIDING') {
    const raidForGreedCheck = currentState.pendingScold
      ? {
          ...currentState.raid,
          greedLevel: applyScoldGreedReduction(currentState.raid.greedLevel),
        }
      : currentState.raid

    const greedResult = runGreedCheck(
      raidForGreedCheck,
      rng,
      {
        encouraged: currentState.pendingEncourage,
        scolded: currentState.pendingScold,
        currentHp: currentState.raider.hp,
        maxHp: currentState.raider.maxHp,
        hasHealingItems: currentState.raid.healingItems.length > 0,
      },
    )

    // Update greed level
    currentState = {
      ...currentState,
      raid: { ...raidForGreedCheck, greedLevel: greedResult.newGreedLevel },
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
    // PUSH_DEEPER -> stay in RAIDING (greedLevel already updated above)
  }

  // ------------------------------------------------------------------
  // 3. Resolve flavor event for current phase
  // ------------------------------------------------------------------
  const event = resolveEvent(currentState, rng, now)
  if (event) {
    const template = allEvents.find(e => e.id === event.id)
    emitted.push(event)
    if (template) {
      currentState = applyEffects(currentState, template, rng)

      if (template.effects?.healingItem) {
        const healingFind = resolveHealingItemFind(currentState, rng, now)
        currentState = healingFind.state
        emitted.push(healingFind.event)
      }

      const robotId = template.effects?.robotEncounter
      if (robotId) {
        const robotResult = resolveRobotEncounter(currentState, robotId, rng, now, {
          damageMultiplier: template.effects?.robotDamageMultiplier,
        })
        if (robotResult) {
          currentState = robotResult.state
          emitted.push(robotResult.event)
        }
      }

      // Some events (mostly extraction events) force a phase change:
      //  - EXTRACTING → HUB     = early successful extraction (loot goes home)
      //  - EXTRACTING → RAIDING = failed extraction (backpack kept, back to the zone)
      //  - EXTRACTING → DOWNED  = died at the LZ (backpack lost on respawn)
      const forcedPhase = template.effects?.forcePhase
      if (forcedPhase && forcedPhase !== currentState.raid.phase) {
        const fromPhase = currentState.raid.phase
        const backpackBeforeForce = currentState.raid.backpack
        const { raid: forcedRaid, transition: forcedTransition } = tickPhase(
          currentState.raid,
          forcedPhase,
        )
        currentState = { ...currentState, raid: forcedRaid }
        if (forcedTransition) {
          emitted.push({
            id: `phase_${forcedTransition.from}_to_${forcedTransition.to}`,
            tick: state.tick,
            timestamp: now,
            text: forcedTransition.eventText,
            phase: forcedTransition.to,
          })
        }
        if (fromPhase === 'EXTRACTING' && forcedPhase === 'HUB') {
          const extraction = applySuccessfulExtraction(currentState, backpackBeforeForce)
          currentState = extraction.state
          if (extraction.soldItemCount > 0) {
            emitted.push(stashSaleEvent(extraction.soldItemCount, extraction.coinsGained, state.tick, now))
          }
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // 3b. Death check — if HP ever reaches 0 outside the hub, the raider
  //     goes down. Loot is lost; they respawn in Desperanza (HUB) after
  //     the DOWNED flavor beat.
  // ------------------------------------------------------------------
  if (
    currentState.raider.hp <= 0 &&
    currentState.raid.phase !== 'DOWNED' &&
    currentState.raid.phase !== 'HUB'
  ) {
    const fromPhase = currentState.raid.phase
    const { raid: downedRaid, transition: downedTransition } = tickPhase(
      currentState.raid,
      'DOWNED',
    )
    currentState = { ...currentState, raid: downedRaid }
    if (downedTransition) {
      emitted.push({
        id: `phase_${fromPhase}_to_DOWNED`,
        tick: state.tick,
        timestamp: now,
        text: downedTransition.eventText,
        phase: 'DOWNED',
      })
    }
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
  const newLog = appendLogEntries(currentState.log, emitted)

  return {
    state: {
      ...currentState,
      tick: currentState.tick + 1,
      log: newLog,
    },
    events: emitted,
  }
}
