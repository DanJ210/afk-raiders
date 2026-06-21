import { describe, expect, it } from 'vitest'
import { createInitialState } from '../../src/engine/initialState'
import { processRobotBattleTick, startRobotBattle } from '../../src/engine/robotCombat'
import type { GameState } from '../../src/engine/types'
import type { RNG } from '../../src/engine/rng'

function createScriptedRng(values: number[]): RNG {
  let index = 0
  const rng = {
    next: () => values[index++] ?? values[values.length - 1] ?? 0.5,
    int: () => 1,
    pick: <Item>(items: readonly Item[]) => items[0],
    weightedPick: <Item extends { weight: number }>(items: readonly Item[]) => items[0],
    clone: () => createScriptedRng(values.slice(index)),
    getSeed: () => 0,
  }
  return rng as unknown as RNG
}

function createRaidingState(overrides: Partial<GameState> = {}): GameState {
  const initial = createInitialState(0)
  return {
    ...initial,
    ...overrides,
    raid: {
      ...initial.raid,
      phase: 'RAIDING',
      dangerLevel: 'Low',
      ...(overrides.raid ?? {}),
    },
    raider: {
      ...initial.raider,
      ...(overrides.raider ?? {}),
    },
  }
}

describe('robotCombat', () => {
  it('starts an active robot battle without damaging the raider immediately', () => {
    const state = createRaidingState()
    const result = startRobotBattle(state, 'anxietick', createScriptedRng([0]), 1000)

    expect(result).not.toBeNull()
    expect(result!.outcome).toBe('started')
    expect(result!.event.id).toBe('robot_anxietick_battle_started')
    expect(result!.event.text).toContain('Anxietick engaged')
    expect(result!.state.raider.hp).toBe(state.raider.hp)
    expect(result!.state.raider.equippedWeapon.weaponId).toBe('committee_sidearm')
    expect(result!.state.raid.activeRobotBattle).toMatchObject({
      robotId: 'anxietick',
      robotName: 'Anxietick',
      hp: 10,
      maxHp: 10,
      roundsElapsed: 0,
      weaponId: 'committee_sidearm',
    })
  })

  it('does not start overlapping robot battles', () => {
    const started = startRobotBattle(createRaidingState(), 'anxietick', createScriptedRng([0]), 0)
    expect(started).not.toBeNull()

    const overlap = startRobotBattle(started!.state, 'roomba_prime', createScriptedRng([0]), 0)
    expect(overlap).toBeNull()
  })

  it('advances an active battle and keeps it active when the robot survives', () => {
    const started = startRobotBattle(createRaidingState(), 'roomba_prime', createScriptedRng([0]), 0)
    expect(started).not.toBeNull()

    const result = processRobotBattleTick(started!.state, createScriptedRng([0.01, 0.99]), 1000)

    expect(result).not.toBeNull()
    expect(result!.outcome).toBe('ongoing')
    expect(result!.event.id).toBe('robot_roomba_prime_battle_round')
    expect(result!.event.text).toContain('Committee Sidearm tagged Roomba Prime')
    expect(result!.state.raid.activeRobotBattle).toMatchObject({
      robotId: 'roomba_prime',
      hp: 45,
      roundsElapsed: 1,
    })
    expect(result!.state.raider.hp).toBeLessThan(started!.state.raider.hp)
  })

  it('clears the active battle and awards loot when the robot is defeated', () => {
    const initial = createRaidingState({
      raid: {
        ...createInitialState(0).raid,
        phase: 'RAIDING',
        dangerLevel: 'Low',
        activeRobotBattle: {
          robotId: 'anxietick',
          robotName: 'Anxietick',
          hp: 3,
          maxHp: 10,
          roundsElapsed: 1,
          startedAtTick: 0,
          weaponId: 'committee_sidearm',
          damageMultiplier: 1,
        },
      },
    })

    const result = processRobotBattleTick(initial, createScriptedRng([0.01, 0.99, 0, 0]), 1000)

    expect(result).not.toBeNull()
    expect(result!.outcome).toBe('defeated')
    expect(result!.defeatedRobotId).toBe('anxietick')
    expect(result!.event.id).toBe('robot_anxietick_battle_defeated')
    expect(result!.state.raid.activeRobotBattle).toBeNull()
    expect(result!.state.raid.backpack).toHaveLength(1)
    expect(result!.state.raid.backpack[0].itemId).toBe('anxietick_gear')
  })

  it('keeps mood resilience and Hiding in Lockers visible in battle damage narration', () => {
    const state = createRaidingState({
      raider: {
        ...createInitialState(0).raider,
        mood: 5,
        skills: {
          ...createInitialState(0).raider.skills,
          hiding_in_lockers: {
            ...createInitialState(0).raider.skills.hiding_in_lockers,
            level: 5,
            xp: 999,
            discovered: true,
          },
        },
      },
      raid: {
        ...createInitialState(0).raid,
        phase: 'RAIDING',
        dangerLevel: 'High',
        shield: null,
      },
    })
    const started = startRobotBattle(state, 'tank_overcompensation', createScriptedRng([0]), 0)
    expect(started).not.toBeNull()

    const result = processRobotBattleTick(started!.state, createScriptedRng([0.99]), 1000)

    expect(result).not.toBeNull()
    expect(result!.event.text).toContain('Took')
    expect(result!.event.text).toContain('Resilience saved')
    expect(result!.event.text).toContain('Hiding in Lockers ducked')
  })
})