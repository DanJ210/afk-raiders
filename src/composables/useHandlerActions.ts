/**
 * useHandlerActions — signal-gated player actions (Calm, Pressure, Ready Up, etc.).
 *
 * Responsibilities:
 * - Signal validation and spending for each action
 * - Phase-gating for action legality
 * - State mutations and persistence for each action
 * - Special-case logic (readyUp initiates phase change, etc.)
 */

import type { GameState, LogEvent } from '../engine/types.js'
import type { RNG } from '../engine/rng.js'
import { advanceSignal, refillSignalWithAmplifier, spendSignal, SIGNAL_CAP } from '../engine/signal.js'
import { tickPhase } from '../engine/raidStateMachine.js'
import { sellItemFromHomeStash } from '../engine/homeStash.js'
import { consumeHealingItem, consumeShieldRecharger } from '../engine/eventResolver.js'
import { appendActivityLogEntries, appendLogEntries } from '../engine/log.js'
import { recordHealingItemUse } from '../engine/stats.js'
import { createInitialState } from '../engine/initialState.js'
import { applyRaiderXpGain, rollRaiderXp, type RaiderLevelUp } from '../engine/raiderLevel.js'
import { applySkillPractice, rollSkillPractice, type SkillLevelUp } from '../engine/skills.js'
import type { BackpackItem } from '../engine/types.js'

const RAIDER_NAME_MAX_LENGTH = 25
const REVIVE_HP_RESTORE = 25

export interface HandlerActionsReturn {
  calm: () => void
  pressure: () => void
  applySignalAmplifier: () => void
  readyUp: () => void
  callExtract: () => void
  revive: () => void
  applyHealingItem: (itemId: string) => void
  applyShieldRecharger: (itemId: string) => void
  setHiddenPocketItem: (itemId: string) => void
  clearHiddenPocketItem: () => void
  sellHomeStashItem: (itemId: string, quantity?: number) => void
  resetSave: () => void
  dismissAwaySummary: () => void
  renameRaider: (newName: string) => void
  RAIDER_NAME_MAX_LENGTH: number
}

function toHiddenPocketItem(item: BackpackItem) {
  return {
    itemId: item.itemId,
    name: item.name,
    value: item.value,
    rarity: item.rarity,
    flavor: item.flavor,
    quantity: item.quantity,
    kind: item.kind
  }
}

function skillLevelUpEvent(levelUp: SkillLevelUp, tick: number, now: number, phase: GameState['raid']['phase']) {
  return {
    id: `skill_${levelUp.skillId}_level_${levelUp.level}`,
    tick,
    timestamp: now,
    text: levelUp.text,
    phase,
  }
}

function raiderLevelUpEvent(levelUp: RaiderLevelUp, tick: number, now: number, phase: GameState['raid']['phase']) {
  return {
    id: `raider_level_${levelUp.level}`,
    tick,
    timestamp: now,
    text: levelUp.text,
    phase,
  }
}

/**
 * Expose signal-gated Handler actions: calm, pressure, readyUp, callExtract, etc.
 * State mutations are applied directly to stateRef; side effects call the persistence callback.
 */
export function useHandlerActions(
  stateRef: { value: GameState },
  rngRef: { current: RNG },
  lastTickAtRef: { value: number },
  hasPendingHandlerAction: () => boolean,
  persistCallback: (state: GameState, seed: number, lastTickAt: number) => void,
  onResetSave: (newState: GameState, seed: number, lastTickAt: number) => void,
  onAwaySummaryDismiss: () => void,
  publishEvents?: (events: LogEvent[]) => void,
): HandlerActionsReturn {
  function awardSignalUseSkill(now: number, signalSpent: number): LogEvent[] {
    const minXp = Math.max(1, signalSpent)
    const maxXp = minXp + 1
    const gains = rollSkillPractice([
      { skillId: 'signal_handling', reason: 'signal_used', minXp, maxXp },
    ], rngRef.current)
    const skillResult = applySkillPractice(stateRef.value.raider.skills, gains)
    let nextLog = stateRef.value.log
    const awardedEvents: LogEvent[] = []

    if (skillResult.levelUps.length > 0) {
      const skillEvents = skillResult.levelUps.map(levelUp => skillLevelUpEvent(levelUp, stateRef.value.tick, now, stateRef.value.raid.phase))
      awardedEvents.push(...skillEvents)
      nextLog = appendLogEntries(nextLog, skillEvents)
    }

    let levelXp = stateRef.value.raider.levelXp
    const raiderLevelGains = skillResult.levelUps.length > 0
      ? rollRaiderXp(
          skillResult.levelUps.map(levelUp => ({ reason: 'skill_level_up', minXp: 5 + levelUp.level, maxXp: 7 + levelUp.level * 2 })),
          rngRef.current.clone(),
        )
      : []
    if (raiderLevelGains.length > 0) {
      const xpResult = applyRaiderXpGain(levelXp, raiderLevelGains)
      levelXp = xpResult.levelXp
      if (xpResult.levelUps.length > 0) {
        const raiderLevelEvents = xpResult.levelUps.map(levelUp => raiderLevelUpEvent(levelUp, stateRef.value.tick, now, stateRef.value.raid.phase))
        awardedEvents.push(...raiderLevelEvents)
        nextLog = appendLogEntries(nextLog, raiderLevelEvents)
      }
    }

    stateRef.value = {
      ...stateRef.value,
      raider: {
        ...stateRef.value.raider,
        skills: skillResult.skills,
        levelXp,
      },
      log: nextLog,
    }

    return awardedEvents
  }

  function syncSignalProgress(now: number) {
    const advancement = advanceSignal(stateRef.value.signal, now)
    if (advancement.signal !== stateRef.value.signal || advancement.amplifiersGained > 0) {
      stateRef.value = {
        ...stateRef.value,
        signal: advancement.signal,
        signalAmplifiers: stateRef.value.signalAmplifiers + advancement.amplifiersGained,
      }
    }
    return advancement.signal
  }

  function calm() {
    if (stateRef.value.raid.phase !== 'RAIDING') return
    if (stateRef.value.raid.extracting || stateRef.value.raid.downed) return
    if (hasPendingHandlerAction()) return
    const actionNow = Date.now()
    const updated = spendSignal(syncSignalProgress(actionNow), 'CALM')
    if (!updated) return
    stateRef.value = {
      ...stateRef.value,
      signal: updated,
      pendingCalm: true,
    }
    awardSignalUseSkill(actionNow, 1)
    persistCallback(stateRef.value, rngRef.current.getSeed(), lastTickAtRef.value)
  }

  function pressure() {
    if (stateRef.value.raid.phase !== 'RAIDING') return
    if (stateRef.value.raid.extracting || stateRef.value.raid.downed) return
    if (hasPendingHandlerAction()) return
    const actionNow = Date.now()
    const updated = spendSignal(syncSignalProgress(actionNow), 'PRESSURE')
    if (!updated) return
    stateRef.value = {
      ...stateRef.value,
      signal: updated,
      pendingPressure: true,
    }
    awardSignalUseSkill(actionNow, 1)
    persistCallback(stateRef.value, rngRef.current.getSeed(), lastTickAtRef.value)
  }

  function readyUp() {
    if (stateRef.value.raid.phase !== 'HUB') return
    const actionNow = Date.now()
    const updated = spendSignal(syncSignalProgress(actionNow), 'READY_UP')
    if (!updated) return

    const { raid: deployingRaid, transition } = tickPhase(stateRef.value.raid, 'DEPLOYING', rngRef.current)
    if (!transition) return

    const transitionEvent = {
      id: `phase_${transition.from}_to_${transition.to}`,
      tick: stateRef.value.tick,
      timestamp: actionNow,
      text: transition.eventText,
      phase: transition.to,
    }

    stateRef.value = {
      ...stateRef.value,
      signal: updated,
      raid: deployingRaid,
      log: appendLogEntries(
        stateRef.value.log,
        [transitionEvent],
      ),
    }
    const signalUseEvents = awardSignalUseSkill(actionNow, 2)
    publishEvents?.([transitionEvent, ...signalUseEvents])
    persistCallback(stateRef.value, rngRef.current.getSeed(), lastTickAtRef.value)
  }

  function callExtract() {
    if (stateRef.value.raid.phase !== 'RAIDING') return
    if (stateRef.value.raid.extracting || stateRef.value.raid.downed) return
    if (hasPendingHandlerAction()) return
    const actionNow = Date.now()
    const updated = spendSignal(syncSignalProgress(actionNow), 'CALL_EXTRACT')
    if (!updated) return
    stateRef.value = {
      ...stateRef.value,
      signal: updated,
      raid: { ...stateRef.value.raid, forceExtract: true },
    }
    awardSignalUseSkill(actionNow, 3)
    persistCallback(stateRef.value, rngRef.current.getSeed(), lastTickAtRef.value)
  }

  function revive() {
    if (stateRef.value.raid.phase !== 'RAIDING') return
    if (!stateRef.value.raid.downed) return
    const actionNow = Date.now()
    const updated = spendSignal(syncSignalProgress(actionNow), 'REVIVE')
    if (!updated) return

    const reviveEvent: LogEvent = {
      id: 'handler_revive_used',
      tick: stateRef.value.tick,
      timestamp: actionNow,
      text: 'Revive signal punched through. Raider is upright, offended, and technically alive.',
      phase: stateRef.value.raid.phase,
    }

    stateRef.value = {
      ...stateRef.value,
      signal: updated,
      raider: {
        ...stateRef.value.raider,
        hp: Math.min(stateRef.value.raider.maxHp, REVIVE_HP_RESTORE),
      },
      raid: {
        ...stateRef.value.raid,
        downed: null,
      },
      log: appendLogEntries(stateRef.value.log, [reviveEvent]),
    }
    const signalUseEvents = awardSignalUseSkill(actionNow, 5)
    publishEvents?.([reviveEvent, ...signalUseEvents])
    persistCallback(stateRef.value, rngRef.current.getSeed(), lastTickAtRef.value)
  }

  function applySignalAmplifier() {
    const actionNow = Date.now()
    const currentSignal = syncSignalProgress(actionNow)
    if (currentSignal.current >= SIGNAL_CAP) return
    if (stateRef.value.signalAmplifiers <= 0) return

    const refilled = refillSignalWithAmplifier(currentSignal, actionNow)
    if (!refilled) return

    stateRef.value = {
      ...stateRef.value,
      signal: refilled,
      signalAmplifiers: stateRef.value.signalAmplifiers - 1,
    }
    persistCallback(stateRef.value, rngRef.current.getSeed(), lastTickAtRef.value)
  }

  function applyHealingItem(itemId: string) {
    const actionNow = Date.now()
    const healingUse = consumeHealingItem(stateRef.value, itemId, actionNow)
    if (!healingUse) return

    const log = appendLogEntries(stateRef.value.log, [healingUse.event])
    stateRef.value = {
      ...healingUse.state,
      stats: recordHealingItemUse(healingUse.state.stats, itemId),
      log,
    }
    publishEvents?.([healingUse.event])
    persistCallback(stateRef.value, rngRef.current.getSeed(), lastTickAtRef.value)
  }

  function applyShieldRecharger(itemId: string) {
    const actionNow = Date.now()
    const rechargeUse = consumeShieldRecharger(stateRef.value, itemId, actionNow)
    if (!rechargeUse) return

    const log = appendLogEntries(stateRef.value.log, [rechargeUse.event])
    const activityLog = rechargeUse.activityEvent
      ? appendActivityLogEntries(stateRef.value.activityLog, [rechargeUse.activityEvent])
      : stateRef.value.activityLog
    stateRef.value = {
      ...rechargeUse.state,
      log,
      activityLog,
    }
    publishEvents?.([rechargeUse.event])
    persistCallback(stateRef.value, rngRef.current.getSeed(), lastTickAtRef.value)
  }

  function setHiddenPocketItem(itemId: string) {
    if (stateRef.value.raid.phase === 'HUB' || stateRef.value.raid.phase === 'KNOCKED_OUT' || stateRef.value.raid.downed) return
    const sourceItem = stateRef.value.raid.backpack.find(item => item.itemId === itemId)
    if (!sourceItem || sourceItem.quantity <= 0) return

    stateRef.value = {
      ...stateRef.value,
      raid: {
        ...stateRef.value.raid,
        hiddenPocket: toHiddenPocketItem(sourceItem),
      },
    }
    persistCallback(stateRef.value, rngRef.current.getSeed(), lastTickAtRef.value)
  }

  function clearHiddenPocketItem() {
    if (stateRef.value.raid.hiddenPocket === null) return
    stateRef.value = {
      ...stateRef.value,
      raid: {
        ...stateRef.value.raid,
        hiddenPocket: null,
      },
    }
    persistCallback(stateRef.value, rngRef.current.getSeed(), lastTickAtRef.value)
  }

  function resetSave() {
    const freshNow = Date.now()
    const newSeed = freshNow & 0xffffffff
    const freshState = createInitialState(freshNow)
    onResetSave(freshState, newSeed, freshNow)
  }

  function dismissAwaySummary() {
    onAwaySummaryDismiss()
  }

  function sellHomeStashItem(itemId: string, quantity?: number) {
    const sale = sellItemFromHomeStash(stateRef.value.homeStash, itemId, quantity)
    if (sale.soldItemCount === 0) return

    stateRef.value = {
      ...stateRef.value,
      homeStash: sale.homeStash,
      coins: stateRef.value.coins + sale.coinsGained,
    }
    persistCallback(stateRef.value, rngRef.current.getSeed(), lastTickAtRef.value)
  }

  function renameRaider(newName: string) {
    const trimmed = newName.trim().slice(0, RAIDER_NAME_MAX_LENGTH)
    if (!trimmed) return
    stateRef.value = {
      ...stateRef.value,
      raider: { ...stateRef.value.raider, name: trimmed },
    }
    persistCallback(stateRef.value, rngRef.current.getSeed(), lastTickAtRef.value)
  }

  return {
    calm,
    pressure,
    applySignalAmplifier,
    readyUp,
    callExtract,
    revive,
    applyHealingItem,
    applyShieldRecharger,
    setHiddenPocketItem,
    clearHiddenPocketItem,
    sellHomeStashItem,
    resetSave,
    dismissAwaySummary,
    renameRaider,
    RAIDER_NAME_MAX_LENGTH,
  }
}
