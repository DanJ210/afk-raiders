import robotsData from '../content/robots.json'
import combatMessagesData from '../content/combat_messages.json'
import type { ActiveRobotBattle, CombatMessageEntry, GameState, LogEvent, LootItem, RobotEntry, RobotLootItem, WeaponEntry } from './types.js'
import type { RNG } from './rng.js'
import { getDangerLevelProfile } from './dangerLevelProfiles.js'
import { getMoodResilienceMultiplier } from './mood.js'
import { applyShieldedDamage, type ShieldDamageResult } from './shields.js'
import { getSkillModifierProfile } from './skills.js'
import { getStarterWeapon, getWeaponById } from './weapons.js'

const robots = robotsData as RobotEntry[]
const combatMessages = combatMessagesData as Record<string, CombatMessageEntry[]>

const ROBOT_LETHAL_HP_RATIO = 0.5
const ROBOT_NONLETHAL_MIN_HP_RATIO = 0.25
const ROBOT_DAMAGE_PER_MENACE = 2
const ROBOT_BATTLE_DAMAGE_MULTIPLIER = 0.55
const CRIT_DAMAGE_MULTIPLIER = 1.5
const LETHAL_ROBOT_DEADLINESS: ReadonlySet<RobotEntry['deadliness']> = new Set(['nasty', 'deadly'])

export interface RobotBattleResult {
  state: GameState
  event: LogEvent
  outcome: 'started' | 'ongoing' | 'defeated'
  defeatedRobotId?: string
}

function rarityFromMenace(menace: number): number {
  return Math.max(1, Math.min(5, Math.ceil(menace / 2)))
}

function toLootItem(item: RobotLootItem, robot: RobotEntry): LootItem {
  return {
    ...item,
    rarity: item.rarity ?? rarityFromMenace(robot.menace),
  }
}

function addBackpackItem(
  raid: GameState['raid'],
  item: LootItem,
): GameState['raid'] {
  const existing = raid.backpack.find(entry => entry.itemId === item.id)
  const backpack = existing
    ? raid.backpack.map(entry => (
        entry.itemId === item.id
          ? { ...entry, quantity: entry.quantity + 1 }
          : entry
      ))
    : [...raid.backpack, {
        itemId: item.id,
        name: item.name,
        value: item.value,
        rarity: item.rarity,
        flavor: item.flavor,
        quantity: 1,
      }]

  return {
    ...raid,
    backpack,
    backpackValue: raid.backpackValue + item.value,
  }
}

function pickRobotLoot(robot: RobotEntry, rng: RNG): LootItem {
  return toLootItem(rng.weightedPick(robot.lootTable), robot)
}

function pickCombatMessage(key: string, rng: RNG): string {
  const table = combatMessages[key]
  if (!table || table.length === 0) return `{${key}}`
  return rng.weightedPick(table).text
}

function fillCombatMessage(template: string, slots: Record<string, string | number>): string {
  return template.replace(/\{([^}]+)\}/g, (_match, slot: string) => String(slots[slot] ?? `{${slot}}`))
}

function describeBattleDamage(damage: ShieldDamageResult): string {
  const resilienceText = damage.moodResilienceHpSaved && damage.moodResilienceHpSaved > 0
    ? ` Resilience saved ${damage.moodResilienceHpSaved} HP.`
    : ''
  const skillText = damage.skillDamageReduced && damage.skillDamageReduced > 0
    ? ` Hiding in Lockers ducked ${damage.skillDamageReduced} incoming damage.`
    : ''

  if (!damage.mitigated || damage.shieldChargeLost <= 0) {
    return `Took ${damage.hpDamage} damage.${resilienceText}${skillText}`
  }

  if (damage.hpDamage <= 0) {
    return `Shield lost ${damage.shieldChargeLost} charge. No HP damage landed.${resilienceText}${skillText}`
  }

  return `Shield lost ${damage.shieldChargeLost} charge; ${damage.hpDamage} HP damage landed.${resilienceText}${skillText}`
}

function canRobotBattleBeLethal(state: GameState, robot: RobotEntry): boolean {
  if (!LETHAL_ROBOT_DEADLINESS.has(robot.deadliness)) return false
  if (state.raider.maxHp <= 0) return false
  return state.raider.hp / state.raider.maxHp <= ROBOT_LETHAL_HP_RATIO
}

function applyBattleRobotDamage(
  state: GameState,
  robot: RobotEntry,
  rawDamage: number,
  skillDamageReduced: number,
): { raider: GameState['raider']; raid: GameState['raid']; shieldDamage: ShieldDamageResult } {
  const shielded = applyShieldedDamage(state.raider, state.raid, rawDamage)
  if (state.raider.maxHp <= 0) {
    return { raider: shielded.raider, raid: shielded.raid, shieldDamage: shielded }
  }

  let hp = shielded.raider.hp
  let moodResilienceHpSaved = 0
  if (!canRobotBattleBeLethal(state, robot)) {
    const nonlethalFloor = state.raider.hp / state.raider.maxHp > ROBOT_LETHAL_HP_RATIO
      ? Math.ceil(state.raider.maxHp * ROBOT_NONLETHAL_MIN_HP_RATIO)
      : 1
    hp = Math.max(nonlethalFloor, hp)
  }

  const resilienceMultiplier = getMoodResilienceMultiplier(state.raider.mood)
  if (resilienceMultiplier < 1 && hp < state.raider.hp) {
    const mitigatedDamage = Math.max(1, Math.floor((state.raider.hp - hp) * resilienceMultiplier))
    const nextHp = Math.max(state.raider.hp - mitigatedDamage, hp)
    moodResilienceHpSaved = Math.max(0, nextHp - hp)
    hp = nextHp
  }

  return {
    raider: { ...shielded.raider, hp },
    raid: shielded.raid,
    shieldDamage: {
      ...shielded,
      raider: { ...shielded.raider, hp },
      hpDamage: state.raider.hp - hp,
      moodResilienceHpSaved: moodResilienceHpSaved > 0 ? moodResilienceHpSaved : undefined,
      skillDamageReduced: skillDamageReduced > 0 ? skillDamageReduced : undefined,
    },
  }
}

function getRobotById(robotId: string): RobotEntry | null {
  return robots.find(robot => robot.id === robotId) ?? null
}

function getBattleWeapon(battle: ActiveRobotBattle): WeaponEntry {
  return getWeaponById(battle.weaponId) ?? getStarterWeapon()
}

function getStateWeapon(state: GameState): WeaponEntry {
  return getWeaponById(state.raider.equippedWeapon.weaponId) ?? getStarterWeapon()
}

function attackAccuracy(robot: RobotEntry, weapon: WeaponEntry): number {
  const menacePenalty = Math.max(0, robot.menace - weapon.armorPierce) * 0.025
  return Math.max(0.2, Math.min(0.95, weapon.accuracy - menacePenalty))
}

function robotBattleDamage(state: GameState, robot: RobotEntry, battle: ActiveRobotBattle): { rawDamage: number; skillDamageReduced: number } {
  const profile = getDangerLevelProfile(state.raid.dangerLevel)
  const skillModifiers = getSkillModifierProfile(state.raider.skills)
  const damageMultiplier = Math.max(
    0,
    battle.damageMultiplier * profile.robotFailureDamageMultiplier * ROBOT_BATTLE_DAMAGE_MULTIPLIER,
  )
  const rawBeforeSkills = Math.ceil(robot.menace * ROBOT_DAMAGE_PER_MENACE * damageMultiplier)
  const rawDamage = Math.ceil(rawBeforeSkills * skillModifiers.robotFailureDamageMultiplier)
  return {
    rawDamage,
    skillDamageReduced: Math.max(0, rawBeforeSkills - rawDamage),
  }
}

export function getRobotMaxHp(robot: RobotEntry): number {
  return robot.maxHp
}

export function startRobotBattle(
  state: GameState,
  robotId: string,
  rng: RNG,
  now: number,
  opts: { damageMultiplier?: number } = {},
): RobotBattleResult | null {
  if (state.raid.phase !== 'RAIDING' || state.raid.activeRobotBattle) return null
  const robot = getRobotById(robotId)
  if (!robot) return null

  const weapon = getStateWeapon(state)
  const maxHp = getRobotMaxHp(robot)
  const battle: ActiveRobotBattle = {
    robotId: robot.id,
    robotName: robot.name,
    hp: maxHp,
    maxHp,
    roundsElapsed: 0,
    startedAtTick: state.tick,
    weaponId: weapon.id,
    damageMultiplier: opts.damageMultiplier ?? 1,
  }

  const eventText = fillCombatMessage(pickCombatMessage('battleStarted', rng), {
    robot: robot.name,
    weapon: weapon.name,
    robotHp: battle.hp,
    robotMaxHp: battle.maxHp,
  })

  return {
    state: { ...state, raid: { ...state.raid, activeRobotBattle: battle } },
    event: {
      id: `robot_${robot.id}_battle_started`,
      tick: state.tick,
      timestamp: now,
      text: eventText,
      phase: state.raid.phase,
    },
    outcome: 'started',
  }
}

export function processRobotBattleTick(
  state: GameState,
  rng: RNG,
  now: number,
): RobotBattleResult | null {
  const battle = state.raid.activeRobotBattle
  if (state.raid.phase !== 'RAIDING' || !battle) return null
  const robot = getRobotById(battle.robotId)
  if (!robot) {
    return {
      state: { ...state, raid: { ...state.raid, activeRobotBattle: null } },
      event: {
        id: 'robot_battle_abandoned',
        tick: state.tick,
        timestamp: now,
        text: 'Robot contact vanished from the roster. The Raider chooses not to question a free miracle.',
        phase: state.raid.phase,
      },
      outcome: 'ongoing',
    }
  }

  const weapon = getBattleWeapon(battle)
  const hit = rng.next() <= attackAccuracy(robot, weapon)
  const crit = hit && rng.next() < weapon.critChance
  const raiderDamage = hit
    ? Math.max(1, Math.ceil(weapon.baseDamage * (crit ? CRIT_DAMAGE_MULTIPLIER : 1) + weapon.armorPierce))
    : 0
  const robotHp = Math.max(0, battle.hp - raiderDamage)
  const roundsElapsed = battle.roundsElapsed + 1

  if (robotHp <= 0) {
    const item = pickRobotLoot(robot, rng)
    const raid = addBackpackItem(
      { ...state.raid, activeRobotBattle: null },
      item,
    )
    const successText = rng.pick(robot.successText)
    const eventText = fillCombatMessage(pickCombatMessage('battleVictory', rng), {
      successText,
      item: item.name,
    })

    return {
      state: { ...state, raid },
      event: {
        id: `robot_${robot.id}_battle_defeated`,
        tick: state.tick,
        timestamp: now,
        text: eventText,
        phase: state.raid.phase,
      },
      outcome: 'defeated',
      defeatedRobotId: robot.id,
    }
  }

  const damage = robotBattleDamage(state, robot, battle)
  const damageResult = applyBattleRobotDamage(state, robot, damage.rawDamage, damage.skillDamageReduced)
  const nextBattle: ActiveRobotBattle = {
    ...battle,
    hp: robotHp,
    roundsElapsed,
  }
  const nextState: GameState = {
    ...state,
    raider: damageResult.raider,
    raid: {
      ...damageResult.raid,
      activeRobotBattle: nextBattle,
    },
  }
  const messageKey = hit ? (crit ? 'battleCrit' : 'battleHit') : 'battleMiss'
  const eventText = fillCombatMessage(pickCombatMessage(messageKey, rng), {
    robot: robot.name,
    weapon: weapon.name,
    damage: raiderDamage,
    robotHp,
    robotMaxHp: battle.maxHp,
    damageText: describeBattleDamage(damageResult.shieldDamage),
  })

  return {
    state: nextState,
    event: {
      id: `robot_${robot.id}_battle_round`,
      tick: state.tick,
      timestamp: now,
      text: eventText,
      phase: state.raid.phase,
    },
    outcome: 'ongoing',
  }
}
