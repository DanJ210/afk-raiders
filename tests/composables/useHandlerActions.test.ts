import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../../src/engine/initialState'
import { createRNG } from '../../src/engine/rng'
import { SIGNAL_CAP } from '../../src/engine/signal'
import { skillDefinitionById } from '../../src/engine/skills'
import { MAX_LOG_SIZE } from '../../src/engine/log'
import { processTick } from '../../src/engine/tick'
import { xpRequiredForLevel, getRevivalSignalCost } from '../../src/engine/raiderLevel'
import type { GameState } from '../../src/engine/types'
import { useHandlerActions } from '../../src/composables/useHandlerActions'

function createHarness(state: GameState = createInitialState(0)) {
  const stateRef = { value: state }
  const rngRef = { current: createRNG(123) }
  const lastTickAtRef = { value: 0 }
  const persistCallback = vi.fn()
  const publishEvents = vi.fn()

  const actions = useHandlerActions(
    stateRef,
    rngRef,
    lastTickAtRef,
    () => stateRef.value.pendingCalm || stateRef.value.pendingPressure || stateRef.value.raid.forceExtract,
    persistCallback,
    (newState, _seed, tickTime) => {
      stateRef.value = newState
      lastTickAtRef.value = tickTime
    },
    () => undefined,
    publishEvents,
  )

  return { actions, stateRef, rngRef, persistCallback, publishEvents }
}

describe('useHandlerActions Signal Handling skill', () => {
  it('awards Signal Handling XP when Signal is successfully spent', () => {
    const initial = createInitialState(0)
    const now = Date.now()
    const { actions, stateRef, persistCallback } = createHarness({
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING',
      },
      signal: {
        ...initial.signal,
        current: SIGNAL_CAP,
        lastRegenAt: now,
      },
    })

    actions.callExtract()

    expect(stateRef.value.signal.current).toBe(SIGNAL_CAP - 3)
    expect(stateRef.value.raider.skills.signal_handling.xp).toBeGreaterThan(0)
    expect(stateRef.value.raider.skills.cardio.xp).toBe(0)
    expect(stateRef.value.raider.skills.hoarding.xp).toBe(0)
    expect(stateRef.value.raider.skills.hiding_in_lockers.xp).toBe(0)
    expect(persistCallback).toHaveBeenCalledOnce()
  })

  it('does not award Signal Handling XP when a Signal action is blocked', () => {
    const initial = createInitialState(0)
    const now = Date.now()
    const { actions, stateRef, persistCallback } = createHarness({
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'HUB',
      },
      signal: {
        ...initial.signal,
        current: SIGNAL_CAP,
        lastRegenAt: now,
      },
    })

    actions.callExtract()

    expect(stateRef.value.signal.current).toBe(SIGNAL_CAP)
    expect(stateRef.value.raider.skills.signal_handling.xp).toBe(0)
    expect(persistCallback).not.toHaveBeenCalled()
  })

  it('uses a cloned RNG for Raider XP awarded by Signal Handling level-ups', () => {
    const initial = createInitialState(0)
    const now = Date.now()
    const signalHandlingLevelOneXp = skillDefinitionById('signal_handling').xpThresholds[0]
    const { actions, stateRef, rngRef, persistCallback } = createHarness({
      ...initial,
      raider: {
        ...initial.raider,
        skills: {
          ...initial.raider.skills,
          signal_handling: {
            ...initial.raider.skills.signal_handling,
            xp: signalHandlingLevelOneXp - 1,
          },
        },
      },
      raid: {
        ...initial.raid,
        phase: 'RAIDING',
      },
      signal: {
        ...initial.signal,
        current: SIGNAL_CAP,
        lastRegenAt: now,
      },
    })
    const expectedMainRng = createRNG(123)
    expectedMainRng.int(3, 4)

    actions.callExtract()

    expect(stateRef.value.raider.skills.signal_handling.level).toBe(1)
    expect(stateRef.value.raider.levelXp).toBeGreaterThan(0)
    expect(rngRef.current.getSeed()).toBe(expectedMainRng.getSeed())
    expect(persistCallback).toHaveBeenCalledOnce()
  })

  it('caps the log when Ready Up appends the deployment transition', () => {
    const initial = createInitialState(0)
    const now = Date.now()
    const existingLog = Array.from({ length: MAX_LOG_SIZE }, (_, index) => ({
      id: `existing_${index}`,
      tick: index,
      timestamp: index,
      text: `Existing log ${index}`,
      phase: 'HUB' as const,
    }))
    const { actions, stateRef, persistCallback } = createHarness({
      ...initial,
      log: existingLog,
      signal: {
        ...initial.signal,
        current: SIGNAL_CAP,
        lastRegenAt: now,
      },
    })

    actions.readyUp()

    expect(stateRef.value.raid.phase).toBe('DEPLOYING')
    expect(stateRef.value.log).toHaveLength(MAX_LOG_SIZE)
    expect(stateRef.value.log[0].id).toBe('existing_1')
    expect(stateRef.value.log.some(entry => entry.id === 'phase_HUB_to_DEPLOYING')).toBe(true)
    expect(persistCallback).toHaveBeenCalledOnce()
  })

  it('publishes Ready Up transition together with Signal Handling level-up events', () => {
    const initial = createInitialState(0)
    const now = Date.now()
    const signalHandlingLevelOneXp = skillDefinitionById('signal_handling').xpThresholds[0]
    const { actions, publishEvents } = createHarness({
      ...initial,
      raider: {
        ...initial.raider,
        skills: {
          ...initial.raider.skills,
          signal_handling: {
            ...initial.raider.skills.signal_handling,
            xp: signalHandlingLevelOneXp - 1,
          },
        },
      },
      signal: {
        ...initial.signal,
        current: SIGNAL_CAP,
        lastRegenAt: now,
      },
    })

    actions.readyUp()

    expect(publishEvents).toHaveBeenCalledTimes(1)
    expect(publishEvents.mock.calls[0][0].map(event => event.id)).toEqual([
      'phase_HUB_to_DEPLOYING',
      'skill_signal_handling_level_1',
    ])
  })

  it('publishes manual bandage use once without replaying it on the next tick', () => {
    const initial = createInitialState(0)
    const { actions, stateRef, rngRef, persistCallback, publishEvents } = createHarness({
      ...initial,
      tick: 12,
      raider: { ...initial.raider, hp: 40 },
      raid: {
        ...initial.raid,
        phase: 'RAIDING',
        phaseTicksRemaining: 120,
        healingItems: [{
          itemId: 'bandage_blue',
          name: 'Blue Bandage',
          healAmount: 25,
          moodGain: 3,
          rarity: 3,
          quantity: 1,
        }],
      },
    })

    actions.applyHealingItem('bandage_blue')

    expect(stateRef.value.log.filter(entry => entry.id === 'healing_bandage_blue_used')).toHaveLength(1)
    expect(publishEvents).toHaveBeenCalledTimes(1)
    expect(publishEvents.mock.calls[0][0].map(event => event.id)).toEqual(['healing_bandage_blue_used'])
    expect(persistCallback).toHaveBeenCalledOnce()

    stateRef.value = processTick(stateRef.value, rngRef.current, Date.now()).state

    expect(stateRef.value.log.filter(entry => entry.id === 'healing_bandage_blue_used')).toHaveLength(1)
  })

  it('revives a downed raider during RAIDING for full Signal', () => {
    const initial = createInitialState(0)
    const now = Date.now()
    const { actions, stateRef, persistCallback, publishEvents } = createHarness({
      ...initial,
      raider: { ...initial.raider, hp: 0 },
      raid: {
        ...initial.raid,
        phase: 'RAIDING',
        downed: { ticksRemaining: 2 },
      },
      signal: {
        ...initial.signal,
        current: SIGNAL_CAP,
        lastRegenAt: now,
      },
    })

    actions.revive()

    expect(stateRef.value.signal.current).toBe(0)
    expect(stateRef.value.raider.hp).toBe(25)
    expect(stateRef.value.raid.downed).toBeNull()
    expect(stateRef.value.log.at(-1)?.id).toBe('handler_revive_used')
    expect(publishEvents).toHaveBeenCalledTimes(1)
    expect(publishEvents.mock.calls[0][0].map(event => event.id)).toContain('handler_revive_used')
    expect(persistCallback).toHaveBeenCalledOnce()
  })

  it('does not revive outside a downed RAIDING condition', () => {
    const initial = createInitialState(0)
    const now = Date.now()
    const { actions, stateRef, persistCallback, publishEvents } = createHarness({
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING',
        downed: null,
      },
      signal: {
        ...initial.signal,
        current: SIGNAL_CAP,
        lastRegenAt: now,
      },
    })

    actions.revive()

    expect(stateRef.value.signal.current).toBe(SIGNAL_CAP)
    expect(stateRef.value.raider.hp).toBe(initial.raider.hp)
    expect(publishEvents).not.toHaveBeenCalled()
    expect(persistCallback).not.toHaveBeenCalled()
  })

  it('revive cost scales down with raider level progression', () => {
    expect(getRevivalSignalCost(0)).toBe(5) // Levels 1-9 (titleBandIndex 0): no reduction
    expect(getRevivalSignalCost(xpRequiredForLevel(10))).toBe(5) // Levels 10-18 (titleBandIndex 1): no reduction
    expect(getRevivalSignalCost(xpRequiredForLevel(19))).toBe(4) // Levels 19-27 (titleBandIndex 2): 1 reduction
    expect(getRevivalSignalCost(xpRequiredForLevel(28))).toBe(4) // Levels 28-36 (titleBandIndex 3): 1 reduction
    expect(getRevivalSignalCost(xpRequiredForLevel(37))).toBe(3) // Levels 37-45 (titleBandIndex 4): 2 reduction
    expect(getRevivalSignalCost(xpRequiredForLevel(75))).toBeLessThanOrEqual(1) // Max level: reduced to 1
  })

  it('revive cost never goes below 1 Signal', () => {
    const maxLevelXp = xpRequiredForLevel(75)
    const reviveCost = getRevivalSignalCost(maxLevelXp)
    expect(reviveCost).toBeGreaterThanOrEqual(1)
  })

  it('spends correct signal amount based on raider level when reviving', () => {
    const initial = createInitialState(0)
    const now = Date.now()
    const level20Xp = xpRequiredForLevel(20)

    const { actions, stateRef, persistCallback, publishEvents } = createHarness({
      ...initial,
      raider: {
        ...initial.raider,
        hp: 0,
        levelXp: level20Xp, // Level 20 (titleBandIndex 2) = 4 signal cost
      },
      raid: {
        ...initial.raid,
        phase: 'RAIDING',
        downed: { ticksRemaining: 2 },
      },
      signal: {
        ...initial.signal,
        current: SIGNAL_CAP,
        lastRegenAt: now,
      },
    })

    actions.revive()

    const expectedCost = getRevivalSignalCost(level20Xp)
    expect(expectedCost).toBe(4)
    expect(stateRef.value.signal.current).toBe(SIGNAL_CAP - 4)
    expect(stateRef.value.raider.hp).toBe(25)
    expect(stateRef.value.raid.downed).toBeNull()
    expect(persistCallback).toHaveBeenCalledOnce()
  })

  it('spends 1 Signal for max level raider revival (cost capped)', () => {
    const initial = createInitialState(0)
    const now = Date.now()
    const maxLevelXp = xpRequiredForLevel(75)

    const { actions, stateRef, persistCallback } = createHarness({
      ...initial,
      raider: {
        ...initial.raider,
        hp: 0,
        levelXp: maxLevelXp, // Level 75 = 1 signal cost (capped)
      },
      raid: {
        ...initial.raid,
        phase: 'RAIDING',
        downed: { ticksRemaining: 2 },
      },
      signal: {
        ...initial.signal,
        current: SIGNAL_CAP,
        lastRegenAt: now,
      },
    })

    actions.revive()

    expect(stateRef.value.signal.current).toBe(SIGNAL_CAP - 1)
    expect(stateRef.value.raider.hp).toBe(25)
    expect(persistCallback).toHaveBeenCalledOnce()
  })

  it('awards skill XP equal to actual revival cost spent', () => {
    const initial = createInitialState(0)
    const now = Date.now()
    const level37Xp = xpRequiredForLevel(37)

    const { actions, stateRef } = createHarness({
      ...initial,
      raider: {
        ...initial.raider,
        hp: 0,
        levelXp: level37Xp, // Level 37 (titleBandIndex 4) = 3 signal cost
      },
      raid: {
        ...initial.raid,
        phase: 'RAIDING',
        downed: { ticksRemaining: 2 },
      },
      signal: {
        ...initial.signal,
        current: SIGNAL_CAP,
        lastRegenAt: now,
      },
    })

    const initialSkillXp = stateRef.value.raider.skills.signal_handling.xp
    actions.revive()

    const expectedCost = getRevivalSignalCost(level37Xp)
    expect(expectedCost).toBe(3)
    expect(stateRef.value.raider.skills.signal_handling.xp).toBeGreaterThan(initialSkillXp)
  })

  it('includes level discount in revive comms when cost is reduced', () => {
    const initial = createInitialState(0)
    const now = Date.now()
    const level19Xp = xpRequiredForLevel(19)

    const { actions, stateRef } = createHarness({
      ...initial,
      raider: {
        ...initial.raider,
        hp: 0,
        levelXp: level19Xp, // Level 19 (titleBandIndex 2) = 4 signal cost (discount of 1)
      },
      raid: {
        ...initial.raid,
        phase: 'RAIDING',
        downed: { ticksRemaining: 2 },
      },
      signal: {
        ...initial.signal,
        current: SIGNAL_CAP,
        lastRegenAt: now,
      },
    })

    actions.revive()

    const reviveLog = stateRef.value.log.find(entry => entry.id === 'handler_revive_used')
    expect(reviveLog?.text).toContain('Raider Level discount: 1📶')
  })

  it('does not include discount text when reviving at level 1', () => {
    const initial = createInitialState(0)
    const now = Date.now()

    const { actions, stateRef } = createHarness({
      ...initial,
      raider: {
        ...initial.raider,
        hp: 0,
        levelXp: 0, // Level 1 = no discount
      },
      raid: {
        ...initial.raid,
        phase: 'RAIDING',
        downed: { ticksRemaining: 2 },
      },
      signal: {
        ...initial.signal,
        current: SIGNAL_CAP,
        lastRegenAt: now,
      },
    })

    actions.revive()

    const reviveLog = stateRef.value.log.find(entry => entry.id === 'handler_revive_used')
    expect(reviveLog?.text).not.toContain('discount')
    expect(reviveLog?.text).toBe('Revive signal punched through. Raider is upright, offended, and technically alive.')
  })
})