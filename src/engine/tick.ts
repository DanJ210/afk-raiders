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
 *   4. Apply event effects. If HP hits 0, start the DOWNED condition; unresolved
 *      DOWNED recovery moves through KNOCKED_OUT before returning home.
 *   5. Consume pending Handler actions (calm / pressure).
 *   6. Increment tick counter, append events to log.
 */

import type { BackpackItem, GameState, HiddenPocketItem, LogCondition, LogEvent, TickResult } from './types.js'
import type { RNG } from './rng.js'
import { DOWNED_TICKS, EXTRACTING_TICKS, tickPhase, transitionText, type PhaseTransition } from './raidStateMachine.js'
import { runGreedCheck } from './greedCheck.js'
import { advanceSignal, applyCalmGreedReduction, applyPressureGreedIncrease } from './signal.js'
import { describeShieldDamage, resolveEvent, resolveFlavorKey, applyEffects, resolveHealingItemFind, resolveRobotEncounter, resolveShieldRechargerFind, events as allEvents } from './eventResolver.js'
import { transferBackpackToHomeStash, HOME_STASH_ITEM_LIMIT } from './homeStash.js'
import { appendLogEntries, logConditionsForRaid } from './log.js'
import { recordOutcome, recordRobotDefeat } from './stats.js'
import { advanceShieldRecharge } from './shields.js'
import { applySkillPractice, getSkillModifierProfile, rollSkillPractice, type SkillLevelUp, type SkillPracticeTrigger } from './skills.js'
import { applyRaiderXpGain, getRaiderLevelBenefitProfile, rollRaiderXp, type RaiderLevelUp, type RaiderXpTrigger } from './raiderLevel.js'

const LOOT_BONUS_HEALING_ITEM_CHANCE = 0.2 // 20% chance to find a healing item on any loot event, independent of normal loot rolls
const LOOT_BONUS_SHIELD_RECHARGER_CHANCE = 0.15 // 15% chance to find a shield recharger on any loot event, independent of normal loot rolls
const NEUTRAL_MOOD_THRESHOLD = 0 // Mood above this is positive, below is negative; separate from the "mood" number which can go up to +5 or down to -5

function enforceIncapacitatedHp(state: GameState): GameState {
  if ((!state.raid.downed && state.raid.phase !== 'KNOCKED_OUT') || state.raider.hp === 0) return state
  return {
    ...state,
    raider: {
      ...state.raider,
      hp: 0,
    },
  }
}

function phaseTransitionEvent(transition: PhaseTransition, tick: number, now: number, text = transition.eventText): LogEvent {
  return {
    id: `phase_${transition.from}_to_${transition.to}`,
    tick,
    timestamp: now,
    text,
    phase: transition.to,
  }
}

function conditionEvent(id: string, text: string, tick: number, now: number, conditions: LogCondition[]): LogEvent {
  return {
    id,
    tick,
    timestamp: now,
    text,
    phase: 'RAIDING',
    conditions,
  }
}

function startExtractionCondition(state: GameState, tick: number, now: number): { state: GameState; event: LogEvent | null } {
  if (state.raid.phase !== 'RAIDING' || state.raid.extracting) return { state, event: null }

  const raid = {
    ...state.raid,
    activeShieldRecharge: null,
    extracting: { ticksRemaining: EXTRACTING_TICKS },
    forceExtract: false,
  }

  return {
    state: {
      ...state,
      raid,
    },
    event: conditionEvent('condition_extracting_started', transitionText('RAIDING_to_EXTRACTING'), tick, now, logConditionsForRaid(raid) ?? ['EXTRACTING']),
  }
}

function failExtractionCondition(state: GameState, tick: number, now: number): { state: GameState; event: LogEvent | null } {
  if (state.raid.phase !== 'RAIDING' || !state.raid.extracting) return { state, event: null }

  const conditions = logConditionsForRaid(state.raid) ?? ['EXTRACTING']

  return {
    state: {
      ...state,
      raid: {
        ...state.raid,
        extracting: null,
        forceExtract: false,
      },
    },
    event: conditionEvent('condition_extraction_failed', transitionText('EXTRACTING_to_RAIDING'), tick, now, conditions),
  }
}

function startDownedCondition(state: GameState, tick: number, now: number, text = transitionText('RAIDING_to_DOWNED')): { state: GameState; event: LogEvent | null } {
  if (state.raid.phase !== 'RAIDING' || state.raid.downed) return { state: enforceIncapacitatedHp(state), event: null }

  const nextState = enforceIncapacitatedHp({
    ...state,
    raid: {
      ...state.raid,
      activeShieldRecharge: null,
      downed: { ticksRemaining: DOWNED_TICKS },
    },
  })

  return {
    state: nextState,
    event: conditionEvent('condition_downed_started', text, tick, now, logConditionsForRaid(nextState.raid) ?? ['DOWNED']),
  }
}

function advanceRaidConditions(state: GameState): { state: GameState; extractionCompleted: boolean; downedExpired: boolean } {
  if (state.raid.phase !== 'RAIDING') {
    return { state, extractionCompleted: false, downedExpired: false }
  }

  const extracting = state.raid.extracting
    ? { ticksRemaining: state.raid.extracting.ticksRemaining - 1 }
    : null
  const downed = state.raid.downed
    ? { ticksRemaining: state.raid.downed.ticksRemaining - 1 }
    : null
  const extractionCompleted = extracting !== null && extracting.ticksRemaining <= 0
  const downedExpired = downed !== null && downed.ticksRemaining <= 0

  return {
    state: {
      ...state,
      raid: {
        ...state.raid,
        extracting: extractionCompleted ? null : extracting,
        downed: downedExpired ? null : downed,
      },
    },
    extractionCompleted,
    downedExpired,
  }
}

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
    text: `Home stash hit ${HOME_STASH_ITEM_LIMIT} items. Auto-sold the ${sold} cheapest item${sold === 1 ? '' : 's'} for ${coins} coin${coins === 1 ? '' : 's'}. The Desperanza Pawn Desk didn't even haggle.`,
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

function completeExtractionCondition(
  state: GameState,
  skillPracticeTriggers: SkillPracticeTrigger[],
  raiderXpTriggers: RaiderXpTrigger[],
  emitted: LogEvent[],
  tick: number,
  now: number,
): GameState {
  const extractedRaid = state.raid
  const { raid: hubRaid, transition } = tickPhase(state.raid, 'HUB')
  let currentState: GameState = { ...state, raid: hubRaid }

  if (transition) {
    emitted.push(phaseTransitionEvent(transition, tick, now))
  }

  queueSuccessfulExtractionSkillPractice(skillPracticeTriggers, {
    backpack: extractedRaid.backpack,
    backpackValue: extractedRaid.backpackValue,
    dangerLevel: extractedRaid.dangerLevel,
    hp: state.raider.hp,
    maxHp: state.raider.maxHp,
  })
  queueSuccessfulExtractionRaiderXp(raiderXpTriggers, {
    backpack: extractedRaid.backpack,
    backpackValue: extractedRaid.backpackValue,
    dangerLevel: extractedRaid.dangerLevel,
    hp: state.raider.hp,
    maxHp: state.raider.maxHp,
  })

  const extraction = applySuccessfulExtraction(currentState, extractedRaid.backpack, {
    zone: extractedRaid.zone,
    dangerLevel: extractedRaid.dangerLevel,
  })
  currentState = extraction.state
  if (extraction.levelCoinBonus > 0) {
    emitted.push(raiderLevelExtractionBonusEvent(extraction.levelCoinBonus, tick, now))
  }
  if (extraction.soldItemCount > 0) {
    skillPracticeTriggers.push({ skillId: 'hoarding', reason: 'stash_overflow_sale', minXp: 2, maxXp: 4 })
    raiderXpTriggers.push({ reason: 'stash_overflow_sale', minXp: 2, maxXp: 4 })
    emitted.push(stashSaleEvent(extraction.soldItemCount, extraction.coinsGained, tick, now))
  }

  return currentState
}

function enterKnockedOutRecovery(state: GameState, emitted: LogEvent[], tick: number, now: number): GameState {
  const { raid: knockedOutRaid, transition } = tickPhase(state.raid, 'KNOCKED_OUT')
  const currentState = enforceIncapacitatedHp({ ...state, raid: knockedOutRaid })
  if (transition) {
    emitted.push(phaseTransitionEvent(transition, tick, now))
  }
  return currentState
}

function skillLevelUpEvent(levelUp: SkillLevelUp, tick: number, now: number, phase: GameState['raid']['phase'], conditions?: LogCondition[]): LogEvent {
  return {
    id: `skill_${levelUp.skillId}_level_${levelUp.level}`,
    tick,
    timestamp: now,
    text: levelUp.text,
    phase,
    conditions,
  }
}

function raiderLevelUpEvent(levelUp: RaiderLevelUp, tick: number, now: number, phase: GameState['raid']['phase'], conditions?: LogCondition[]): LogEvent {
  return {
    id: `raider_level_${levelUp.level}`,
    tick,
    timestamp: now,
    text: levelUp.text,
    phase,
    conditions,
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
  currentState = enforceIncapacitatedHp(currentState)

  if (transition) {
    emitted.push(phaseTransitionEvent(transition, state.tick, now))

    // KNOCKED_OUT -> HUB performs failed-raid bookkeeping. tickPhase has
    // already cleared the raid snapshot, so read loss context from input state.
    if (transition.to === 'HUB' && transition.from === 'KNOCKED_OUT') {
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
    }
  }

  const conditionAdvance = advanceRaidConditions(currentState)
  currentState = conditionAdvance.state
  if (conditionAdvance.extractionCompleted) {
    currentState = completeExtractionCondition(currentState, skillPracticeTriggers, raiderXpTriggers, emitted, state.tick, now)
  } else if (conditionAdvance.downedExpired) {
    currentState = enterKnockedOutRecovery(currentState, emitted, state.tick, now)
  }

  if (
    currentState.raider.hp <= 0 &&
    currentState.raid.phase === 'RAIDING' &&
    !currentState.raid.downed
  ) {
    const downed = startDownedCondition(currentState, state.tick, now)
    currentState = downed.state
    if (downed.event) {
      emitted.push(downed.event)
    }
  }

  // ------------------------------------------------------------------
  // 2. Greed Check (RAIDING phase only, once per tick)
  // ------------------------------------------------------------------
  let startedExtractionThisTick = false
  if (currentState.raid.phase === 'RAIDING' && !currentState.raid.extracting && !currentState.raid.downed) {
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
        conditions: logConditionsForRaid(currentState.raid),
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
        currentHp: currentState.raider.hp,
        maxHp: currentState.raider.maxHp,
        hasHealingItems: currentState.raid.healingItems.some(item => item.healAmount > 0),
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
      const started = startExtractionCondition(currentState, state.tick, now)
      currentState = started.state
      startedExtractionThisTick = started.event !== null
      if (started.event) {
        emitted.push(started.event)
      }
    } else if (greedResult.outcome === 'DOWNED') {
      const downed = startDownedCondition(currentState, state.tick, now)
      currentState = downed.state
      if (downed.event) {
        emitted.push(downed.event)
      }
    }
    // PUSH_DEEPER -> stay in RAIDING (greedLevel already updated above)
  }

  if (
    currentState.raid.phase === 'RAIDING' &&
    currentState.raid.phaseTicksRemaining <= 0 &&
    !currentState.raid.downed &&
    !startedExtractionThisTick
  ) {
    const downed = startDownedCondition(
      currentState,
      state.tick,
      now,
      'Raid timer hit zero. Zone nuke confirmed. Raider is down but the extraction clock may still matter.',
    )
    currentState = downed.state
    if (downed.event) {
      emitted.push(downed.event)
    }
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

      if (template.effects?.startDowned) {
        const downed = startDownedCondition(currentState, state.tick, now, transitionText('EXTRACTING_to_DOWNED'))
        currentState = downed.state
        if (downed.event) {
          emitted.push(downed.event)
        }
      }

      if (template.effects?.failExtraction) {
        const failed = failExtractionCondition(currentState, state.tick, now)
        currentState = failed.state
        if (failed.event) {
          skillPracticeTriggers.push({ skillId: 'hiding_in_lockers', reason: 'failed_extraction', minXp: 1, maxXp: 3 })
          raiderXpTriggers.push({ reason: 'failed_extraction', minXp: 2, maxXp: 4 })
          emitted.push(failed.event)
        }
      }

      if (template.effects?.completeExtraction) {
        currentState = completeExtractionCondition(currentState, skillPracticeTriggers, raiderXpTriggers, emitted, state.tick, now)
      }
    }
  }

  // ------------------------------------------------------------------
  // 3b. Downed check — if HP ever reaches 0 during RAIDING, the raider
  //     becomes DOWNED as a condition. Extraction can still win the race.
  // ------------------------------------------------------------------
  if (
    currentState.raider.hp <= 0 &&
    currentState.raid.phase === 'RAIDING' &&
    !currentState.raid.downed
  ) {
    const downed = startDownedCondition(currentState, state.tick, now)
    currentState = downed.state
    if (downed.event) {
      emitted.push(downed.event)
    }
  }

  currentState = enforceIncapacitatedHp(currentState)

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
      conditions: logConditionsForRaid(currentState.raid),
    })
  }
  if (currentState.pendingPressure) {
    emitted.push({
      id: 'handler_pressure',
      tick: state.tick,
      timestamp: now,
      text: resolveFlavorKey('pressure_responses', rng),
      phase: currentState.raid.phase,
      conditions: logConditionsForRaid(currentState.raid),
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
    const conditions = logConditionsForRaid(currentState.raid)
    emitted.push(...skillResult.levelUps.map(levelUp => skillLevelUpEvent(levelUp, state.tick, now, currentState.raid.phase, conditions)))
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
    const conditions = logConditionsForRaid(currentState.raid)
    emitted.push(...xpResult.levelUps.map(levelUp => raiderLevelUpEvent(levelUp, state.tick, now, currentState.raid.phase, conditions)))
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
