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
 *   5. Consume pending Handler actions (calm / pressure).
 *   6. Increment tick counter, append events to log.
 */

import type { BackpackItem, GameState, HiddenPocketItem, LogEvent, TickResult } from './types.js'
import type { RNG } from './rng.js'
import { tickPhase } from './raidStateMachine.js'
import { runGreedCheck } from './greedCheck.js'
import { advanceSignal, applyCalmGreedReduction, applyPressureGreedIncrease } from './signal.js'
import { describeShieldDamage, resolveEvent, resolveFlavorKey, applyEffects, resolveHealingItemFind, resolveRobotEncounter, resolveShieldRechargerFind, events as allEvents } from './eventResolver.js'
import { transferBackpackToHomeStash, HOME_STASH_ITEM_LIMIT } from './homeStash.js'
import { appendLogEntries } from './log.js'
import { recordOutcome, recordRobotDefeat } from './stats.js'
import { advanceShieldRecharge } from './shields.js'
import { applySkillPractice, getSkillModifierProfile, rollSkillPractice, type SkillLevelUp, type SkillPracticeTrigger } from './skills.js'
import { applyRaiderXpGain, getRaiderLevelBenefitProfile, rollRaiderXp, type RaiderLevelUp, type RaiderXpTrigger } from './raiderLevel.js'

const LOOT_BONUS_HEALING_ITEM_CHANCE = 0.2 // 20% chance to find a healing item on any loot event, independent of normal loot rolls
const LOOT_BONUS_SHIELD_RECHARGER_CHANCE = 0.15 // 15% chance to find a shield recharger on any loot event, independent of normal loot rolls
const NEUTRAL_MOOD_THRESHOLD = 0 // Mood above this is positive, below is negative; separate from the "mood" number which can go up to +5 or down to -5
/**
 * Apply successful-extraction bookkeeping: transfer loot home, heal up, count
 * the win. If the stash overflows the item limit, the lowest-value items are
 * auto-sold and their value is credited to the raider's coin stash — nothing
 * is ever deleted. Returns sale info so the tick can narrate it.
 */
function applySuccessfulExtraction(
  state: GameState,
  extractedBackpack: BackpackItem[],
  context: { zone: string | null; dangerLevel: GameState['raid']['dangerLevel'] },
): { state: GameState; coinsGained: number; soldItemCount: number; levelCoinBonus: number } {
  const transfer = transferBackpackToHomeStash(state.homeStash, extractedBackpack)
  const levelCoinBonus = getRaiderLevelBenefitProfile(state.raider.levelXp).extractionCoinBonus
  return {
    state: {
      ...state,
      raider: {
        ...state.raider,
        hp: state.raider.maxHp,
        mood: NEUTRAL_MOOD_THRESHOLD,
        extractCount: state.raider.extractCount + 1,
      },
      stats: recordOutcome(state.stats, 'extracts', context.zone, context.dangerLevel),
      homeStash: transfer.homeStash,
      coins: state.coins + transfer.coinsGained + levelCoinBonus,
    },
    coinsGained: transfer.coinsGained,
    soldItemCount: transfer.soldItemCount,
    levelCoinBonus,
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

function hiddenPocketSavedEvent(itemName: string, tick: number, now: number): LogEvent {
  return {
    id: 'hidden_pocket_saved',
    tick,
    timestamp: now,
    text: `Secret Hidden Pocket check: 1x ${itemName} made it home. Very legal, totally declared.`,
    phase: 'HUB',
  }
}

function raiderLevelExtractionBonusEvent(coins: number, tick: number, now: number): LogEvent {
  return {
    id: 'raider_level_extraction_stipend',
    tick,
    timestamp: now,
    text: `Raider Level stipend approved: +${coins} coin${coins === 1 ? '' : 's'} for surviving the paperwork portion of extraction.`,
    phase: 'HUB',
  }
}

function totalBackpackQuantity(backpack: BackpackItem[]): number {
  return backpack.reduce((sum, item) => sum + item.quantity, 0)
}

function queueSuccessfulExtractionSkillPractice(
  queue: SkillPracticeTrigger[],
  params: {
    backpack: BackpackItem[]
    backpackValue: number
    dangerLevel: GameState['raid']['dangerLevel']
    hp: number
    maxHp: number
  },
) {
  const backpackQuantity = totalBackpackQuantity(params.backpack)
  queue.push({ skillId: 'cardio', reason: 'extraction_success', minXp: 2, maxXp: 4 })

  if (params.maxHp > 0 && params.hp / params.maxHp <= 0.5) {
    queue.push({ skillId: 'cardio', reason: 'low_hp_extraction', minXp: 2, maxXp: 3 })
  }

  if (backpackQuantity > 0) {
    queue.push({ skillId: 'hoarding', reason: 'loot_added', minXp: 1, maxXp: Math.min(4, Math.max(1, Math.ceil(backpackQuantity / 3))) })
  }

  if (params.backpackValue >= 500) {
    queue.push({ skillId: 'hoarding', reason: 'valuable_extraction', minXp: 2, maxXp: 5 })
  }

  if (params.dangerLevel === 'High') {
    queue.push({ skillId: 'hiding_in_lockers', reason: 'high_danger_survived', minXp: 2, maxXp: 4 })
  }
}

function queueSuccessfulExtractionRaiderXp(
  queue: RaiderXpTrigger[],
  params: {
    backpack: BackpackItem[]
    backpackValue: number
    dangerLevel: GameState['raid']['dangerLevel']
    hp: number
    maxHp: number
  },
) {
  const backpackQuantity = totalBackpackQuantity(params.backpack)
  const dangerBonus = params.dangerLevel === 'High' ? 6 : params.dangerLevel === 'Medium' ? 4 : 2
  queue.push({ reason: 'extraction_success', minXp: 12 + dangerBonus, maxXp: 18 + dangerBonus })

  if (params.backpackValue > 0) {
    const valueXp = Math.min(24, Math.max(1, Math.floor(params.backpackValue / 60)))
    queue.push({ reason: 'loot_extracted', minXp: valueXp, maxXp: valueXp + Math.min(4, Math.ceil(valueXp / 4)) })
  }

  if (backpackQuantity > 0) {
    const quantityXp = Math.min(8, Math.max(1, Math.ceil(backpackQuantity / 4)))
    queue.push({ reason: 'loot_extracted', minXp: quantityXp, maxXp: quantityXp + 2 })
  }

  if (params.maxHp > 0 && params.hp / params.maxHp <= 0.5) {
    queue.push({ reason: 'close_call_extraction', minXp: 4, maxXp: 8 })
  }

  if (params.dangerLevel === 'High') {
    queue.push({ reason: 'high_danger_survived', minXp: 5, maxXp: 9 })
  }
}

function queueDeathRecoveryRaiderXp(queue: RaiderXpTrigger[], dangerLevel: GameState['raid']['dangerLevel']) {
  const dangerBonus = dangerLevel === 'High' ? 2 : dangerLevel === 'Medium' ? 1 : 0
  queue.push({ reason: 'death_recovered', minXp: 3 + dangerBonus, maxXp: 6 + dangerBonus })
}

function skillLevelUpEvent(levelUp: SkillLevelUp, tick: number, now: number, phase: GameState['raid']['phase']): LogEvent {
  return {
    id: `skill_${levelUp.skillId}_level_${levelUp.level}`,
    tick,
    timestamp: now,
    text: levelUp.text,
    phase,
  }
}

function raiderLevelUpEvent(levelUp: RaiderLevelUp, tick: number, now: number, phase: GameState['raid']['phase']): LogEvent {
  return {
    id: `raider_level_${levelUp.level}`,
    tick,
    timestamp: now,
    text: levelUp.text,
    phase,
  }
}

export function maybeAwardLootBonusConsumables(
  state: GameState,
  rng: RNG,
  now: number,
): { state: GameState; events: LogEvent[] } {
  if (state.raid.phase !== 'RAIDING') {
    return { state, events: [] }
  }

  let nextState = state
  const bonusEvents: LogEvent[] = []
  const skillModifiers = getSkillModifierProfile(state.raider.skills)
  const healingItemChance = Math.min(0.5, LOOT_BONUS_HEALING_ITEM_CHANCE + skillModifiers.lootBonusConsumableChanceBonus)
  const shieldRechargerChance = Math.min(0.5, LOOT_BONUS_SHIELD_RECHARGER_CHANCE + skillModifiers.lootBonusConsumableChanceBonus)

  if (rng.next() < healingItemChance) {
    const healingFind = resolveHealingItemFind(nextState, rng, now)
    nextState = healingFind.state
    bonusEvents.push(healingFind.event)
  }

  if (rng.next() < shieldRechargerChance) {
    const rechargerFind = resolveShieldRechargerFind(nextState, rng, now)
    nextState = rechargerFind.state
    bonusEvents.push(rechargerFind.event)
  }

  return { state: nextState, events: bonusEvents }
}

function applyHiddenPocketFailureRecovery(
  state: GameState,
  hiddenPocket: HiddenPocketItem | null,
): { state: GameState; saved: boolean; coinsGained: number; soldItemCount: number; savedItemName: string | null } {
  if (!hiddenPocket) {
    return { state, saved: false, coinsGained: 0, soldItemCount: 0, savedItemName: null }
  }

  const transfer = transferBackpackToHomeStash(state.homeStash, [
    {
      itemId: hiddenPocket.itemId,
      name: hiddenPocket.name,
      value: hiddenPocket.value,
      rarity: hiddenPocket.rarity,
      flavor: hiddenPocket.flavor,
      quantity: 1,
    },
  ])

  return {
    state: {
      ...state,
      homeStash: transfer.homeStash,
      coins: state.coins + transfer.coinsGained,
    },
    saved: true,
    coinsGained: transfer.coinsGained,
    soldItemCount: transfer.soldItemCount,
    savedItemName: hiddenPocket.name,
  }
}

export function processTick(state: GameState, rng: RNG, now: number = Date.now()): TickResult {
  const emitted: LogEvent[] = []
  const skillPracticeTriggers: SkillPracticeTrigger[] = []
  const raiderXpTriggers: RaiderXpTrigger[] = []
  const signalAdvance = advanceSignal(state.signal, now)

  // ------------------------------------------------------------------
  // 1. Run phase state machine
  // ------------------------------------------------------------------
  const { raid: nextRaid, transition } = tickPhase(state.raid, undefined, rng)
  let currentState: GameState = {
    ...state,
    raid: nextRaid,
    signal: signalAdvance.signal,
    signalAmplifiers: state.signalAmplifiers + signalAdvance.amplifiersGained,
  }

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
        queueDeathRecoveryRaiderXp(raiderXpTriggers, state.raid.dangerLevel)
        const recovery = applyHiddenPocketFailureRecovery(currentState, state.raid.hiddenPocket)
        currentState = {
          ...recovery.state,
          raider: {
            ...recovery.state.raider,
            hp: recovery.state.raider.maxHp,
            mood: 0,
            deathCount: recovery.state.raider.deathCount + 1,
          },
          stats: recordOutcome(currentState.stats, 'deaths', state.raid.zone, state.raid.dangerLevel),
        }
        if (recovery.saved && recovery.savedItemName) {
          skillPracticeTriggers.push({ skillId: 'hiding_in_lockers', reason: 'hidden_pocket_saved', minXp: 2, maxXp: 4 })
          raiderXpTriggers.push({ reason: 'hidden_pocket_saved', minXp: 3, maxXp: 6 })
          emitted.push(hiddenPocketSavedEvent(recovery.savedItemName, state.tick, now))
        }
        if (recovery.soldItemCount > 0) {
          skillPracticeTriggers.push({ skillId: 'hoarding', reason: 'stash_overflow_sale', minXp: 2, maxXp: 4 })
          raiderXpTriggers.push({ reason: 'stash_overflow_sale', minXp: 2, maxXp: 4 })
          emitted.push(stashSaleEvent(recovery.soldItemCount, recovery.coinsGained, state.tick, now))
        }
      } else if (transition.from === 'EXTRACTING') {
        queueSuccessfulExtractionSkillPractice(skillPracticeTriggers, {
          backpack: state.raid.backpack,
          backpackValue: state.raid.backpackValue,
          dangerLevel: state.raid.dangerLevel,
          hp: state.raider.hp,
          maxHp: state.raider.maxHp,
        })
        queueSuccessfulExtractionRaiderXp(raiderXpTriggers, {
          backpack: state.raid.backpack,
          backpackValue: state.raid.backpackValue,
          dangerLevel: state.raid.dangerLevel,
          hp: state.raider.hp,
          maxHp: state.raider.maxHp,
        })
        const extraction = applySuccessfulExtraction(currentState, state.raid.backpack, {
          zone: state.raid.zone,
          dangerLevel: state.raid.dangerLevel,
        })
        currentState = extraction.state
        if (extraction.levelCoinBonus > 0) {
          emitted.push(raiderLevelExtractionBonusEvent(extraction.levelCoinBonus, state.tick, now))
        }
        if (extraction.soldItemCount > 0) {
          skillPracticeTriggers.push({ skillId: 'hoarding', reason: 'stash_overflow_sale', minXp: 2, maxXp: 4 })
          raiderXpTriggers.push({ reason: 'stash_overflow_sale', minXp: 2, maxXp: 4 })
          emitted.push(stashSaleEvent(extraction.soldItemCount, extraction.coinsGained, state.tick, now))
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // 2. Greed Check (RAIDING phase only, once per tick)
  // ------------------------------------------------------------------
  if (currentState.raid.phase === 'RAIDING') {
    const shieldRechargeBefore = currentState.raid.activeShieldRecharge
    const shieldRechargeResult = advanceShieldRecharge(currentState.raid)
    currentState = { ...currentState, raid: shieldRechargeResult.raid }
    if (shieldRechargeResult.completed && shieldRechargeResult.chargeApplied > 0) {
      emitted.push({
        id: `shield_recharger_${shieldRechargeBefore?.itemId ?? 'completed'}_completed`,
        tick: state.tick,
        timestamp: now,
        text: `Shield recharge completed. ${shieldRechargeBefore?.name ?? 'The shield recharger'} finished its ${shieldRechargeBefore?.totalTicks ?? 5}-tick crawl.`,
        phase: currentState.raid.phase,
      })
    }

    const raidForGreedCheck = currentState.pendingCalm
      ? {
          ...currentState.raid,
          greedLevel: applyCalmGreedReduction(currentState.raid.greedLevel),
        }
      : currentState.pendingPressure
        ? {
            ...currentState.raid,
            greedLevel: applyPressureGreedIncrease(currentState.raid.greedLevel),
          }
        : currentState.raid

    const greedResult = runGreedCheck(
      raidForGreedCheck,
      rng,
      {
        calmed: currentState.pendingCalm,
        pressured: currentState.pendingPressure,
        currentHp: currentState.raider.hp,
        maxHp: currentState.raider.maxHp,
        hasHealingItems: currentState.raid.healingItems.length > 0,
        extractionChanceBonus: getSkillModifierProfile(currentState.raider.skills).extractionChanceBonus,
        deathChanceMultiplier: getSkillModifierProfile(currentState.raider.skills).ambientRaidDeathChanceMultiplier,
      },
    )

    // Update greed level
    currentState = {
      ...currentState,
      raid: { ...raidForGreedCheck, greedLevel: greedResult.newGreedLevel },
    }

    if (greedResult.outcome === 'EXTRACT') {
      skillPracticeTriggers.push({ skillId: 'cardio', reason: 'extraction_started', minXp: 1, maxXp: 2 })
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
  const resolvedEvent = resolveEvent(currentState, rng, now)
  if (resolvedEvent) {
    const template = allEvents.find(e => e.id === resolvedEvent.id)
    if (template) {
      let event = resolvedEvent
      const backpackQuantityBeforeEffects = totalBackpackQuantity(currentState.raid.backpack)
      const effectResult = applyEffects(currentState, template, rng)
      currentState = effectResult.state

      if (effectResult.effectLogText) {
        event = {
          ...event,
          text: `${event.text} ${effectResult.effectLogText}`,
        }
      }

      if (
        effectResult.shieldDamage &&
        (
          effectResult.shieldDamage.hpDamage > 0 ||
          effectResult.shieldDamage.shieldChargeLost > 0 ||
          effectResult.shieldDamage.shieldDurabilityLost > 0
        )
      ) {
        event = {
          ...event,
          text: `${event.text} ${describeShieldDamage(effectResult.shieldDamage)}`,
        }
      }

      emitted.push(event)

      const backpackQuantityAfterEffects = totalBackpackQuantity(currentState.raid.backpack)
      if (backpackQuantityAfterEffects > backpackQuantityBeforeEffects) {
        skillPracticeTriggers.push({ skillId: 'hoarding', reason: 'loot_added', minXp: 1, maxXp: 2 })
        raiderXpTriggers.push({ reason: 'loot_found', minXp: 1, maxXp: 2 })
        const bonusLoot = maybeAwardLootBonusConsumables(currentState, rng, now)
        currentState = bonusLoot.state
        emitted.push(...bonusLoot.events)
      }

      if (template.effects?.healingItem) {
        const healingFind = resolveHealingItemFind(currentState, rng, now)
        currentState = healingFind.state
        emitted.push(healingFind.event)
      }

      if (template.effects?.shieldRecharger) {
        const rechargerFind = resolveShieldRechargerFind(currentState, rng, now)
        currentState = rechargerFind.state
        emitted.push(rechargerFind.event)
      }

      const robotId = template.effects?.robotEncounter
      if (robotId) {
        const robotResult = resolveRobotEncounter(currentState, robotId, rng, now, {
          damageMultiplier: template.effects?.robotDamageMultiplier,
        })
        if (robotResult) {
          currentState = robotResult.state
          if (robotResult.event.id.endsWith('_defeated')) {
            currentState = {
              ...currentState,
              stats: recordRobotDefeat(currentState.stats, robotId),
            }
            raiderXpTriggers.push({ reason: 'robot_defeated', minXp: 4, maxXp: 7 })
          } else if (robotResult.event.id.endsWith('_escaped') && currentState.raider.hp > 0) {
            skillPracticeTriggers.push({ skillId: 'hiding_in_lockers', reason: 'robot_survived', minXp: 1, maxXp: 3 })
            raiderXpTriggers.push({ reason: 'robot_survived', minXp: 2, maxXp: 4 })
          }
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
        const backpackValueBeforeForce = currentState.raid.backpackValue
        const zoneBeforeForce = currentState.raid.zone
        const dangerLevelBeforeForce = currentState.raid.dangerLevel
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
          queueSuccessfulExtractionSkillPractice(skillPracticeTriggers, {
            backpack: backpackBeforeForce,
            backpackValue: backpackValueBeforeForce,
            dangerLevel: dangerLevelBeforeForce,
            hp: currentState.raider.hp,
            maxHp: currentState.raider.maxHp,
          })
          queueSuccessfulExtractionRaiderXp(raiderXpTriggers, {
            backpack: backpackBeforeForce,
            backpackValue: backpackValueBeforeForce,
            dangerLevel: dangerLevelBeforeForce,
            hp: currentState.raider.hp,
            maxHp: currentState.raider.maxHp,
          })
          const extraction = applySuccessfulExtraction(currentState, backpackBeforeForce, {
            zone: zoneBeforeForce,
            dangerLevel: dangerLevelBeforeForce,
          })
          currentState = extraction.state
          if (extraction.levelCoinBonus > 0) {
            emitted.push(raiderLevelExtractionBonusEvent(extraction.levelCoinBonus, state.tick, now))
          }
          if (extraction.soldItemCount > 0) {
            skillPracticeTriggers.push({ skillId: 'hoarding', reason: 'stash_overflow_sale', minXp: 2, maxXp: 4 })
            raiderXpTriggers.push({ reason: 'stash_overflow_sale', minXp: 2, maxXp: 4 })
            emitted.push(stashSaleEvent(extraction.soldItemCount, extraction.coinsGained, state.tick, now))
          }
        } else if (fromPhase === 'EXTRACTING' && forcedPhase === 'RAIDING') {
          skillPracticeTriggers.push({ skillId: 'hiding_in_lockers', reason: 'failed_extraction', minXp: 1, maxXp: 3 })
          raiderXpTriggers.push({ reason: 'failed_extraction', minXp: 2, maxXp: 4 })
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
  if (currentState.pendingCalm) {
    emitted.push({
      id: 'handler_calm',
      tick: state.tick,
      timestamp: now,
      text: resolveFlavorKey('calm_responses', rng),
      phase: currentState.raid.phase,
    })
  }
  if (currentState.pendingPressure) {
    emitted.push({
      id: 'handler_pressure',
      tick: state.tick,
      timestamp: now,
      text: resolveFlavorKey('pressure_responses', rng),
      phase: currentState.raid.phase,
    })
  }

  currentState = {
    ...currentState,
    pendingCalm: false,
    pendingPressure: false,
    raid: { ...currentState.raid, forceExtract: false },
  }

  if (skillPracticeTriggers.length > 0) {
    const skillGains = rollSkillPractice(skillPracticeTriggers, rng)
    const skillResult = applySkillPractice(currentState.raider.skills, skillGains)
    currentState = {
      ...currentState,
      raider: {
        ...currentState.raider,
        skills: skillResult.skills,
      },
    }
    for (const levelUp of skillResult.levelUps) {
      raiderXpTriggers.push({ reason: 'skill_level_up', minXp: 5 + levelUp.level, maxXp: 7 + levelUp.level * 2 })
    }
    emitted.push(...skillResult.levelUps.map(levelUp => skillLevelUpEvent(levelUp, state.tick, now, currentState.raid.phase)))
  }

  if (raiderXpTriggers.length > 0) {
    const xpGains = rollRaiderXp(raiderXpTriggers, rng.clone())
    const xpResult = applyRaiderXpGain(currentState.raider.levelXp, xpGains)
    currentState = {
      ...currentState,
      raider: {
        ...currentState.raider,
        levelXp: xpResult.levelXp,
      },
    }
    emitted.push(...xpResult.levelUps.map(levelUp => raiderLevelUpEvent(levelUp, state.tick, now, currentState.raid.phase)))
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
