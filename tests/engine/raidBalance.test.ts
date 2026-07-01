import { describe, expect, it } from 'vitest'
import { createInitialState } from '../../src/engine/initialState'
import { processTick } from '../../src/engine/tick'
import { createRNG } from '../../src/engine/rng'
import { TICK_INTERVAL_MS } from '../../src/engine/catchUp'
import { PHASE_DURATIONS } from '../../src/engine/raidStateMachine'
import { DANGER_LEVEL_PROFILES } from '../../src/engine/dangerLevelProfiles'
import { consumeHealingItem, consumeShieldRecharger } from '../../src/engine/eventResolver'
import { advanceRaidActivity, DEFAULT_RAIDER_WEAPON } from '../../src/engine/raidActivities'
import { advanceShieldRecharge } from '../../src/engine/shields'
import { createInitialSkills, getSkillModifierProfile, skillDefinitionById } from '../../src/engine/skills'
import { getRaiderLevelBenefitProfile, xpRequiredForLevel } from '../../src/engine/raiderLevel'
import type { DangerLevel, GameState, RaiderSkillsState, SkillTrackId } from '../../src/engine/types'

type RaidOutcome = 'EXTRACTED' | 'DOWNED'

const BALANCE_SAMPLE_SIZE = 200
const STARTER_MEDIUM_MIN_DOWNED_RATE = 0.45
const STARTER_HIGH_MIN_DOWNED_RATE = 0.60
const MIN_DANGER_STEP_DOWNED_RATE_INCREASE = 0.01

interface RaidSimulationResult {
  outcome: RaidOutcome
  raidingTicks: number
}

interface RaidBalanceSummary {
  dangerLevel: DangerLevel
  extractionRate: number
  downedRate: number
  averageRaidingTicks: number
}

function createRaidStart(dangerLevel: DangerLevel): GameState {
  const state = createInitialState(0)
  return {
    ...state,
    raid: {
      ...state.raid,
      zone: 'damp_battlegrounds',
      dangerLevel,
      phase: 'RAIDING',
      phaseTicksRemaining: PHASE_DURATIONS.RAIDING,
    },
  }
}

function simulateRaid(seed: number, dangerLevel: DangerLevel): RaidSimulationResult {
  const rng = createRNG(seed)
  let state = createRaidStart(dangerLevel)
  let raidingTicks = 0

  for (let tick = 0; tick < 1_200; tick += 1) {
    if (state.raid.phase === 'RAIDING') {
      raidingTicks += 1
    }
    state = processTick(state, rng, tick * TICK_INTERVAL_MS).state

    if (state.raider.extractCount > 0) return { outcome: 'EXTRACTED', raidingTicks }
    if (state.raider.deathCount > 0) return { outcome: 'DOWNED', raidingTicks }
  }

  throw new Error(`raid did not resolve for seed ${seed}`)
}

function summarizeStarterRaids(dangerLevel: DangerLevel): RaidBalanceSummary {
  const outcomes = Array.from(
    { length: BALANCE_SAMPLE_SIZE },
    (_, index) => simulateRaid(index + 1, dangerLevel),
  )
  const extracts = outcomes.filter(result => result.outcome === 'EXTRACTED').length
  const extractionRate = extracts / outcomes.length
  const averageRaidingTicks = outcomes.reduce((sum, result) => sum + result.raidingTicks, 0) / outcomes.length

  return {
    dangerLevel,
    extractionRate,
    downedRate: 1 - extractionRate,
    averageRaidingTicks,
  }
}

function maxedSkills(): RaiderSkillsState {
  const skills = createInitialSkills()
  for (const skillId of Object.keys(skills) as SkillTrackId[]) {
    const definition = skillDefinitionById(skillId)
    skills[skillId] = {
      ...skills[skillId],
      level: definition.maxLevel,
      xp: definition.xpThresholds[definition.xpThresholds.length - 1],
      discovered: true,
    }
  }
  return skills
}

function createHighDangerInterventionState(): GameState {
  const state = createRaidStart('High')
  return {
    ...state,
    raider: {
      ...state.raider,
      hp: 30,
      mood: 0,
      levelXp: 0,
      skills: createInitialSkills(),
    },
    raid: {
      ...state.raid,
      shield: state.raid.shield
        ? { ...state.raid.shield, charge: 0 }
        : null,
      healingItems: [
        {
          itemId: 'bandage_purple',
          name: 'Purple Bandage',
          healAmount: 50,
          moodGain: 4,
          rarity: 4,
          quantity: 1,
        },
      ],
      backpack: [
        {
          itemId: 'panic_capacitor',
          name: 'Panic Capacitor',
          value: 70,
          rarity: 4,
          quantity: 1,
          kind: 'shield_recharger',
          shieldChargeAmount: 50,
        },
      ],
      backpackValue: 70,
    },
  }
}

function advanceTankActivity(state: GameState, rounds: number): GameState {
  let currentState: GameState = {
    ...state,
    raid: {
      ...state.raid,
      activeRaidActivity: {
        id: 'robot_encounter_standard',
        kind: 'ROBOT_ENCOUNTER',
        ticksRemaining: 3,
        totalTicks: 3,
        robotId: 'tank_overcompensation',
        robotHp: 999,
        robotMaxHp: 999,
        weaponId: DEFAULT_RAIDER_WEAPON.id,
        weaponName: DEFAULT_RAIDER_WEAPON.name,
        raiderDamageMin: 0,
        raiderDamageMax: 0,
        robotDamageMultiplier: 2,
        raiderAction: 'fighting',
      },
    },
  }

  for (let tick = 0; tick < rounds && currentState.raid.activeRaidActivity && currentState.raider.hp > 0; tick += 1) {
    currentState = advanceRaidActivity(currentState, createRNG(1), tick).state
  }

  return currentState
}

describe('raid balance', () => {
  it('keeps starter autonomous raid outcomes shaped by danger level', () => {
    const low = summarizeStarterRaids('Low')
    const medium = summarizeStarterRaids('Medium')
    const high = summarizeStarterRaids('High')

    expect(low.extractionRate).toBeGreaterThanOrEqual(0.30)
    expect(low.extractionRate).toBeLessThanOrEqual(0.70)
    expect(low.averageRaidingTicks).toBeGreaterThanOrEqual(20)

    expect(medium.downedRate).toBeGreaterThanOrEqual(STARTER_MEDIUM_MIN_DOWNED_RATE)
    expect(high.downedRate).toBeGreaterThanOrEqual(STARTER_HIGH_MIN_DOWNED_RATE)
    expect(medium.downedRate).toBeGreaterThanOrEqual(low.downedRate + MIN_DANGER_STEP_DOWNED_RATE_INCREASE)
    expect(high.downedRate).toBeGreaterThanOrEqual(medium.downedRate + MIN_DANGER_STEP_DOWNED_RATE_INCREASE)
  }, 15_000)

  it('keeps danger profiles monotonic for risk and reward tuning', () => {
    expect(DANGER_LEVEL_PROFILES.Medium.lootValueMultiplier).toBeGreaterThan(DANGER_LEVEL_PROFILES.Low.lootValueMultiplier)
    expect(DANGER_LEVEL_PROFILES.High.lootValueMultiplier).toBeGreaterThan(DANGER_LEVEL_PROFILES.Medium.lootValueMultiplier)

    expect(DANGER_LEVEL_PROFILES.Medium.robotEncounterWeightMultiplier).toBeGreaterThan(DANGER_LEVEL_PROFILES.Low.robotEncounterWeightMultiplier)
    expect(DANGER_LEVEL_PROFILES.High.robotEncounterWeightMultiplier).toBeGreaterThan(DANGER_LEVEL_PROFILES.Medium.robotEncounterWeightMultiplier)
    expect(DANGER_LEVEL_PROFILES.Medium.robotFailureDamageMultiplier).toBeGreaterThan(DANGER_LEVEL_PROFILES.Low.robotFailureDamageMultiplier)
    expect(DANGER_LEVEL_PROFILES.High.robotFailureDamageMultiplier).toBeGreaterThan(DANGER_LEVEL_PROFILES.Medium.robotFailureDamageMultiplier)
    expect(DANGER_LEVEL_PROFILES.Medium.ambientRaidDeathChance).toBeGreaterThan(DANGER_LEVEL_PROFILES.Low.ambientRaidDeathChance)
    expect(DANGER_LEVEL_PROFILES.High.ambientRaidDeathChance).toBeGreaterThan(DANGER_LEVEL_PROFILES.Medium.ambientRaidDeathChance)

    expect(DANGER_LEVEL_PROFILES.Medium.extractionRiskEventWeightMultiplier).toBeGreaterThan(DANGER_LEVEL_PROFILES.Low.extractionRiskEventWeightMultiplier)
    expect(DANGER_LEVEL_PROFILES.High.extractionRiskEventWeightMultiplier).toBeGreaterThan(DANGER_LEVEL_PROFILES.Medium.extractionRiskEventWeightMultiplier)
    expect(DANGER_LEVEL_PROFILES.Medium.extractionSafeEventWeightMultiplier).toBeLessThan(DANGER_LEVEL_PROFILES.Low.extractionSafeEventWeightMultiplier)
    expect(DANGER_LEVEL_PROFILES.High.extractionSafeEventWeightMultiplier).toBeLessThan(DANGER_LEVEL_PROFILES.Medium.extractionSafeEventWeightMultiplier)
  })

  it('keeps progression benefits too small to flatten high-danger risk', () => {
    const skillModifiers = getSkillModifierProfile(maxedSkills())
    const maxLevelBenefits = getRaiderLevelBenefitProfile(xpRequiredForLevel(75))

    expect(skillModifiers.extractionChanceBonus).toBeLessThanOrEqual(0.01)
    expect(skillModifiers.lootValueMultiplier).toBeLessThanOrEqual(1.05)
    expect(skillModifiers.lootBonusConsumableChanceBonus).toBeLessThanOrEqual(0.03)
    expect(skillModifiers.ambientRaidDeathChanceMultiplier).toBeGreaterThanOrEqual(0.75)
    expect(skillModifiers.robotFailureDamageMultiplier).toBeGreaterThanOrEqual(0.75)
    expect(
      DANGER_LEVEL_PROFILES.High.robotFailureDamageMultiplier * skillModifiers.robotFailureDamageMultiplier,
    ).toBeGreaterThan(DANGER_LEVEL_PROFILES.Medium.robotFailureDamageMultiplier)

    expect(Object.keys(maxLevelBenefits).sort()).toEqual([
      'extractionCoinBonus',
      'level',
      'resilienceReductionPercent',
      'revivalSignalCostReduction',
      'titleBandIndex',
    ])
    expect(maxLevelBenefits.resilienceReductionPercent).toBeLessThanOrEqual(1.6)
  })

  it('lets manual healing and shield intervention rescue an otherwise lethal high-danger hit', () => {
    const exposed = createHighDangerInterventionState()
    const exposedResult = advanceTankActivity(exposed, 3)
    expect(exposedResult.raider.hp).toBe(0)

    const healed = consumeHealingItem(exposed, 'bandage_purple', 0)
    expect(healed).not.toBeNull()
    const recharge = consumeShieldRecharger(healed!.state, 'panic_capacitor', 0)
    expect(recharge).not.toBeNull()

    let protectedState = recharge!.state
    for (let tick = 0; tick < 5; tick += 1) {
      protectedState = {
        ...protectedState,
        raid: advanceShieldRecharge(protectedState.raid).raid,
      }
    }

    const protectedResult = advanceTankActivity(protectedState, 3)
    expect(protectedResult.raider.hp).toBeGreaterThan(0)
    expect(protectedResult.raid.activeRaidActivity).not.toBeNull()
  })
})
