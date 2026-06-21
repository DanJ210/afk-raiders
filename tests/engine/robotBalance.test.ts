import { describe, expect, it } from 'vitest'
import { createInitialState } from '../../src/engine/initialState'
import { resolveRobotEncounter, robots } from '../../src/engine/eventResolver'
import { createInitialSkills, skillDefinitionById } from '../../src/engine/skills'
import { xpRequiredForLevel } from '../../src/engine/raiderLevel'
import type { DangerLevel, GameState, RaiderSkillsState, RobotEntry } from '../../src/engine/types'
import type { RNG } from '../../src/engine/rng'

const DEADLINESS_ORDER: RobotEntry['deadliness'][] = ['weak', 'moderate', 'dangerous', 'nasty', 'deadly']
const NONLETHAL_DEADLINESS = new Set<RobotEntry['deadliness']>(['weak', 'moderate', 'dangerous'])
const LETHAL_DEADLINESS = new Set<RobotEntry['deadliness']>(['nasty', 'deadly'])

function createFailingCombatRng(): RNG {
  const rng = {
    next: () => 0,
    int: () => 1,
    pick: <Item>(items: readonly Item[]) => items[0],
    weightedPick: <Item extends { weight: number }>(items: readonly Item[]) => items[0],
    clone: () => createFailingCombatRng(),
    getSeed: () => 0,
  }
  return rng as unknown as RNG
}

function createRobotState(params: {
  dangerLevel?: DangerLevel
  hp?: number
  shielded?: boolean
  levelXp?: number
  skills?: RaiderSkillsState
} = {}): GameState {
  const state = createInitialState(0)
  return {
    ...state,
    raider: {
      ...state.raider,
      hp: params.hp ?? state.raider.hp,
      mood: 0,
      levelXp: params.levelXp ?? 0,
      skills: params.skills ?? createInitialSkills(),
    },
    raid: {
      ...state.raid,
      dangerLevel: params.dangerLevel ?? 'Low',
      phase: 'RAIDING',
      shield: params.shielded === true ? state.raid.shield : null,
    },
  }
}

function skillsWithMaxHiding(): RaiderSkillsState {
  const skills = createInitialSkills()
  const definition = skillDefinitionById('hiding_in_lockers')
  skills.hiding_in_lockers = {
    ...skills.hiding_in_lockers,
    level: definition.maxLevel,
    xp: definition.xpThresholds[definition.xpThresholds.length - 1],
    discovered: true,
  }
  return skills
}

function resolveFailedRobot(robotId: string, state: GameState) {
  const result = resolveRobotEncounter(state, robotId, createFailingCombatRng(), 0)
  expect(result, `robot ${robotId} should resolve`).not.toBeNull()
  expect(result!.event.id, `robot ${robotId} should fail the encounter roll`).toBe(`robot_${robotId}_escaped`)
  return result!
}

function failedRobotHpDamage(robotId: string, state: GameState): number {
  return state.raider.hp - resolveFailedRobot(robotId, state).state.raider.hp
}

describe('robot balance guardrails', () => {
  it('keeps failed robot damage rising by deadliness tier for starter raiders', () => {
    const state = createRobotState({ dangerLevel: 'High', shielded: false })
    const maxDamageByDeadliness = DEADLINESS_ORDER.map(deadliness => {
      const tierRobots = robots.filter(robot => robot.deadliness === deadliness)
      expect(tierRobots.length, `${deadliness} tier should have robots`).toBeGreaterThan(0)
      return Math.max(...tierRobots.map(robot => failedRobotHpDamage(robot.id, state)))
    })

    for (let index = 1; index < maxDamageByDeadliness.length; index += 1) {
      expect(maxDamageByDeadliness[index]).toBeGreaterThan(maxDamageByDeadliness[index - 1])
    }
  })

  it('lets nasty and deadly robots down wounded starter raiders while lower tiers stay nonlethal', () => {
    const woundedStarter = createRobotState({ dangerLevel: 'High', hp: 25, shielded: false })

    for (const robot of robots) {
      const result = resolveFailedRobot(robot.id, woundedStarter)
      if (LETHAL_DEADLINESS.has(robot.deadliness)) {
        expect(result.state.raider.hp, `${robot.id} should be lethal when the starter raider is wounded`).toBe(0)
      }
      if (NONLETHAL_DEADLINESS.has(robot.deadliness)) {
        expect(result.state.raider.hp, `${robot.id} should not bypass the nonlethal tier floor`).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('keeps Raider Level from passively reducing robot damage', () => {
    const starter = createRobotState({ dangerLevel: 'High', shielded: false, levelXp: 0 })
    const maxLevel = createRobotState({ dangerLevel: 'High', shielded: false, levelXp: xpRequiredForLevel(75) })

    expect(failedRobotHpDamage('tank_overcompensation', maxLevel)).toBe(
      failedRobotHpDamage('tank_overcompensation', starter),
    )
  })

  it('keeps mood resilience helpful but smaller than the danger jump', () => {
    const mediumNeutral = createRobotState({ dangerLevel: 'Medium', shielded: false })
    const highNeutral = createRobotState({ dangerLevel: 'High', shielded: false })
    const highMood = {
      ...highNeutral,
      raider: { ...highNeutral.raider, mood: 5 },
    }

    const mediumDamage = failedRobotHpDamage('tank_overcompensation', mediumNeutral)
    const highDamage = failedRobotHpDamage('tank_overcompensation', highNeutral)
    const highMoodDamage = failedRobotHpDamage('tank_overcompensation', highMood)

    expect(highMoodDamage).toBeLessThan(highDamage)
    expect(highMoodDamage).toBeGreaterThan(mediumDamage)
  })

  it('keeps max Hiding in Lockers helpful but below the High-danger curve', () => {
    const mediumStarter = createRobotState({ dangerLevel: 'Medium', shielded: false })
    const highSkilled = createRobotState({
      dangerLevel: 'High',
      shielded: false,
      skills: skillsWithMaxHiding(),
    })

    const mediumDamage = failedRobotHpDamage('tank_overcompensation', mediumStarter)
    const highSkilledResult = resolveFailedRobot('tank_overcompensation', highSkilled)
    const highSkilledDamage = highSkilled.raider.hp - highSkilledResult.state.raider.hp

    expect(highSkilledDamage).toBeLessThan(failedRobotHpDamage('tank_overcompensation', createRobotState({ dangerLevel: 'High', shielded: false })))
    expect(highSkilledDamage).toBeGreaterThan(mediumDamage)
    expect(highSkilledResult.event.text).toContain('Hiding in Lockers ducked')
  })
})