import raidActivitiesEncounters from '../content/raiding-events/robot_encounter_activities.json'
import raidActivitiesSearches from '../content/raiding-events/search_activities.json'
import healingItemsData from '../content/healing_items.json'
import robotsData from '../content/robots.json'
import shieldRechargersData from '../content/shield_rechargers.json'
import apparelAccessoriesData from '../content/loot-tables/apparel_accessories.json'
import arcTechData from '../content/loot-tables/arc_tech.json'
import consumablesData from '../content/loot-tables/consumables.json'
import cursedWeirdItemsData from '../content/loot-tables/cursed_weird_items.json'
import lootData from '../content/loot-tables/loot.json'
import personalJunkData from '../content/loot-tables/personal_junk.json'
import scrapComponentsData from '../content/loot-tables/scrap_components.json'
import valuablesData from '../content/loot-tables/valuables.json'
import weaponsPartsData from '../content/loot-tables/weapons_parts.json'
import { CommsPriority, type ActivityLogEvent, type ActiveRaidActivity, type BackpackItem, type DownedReason, type GameState, type HealingItem, type LootItem, type RaidActivityDefinition, type RobotEntry, type RobotLootItem, type ShieldRechargerItem, type StartRaidActivityEffect } from './types.js'
import type { RNG } from './rng.js'
import { getDangerLevelProfile, rarityWeight } from './dangerLevelProfiles.js'
import { getMoodRarityWeightMultiplier, getMoodResilienceReductionPercent } from './mood.js'
import { getGreedRarityWeightMultiplier } from './greed.js'
import { getRaiderLevelBenefitProfile } from './raiderLevel.js'
import { applyShieldedDamage, type ShieldDamageResult } from './shields.js'
import { describeShieldDamage } from './eventResolver.js'
import { getSkillModifierProfile } from './skills.js'
import { findWeapon, getDefaultWeapon } from './weapons.js'

export const DEFAULT_RAIDER_WEAPON = getDefaultWeapon()

function resolveEquippedWeapon(state: GameState) {
  return findWeapon(state.raid.equippedWeaponId) ?? DEFAULT_RAIDER_WEAPON
}

function resolveActivityWeapon(state: GameState, definition: RaidActivityDefinition) {
  return findWeapon(definition.weaponId) ?? resolveEquippedWeapon(state)
}

function normalizeActivityText(value: unknown): RaidActivityDefinition['text'] | null {
  if (typeof value === 'string') {
    return {
      started: value,
      progress: [value],
      completed: value,
      failed: value,
    }
  }

  if (Array.isArray(value)) {
    const lines = value.filter((line): line is string => typeof line === 'string')
    if (lines.length === 0) return null

    const started = lines[0]
    const completed = lines[lines.length - 1]
    const progressSource = lines.length > 2 ? lines.slice(1, -1) : lines
    const progress = progressSource.length > 0 ? progressSource : [started]

    return {
      started,
      progress,
      completed,
      failed: completed,
    }
  }

  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>

  const flattenTextValues = (input: Record<string, unknown>): string[] => {
    return Object.values(input).flatMap((entry): string[] => {
      if (typeof entry === 'string') return [entry]
      if (Array.isArray(entry)) {
        return entry.filter((line): line is string => typeof line === 'string')
      }

      return []
    })
  }

  const started = typeof candidate.started === 'string'
    ? candidate.started
    : null
  const completed = typeof candidate.completed === 'string'
    ? candidate.completed
    : null
  const failed = typeof candidate.failed === 'string'
    ? candidate.failed
    : null

  const progressRaw = candidate.progress
  const progress = Array.isArray(progressRaw)
    ? progressRaw.filter((line): line is string => typeof line === 'string')
    : typeof progressRaw === 'string'
      ? [progressRaw]
      : []

  if (!started || !completed || !failed || progress.length === 0) {
    const lines = flattenTextValues(candidate)
    if (lines.length === 0) return null

    const fallbackStarted = lines[0]
    const fallbackCompleted = lines[lines.length - 1]
    const fallbackProgressSource = lines.length > 2 ? lines.slice(1, -1) : lines
    const fallbackProgress = fallbackProgressSource.length > 0 ? fallbackProgressSource : [fallbackStarted]

    return {
      started: fallbackStarted,
      progress: fallbackProgress,
      completed: fallbackCompleted,
      failed: fallbackCompleted,
    }
  }

  return {
    started,
    progress,
    completed,
    failed,
  }
}

function normalizeRaidActivities(source: unknown): RaidActivityDefinition[] {
  if (!Array.isArray(source)) return []

  return source.flatMap((entry): RaidActivityDefinition[] => {
    if (!entry || typeof entry !== 'object') return []

    const candidate = entry as Partial<RaidActivityDefinition> & {
      parameters?: { weight?: number }
    }

    if (
      typeof candidate.id !== 'string'
      || typeof candidate.name !== 'string'
      || typeof candidate.kind !== 'string'
      || typeof candidate.ticks !== 'number'
      || !candidate.text
    ) {
      return []
    }

    const text = normalizeActivityText(candidate.text)
    if (!text) return []

    const {
      parameters,
      text: _text,
      weight: candidateWeight,
      ...rest
    } = candidate as Partial<RaidActivityDefinition> & {
      parameters?: { weight?: number }
      weight?: number
    }

    const weight = typeof candidateWeight === 'number'
      ? candidateWeight
      : parameters?.weight

    return [{
      ...(rest as Omit<RaidActivityDefinition, 'weight' | 'text'>),
      weight: typeof weight === 'number' ? weight : 100,
      text: {
        started: text.started,
        progress: text.progress,
        completed: text.completed,
        failed: text.failed,
      },
    }]
  })
}

export const raidActivities = [
  ...normalizeRaidActivities(raidActivitiesEncounters),
  ...normalizeRaidActivities(raidActivitiesSearches)
]

const healingItems = healingItemsData as HealingItem[]
const robots = robotsData as RobotEntry[]
const shieldRechargers = shieldRechargersData as ShieldRechargerItem[]
const searchLootTables: Record<string, LootItem[]> = {
  apparel_accessories: (apparelAccessoriesData as { items: LootItem[] }).items,
  arc_tech: (arcTechData as { items: LootItem[] }).items,
  consumables: (consumablesData as { items: LootItem[] }).items,
  cursed_weird_items: (cursedWeirdItemsData as { items: LootItem[] }).items,
  loot: (lootData as { items: LootItem[] }).items,
  personal_junk: (personalJunkData as { items: LootItem[] }).items,
  scrap_components: (scrapComponentsData as { items: LootItem[] }).items,
  valuables: (valuablesData as { items: LootItem[] }).items,
  weapons_parts: (weaponsPartsData as { items: LootItem[] }).items,
  water_bottles: (lootData as { items: LootItem[] }).items.filter(item => item.id.startsWith('water_bottle')),
}
const SEARCH_BONUS_HEALING_ITEM_CHANCE = 0.15
const MEDICAL_SEARCH_HEALING_ITEM_CHANCE = 1
const MAX_SEARCH_LOOT_ROLLS = 4

/** Merge one or more search loot table ids into a single pick pool. */
function resolveSearchLootTable(lootTableId: string | string[] | undefined): LootItem[] {
  if (lootTableId === undefined) return []
  const tableIds = Array.isArray(lootTableId) ? lootTableId : [lootTableId]
  return tableIds.flatMap(tableId => searchLootTables[tableId] ?? [])
}

/** Weighted search loot pick with danger-level, mood, and greed rarity biases applied. */
function pickSearchLootItem(lootTable: LootItem[], state: GameState, rng: RNG): LootItem {
  const profile = getDangerLevelProfile(state.raid.dangerLevel)
  return rng.weightedPick(lootTable.map(item => ({
    ...item,
    weight: item.weight
      * rarityWeight(profile, item.rarity)
      * getMoodRarityWeightMultiplier(item.rarity, state.raider.mood)
      * getGreedRarityWeightMultiplier(item.rarity, state.raid.greedLevel),
  })))
}
const ROBOT_HP_PER_MENACE = 6
const ROBOT_HP_DANGER_MULTIPLIER: Record<'Low' | 'Medium' | 'High', number> = {
  Low: 1,
  Medium: 1.35,
  High: 1.75,
}
const ROBOT_ROUND_DAMAGE_PER_MENACE = 0.35
const ROBOT_LETHAL_HP_RATIO = 0.5
const ROBOT_NONLETHAL_MIN_HP_RATIO = 0.25
const LETHAL_ROBOT_DEADLINESS: ReadonlySet<RobotEntry['deadliness']> = new Set(['nasty', 'deadly'])
const DANGER_DAMAGE_SWING_BASE: Record<'Low' | 'Medium' | 'High', number> = {
  Low: 0,
  Medium: 1,
  High: 2,
}
const DANGER_DAMAGE_SWING_MULTIPLIER: Record<'Low' | 'Medium' | 'High', number> = {
  Low: 0.5,
  Medium: 1,
  High: 1.5,
}
const RAIDER_LEVEL_DAMAGE_BONUS_PER_LEVEL = 0.008
const MOOD_DAMAGE_BONUS_PER_POINT = 0.01
const MOOD_DAMAGE_MULTIPLIER_MIN = 0.75
const MOOD_DAMAGE_MULTIPLIER_MAX = 1.35

export interface StartRaidActivityResult {
  state: GameState
  activityEvent: ActivityLogEvent
}

export interface AdvanceRaidActivityResult {
  state: GameState
  activityEvents: ActivityLogEvent[]
  blocking: boolean
  robotDefeatedId?: string
  robotSurvivedId?: string
  downedReason?: DownedReason
}

function normalizeArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

function matchesActivityContext(state: GameState, requires: RaidActivityDefinition['requires'] | StartRaidActivityEffect['robotPool']): boolean {
  if (!requires) return true

  const raiderLevel = getRaiderLevelBenefitProfile(state.raider.levelXp).level

  const dangerLevels = normalizeArray(requires.dangerLevel)
  if (dangerLevels.length > 0 && (!state.raid.dangerLevel || !dangerLevels.includes(state.raid.dangerLevel))) return false

  const zones = normalizeArray(requires.zone)
  if (zones.length > 0 && (!state.raid.zone || !zones.includes(state.raid.zone))) return false

  const zoneConditions = normalizeArray(requires.zoneCondition)
  if (zoneConditions.length > 0 && (!state.raid.zoneCondition || !zoneConditions.includes(state.raid.zoneCondition.id))) return false

  if (requires.minGreed !== undefined && state.raid.greedLevel < requires.minGreed) return false
  if (requires.maxGreed !== undefined && state.raid.greedLevel > requires.maxGreed) return false
  if (requires.minRaiderLevel !== undefined && raiderLevel < requires.minRaiderLevel) return false
  if (requires.maxRaiderLevel !== undefined && raiderLevel > requires.maxRaiderLevel) return false

  return true
}

function robotMatchesPool(robot: RobotEntry, state: GameState, pool: StartRaidActivityEffect['robotPool']): boolean {
  if (!matchesActivityContext(state, pool)) return false

  if (robot.isBoss && !pool?.includeBosses) return false

  if (!pool) return true
  const deadliness = normalizeArray(pool.deadliness)
  if (deadliness.length > 0 && !deadliness.includes(robot.deadliness)) return false

  return true
}

function selectRobot(
  state: GameState,
  definition: RaidActivityDefinition,
  effect: StartRaidActivityEffect,
  rng: RNG,
): RobotEntry | null {
  const fixedRobotId = effect.robotId ?? definition.robotId
  if (fixedRobotId) return robots.find(robot => robot.id === fixedRobotId) ?? null

  const pool = effect.robotPool ?? definition.robotPool
  const candidates = robots.filter(robot => robotMatchesPool(robot, state, pool))
  if (candidates.length === 0) return null
  return rng.weightedPick(candidates)
}

function robotMaxHp(robot: RobotEntry, dangerLevel: GameState['raid']['dangerLevel']): number {
  const baseHp = Math.max(6, robot.menace * ROBOT_HP_PER_MENACE)
  const profile = getDangerLevelProfile(dangerLevel)
  const multiplier = ROBOT_HP_DANGER_MULTIPLIER[profile.dangerLevel] ?? ROBOT_HP_DANGER_MULTIPLIER.Low
  return Math.max(6, Math.ceil(baseHp * multiplier))
}

function raiderLevelDamageMultiplier(levelXp: number): number {
  const level = getRaiderLevelBenefitProfile(levelXp).level
  return 1 + Math.max(0, level - 1) * RAIDER_LEVEL_DAMAGE_BONUS_PER_LEVEL
}

function raiderMoodDamageMultiplier(mood: number): number {
  const raw = 1 + mood * MOOD_DAMAGE_BONUS_PER_POINT
  return Math.max(MOOD_DAMAGE_MULTIPLIER_MIN, Math.min(MOOD_DAMAGE_MULTIPLIER_MAX, raw))
}

function activityLogEvent(
  activity: ActiveRaidActivity,
  status: ActivityLogEvent['status'],
  tick: number,
  now: number,
  text: string,
): ActivityLogEvent {
  const activityId = activity.robotId ? `${activity.id}_${activity.robotId}` : activity.id
  return {
    id: `activity_${activity.kind.toLowerCase()}_${activityId}_${status}`,
    activityId,
    activityName: activity.name,
    activity: activity.kind,
    status,
    tick,
    timestamp: now,
    text,
    phase: 'RAIDING',
    commsPriority: CommsPriority.Activity,
  }
}

function fillActivityText(
  text: string,
  values: Record<string, string | number>,
): string {
  return text.replace(/\{([^}]+)\}/g, (_match, key: string) => String(values[key] ?? `{${key}}`))
}

function robotLootToBackpackItem(item: RobotLootItem, robot: RobotEntry): BackpackItem {
  return {
    itemId: item.id,
    name: item.name,
    value: item.value,
    rarity: item.rarity ?? Math.max(1, Math.min(5, Math.ceil(robot.menace / 2))),
    flavor: item.flavor,
    quantity: 1,
  }
}

function lootItemToBackpackItem(item: LootItem): BackpackItem {
  return {
    itemId: item.id,
    name: item.name,
    value: item.value,
    rarity: item.rarity,
    flavor: item.flavor,
    quantity: 1,
  }
}

function shieldRechargerToBackpackItem(item: ShieldRechargerItem): BackpackItem {
  return {
    itemId: item.id,
    name: item.name,
    value: item.value,
    rarity: item.rarity,
    flavor: item.flavor,
    quantity: 1,
    kind: 'shield_recharger',
    shieldChargeAmount: item.chargeAmount,
    applyTicks: item.applyTicks,
  }
}

function addBackpackItem(raid: GameState['raid'], item: BackpackItem): GameState['raid'] {
  const existing = raid.backpack.find(entry => entry.itemId === item.itemId)
  const backpack = existing
    ? raid.backpack.map(entry => entry.itemId === item.itemId ? { ...entry, quantity: entry.quantity + 1 } : entry)
    : [...raid.backpack, item]

  return {
    ...raid,
    backpack,
    backpackValue: raid.backpackValue + item.value,
  }
}

function searchLootRollCount(activity: ActiveRaidActivity, definition: RaidActivityDefinition): number {
  const configuredRolls = activity.lootRolls ?? definition.lootRolls
  if (configuredRolls !== undefined) return Math.max(1, Math.min(MAX_SEARCH_LOOT_ROLLS, Math.floor(configuredRolls)))

  if (activity.totalTicks >= 4) return 4
  if (activity.totalTicks >= 3) return 3
  if (activity.totalTicks >= 2) return 2
  return 1
}

function formatLootList(items: BackpackItem[]): string {
  const counts = new Map<string, { name: string; quantity: number }>()
  for (const item of items) {
    const existing = counts.get(item.itemId)
    counts.set(item.itemId, {
      name: item.name,
      quantity: (existing?.quantity ?? 0) + item.quantity,
    })
  }

  const names = [...counts.values()].map(item => item.quantity > 1 ? `${item.quantity}x ${item.name}` : item.name)
  if (names.length <= 2) return names.join(' and ')
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

function addHealingItem(raid: GameState['raid'], item: HealingItem): GameState['raid'] {
  const existing = raid.healingItems.find(entry => entry.itemId === item.id)
  const nextHealingItems = existing
    ? raid.healingItems.map(entry => entry.itemId === item.id ? { ...entry, quantity: entry.quantity + 1 } : entry)
    : [...raid.healingItems, {
        itemId: item.id,
        name: item.name,
        healAmount: item.healAmount,
        reviveAmount: item.reviveAmount,
        moodGain: item.moodGain,
        rarity: item.rarity,
        flavor: item.flavor,
        quantity: 1,
      }]

  return { ...raid, healingItems: nextHealingItems }
}

function rollSearchHealingItem(raid: GameState['raid'], rng: RNG, chance: number): { raid: GameState['raid']; item: HealingItem | null } {
  if (rng.next() >= chance) return { raid, item: null }

  const item = rng.weightedPick(healingItems)
  return {
    raid: addHealingItem(raid, item),
    item,
  }
}

function appendSearchHealingText(text: string, item: HealingItem | null): string {
  return item
    ? `${text} Bonus med find: tucked ${item.name} into the current-raid med pocket.`
    : text
}

function canRobotEncounterBeLethal(state: GameState, robot: RobotEntry): boolean {
  if (!LETHAL_ROBOT_DEADLINESS.has(robot.deadliness)) return false
  if (state.raider.maxHp <= 0) return false
  return state.raider.hp / state.raider.maxHp <= ROBOT_LETHAL_HP_RATIO
}

function applyRobotRoundDamage(state: GameState, robot: RobotEntry, activity: ActiveRaidActivity, rng: RNG): ShieldDamageResult {
  const profile = getDangerLevelProfile(state.raid.dangerLevel)
  const multiplier = Math.max(0, (activity.robotDamageMultiplier ?? 1) * profile.robotFailureDamageMultiplier)
  const expectedDamage = Math.max(1, Math.ceil(robot.menace * ROBOT_ROUND_DAMAGE_PER_MENACE * multiplier))
  const baseSwing = DANGER_DAMAGE_SWING_BASE[profile.dangerLevel] ?? DANGER_DAMAGE_SWING_BASE.Low
  const swingMultiplier = DANGER_DAMAGE_SWING_MULTIPLIER[profile.dangerLevel] ?? DANGER_DAMAGE_SWING_MULTIPLIER.Low
  const enemySwing = Math.max(1, Math.ceil(robot.menace / 2))
  const totalSwing = Math.max(1, baseSwing + Math.ceil(enemySwing * swingMultiplier))
  const minIncomingDamage = Math.max(1, expectedDamage - totalSwing)
  const maxIncomingDamage = Math.max(minIncomingDamage, expectedDamage + totalSwing)
  const rolledDamage = rng.int(minIncomingDamage, maxIncomingDamage)
  const incomingDamage = Math.max(minIncomingDamage, Math.min(maxIncomingDamage, rolledDamage))
  const skillMultiplier = getSkillModifierProfile(state.raider.skills).robotFailureDamageMultiplier
  const damageAfterSkills = Math.max(0, Math.ceil(incomingDamage * skillMultiplier))
  const skillDamageReduced = Math.max(0, incomingDamage - damageAfterSkills)
  const resilienceReductionPercent = getMoodResilienceReductionPercent(state.raider.mood) + getRaiderLevelBenefitProfile(state.raider.levelXp).resilienceReductionPercent
  const preShieldDamage = resilienceReductionPercent > 0 && damageAfterSkills > 0
    ? Math.max(1, Math.floor(damageAfterSkills * (1 - (resilienceReductionPercent / 100))))
    : damageAfterSkills
  const resilienceDamageReduced = Math.max(0, damageAfterSkills - preShieldDamage)
  const shielded = applyShieldedDamage(state.raider, state.raid, preShieldDamage)
  const shieldDamage: ShieldDamageResult = {
    ...shielded,
    incomingDamage,
    preShieldDamage,
    preShieldDamageReduced: incomingDamage - preShieldDamage,
    resilienceDamageReduced: resilienceDamageReduced > 0 ? resilienceDamageReduced : undefined,
    skillDamageReduced: skillDamageReduced > 0 ? skillDamageReduced : undefined,
  }

  if (state.raider.maxHp <= 0 || canRobotEncounterBeLethal(state, robot)) return shieldDamage

  const hpAfterShield = shieldDamage.raider.hp
  const nonlethalFloor = state.raider.hp / state.raider.maxHp > ROBOT_LETHAL_HP_RATIO
    ? Math.ceil(state.raider.maxHp * ROBOT_NONLETHAL_MIN_HP_RATIO)
    : 1
  const hp = Math.max(nonlethalFloor, hpAfterShield)
  const nonlethalFloorDamagePrevented = Math.max(0, hp - hpAfterShield)

  return {
    ...shieldDamage,
    raider: { ...shieldDamage.raider, hp },
    hpDamage: state.raider.hp - hp,
    nonlethalFloorDamagePrevented: nonlethalFloorDamagePrevented > 0 ? nonlethalFloorDamagePrevented : undefined,
  }
}

export function startRaidActivity(
  state: GameState,
  effect: StartRaidActivityEffect,
  rng: RNG,
  now: number,
): StartRaidActivityResult | null {
  if (state.raid.phase !== 'RAIDING' || state.raid.activeRaidActivity) return null

  const definition = raidActivities.find(activity => activity.id === effect.activityId)
  if (!definition) return null
  if (!matchesActivityContext(state, definition.requires)) return null

  if (definition.kind === 'SEARCH') {
    const activeActivity: ActiveRaidActivity = {
      id: definition.id,
      name: definition.name,
      kind: definition.kind,
      ticksRemaining: definition.ticks,
      totalTicks: definition.ticks,
      healingItem: effect.healingItem ?? definition.healingItem,
      lootTableId: effect.lootTableId ?? definition.lootTableId,
      lootRolls: effect.lootRolls ?? definition.lootRolls,
      shieldRecharger: effect.shieldRecharger ?? definition.shieldRecharger,
      raiderAction: 'searching',
    }

    return {
      state: {
        ...state,
        raid: {
          ...state.raid,
          activeRaidActivity: activeActivity,
        },
      },
      activityEvent: activityLogEvent(activeActivity, 'started', state.tick, now, definition.text.started),
    }
  }

  if (definition.kind === 'EXTRACTION') {
    const activeActivity: ActiveRaidActivity = {
      id: definition.id,
      name: definition.name,
      kind: definition.kind,
      ticksRemaining: 0,
      totalTicks: definition.ticks,
    }
    const hazardDamage = Math.max(0, effect.hazardDamage ?? definition.hazardDamage ?? 0)
    const shieldDamage = applyShieldedDamage(state.raider, state.raid, hazardDamage)
    const text = fillActivityText(definition.text.completed, {
      damage_summary: describeShieldDamage(shieldDamage),
    })

    return {
      state: {
        ...state,
        raider: shieldDamage.raider,
        raid: shieldDamage.raid,
      },
      activityEvent: activityLogEvent(activeActivity, 'completed', state.tick, now, text),
    }
  }

  if (definition.kind !== 'ROBOT_ENCOUNTER') return null

  const robot = selectRobot(state, definition, effect, rng)
  if (!robot) return null

  const activeWeapon = resolveActivityWeapon(state, definition)
  const activeActivity: ActiveRaidActivity = {
    id: definition.id,
    name: `${definition.name}: ${robot.name}`,
    kind: definition.kind,
    ticksRemaining: definition.ticks,
    totalTicks: definition.ticks,
    robotId: robot.id,
    robotHp: robotMaxHp(robot, state.raid.dangerLevel),
    robotMaxHp: robotMaxHp(robot, state.raid.dangerLevel),
    weaponId: activeWeapon.id,
    weaponName: activeWeapon.name,
    raiderBaseDamage: Math.max(1, definition.raiderBaseDamage ?? effect.raiderBaseDamage ?? activeWeapon.damage),
    raiderDamageMultiplier: Math.max(0.01, (definition.raiderDamageMultiplier ?? effect.raiderDamageMultiplier ?? 1) * (activeWeapon.damageMultiplier ?? 1)),
    robotDamageTakenMultiplier: Math.max(0.01, effect.robotDamageTakenMultiplier ?? definition.robotDamageTakenMultiplier ?? 1),
    robotDamageMultiplier: effect.robotDamageMultiplier,
    raiderAction: 'fighting',
  }
  const text = fillActivityText(definition.text.started, {
    robot_name: robot.name,
    weapon_name: activeWeapon.name,
  })

  return {
    state: {
      ...state,
      raid: {
        ...state.raid,
        activeRaidActivity: activeActivity,
      },
    },
    activityEvent: activityLogEvent(activeActivity, 'started', state.tick, now, text),
  }
}

export function advanceRaidActivity(state: GameState, rng: RNG, now: number): AdvanceRaidActivityResult {
  const activity = state.raid.activeRaidActivity
  if (!activity) {
    return { state, activityEvents: [], blocking: false }
  }

  if (activity.kind === 'SEARCH') {
    return advanceSearchActivity(state, activity, rng, now)
  }

  if (activity.kind !== 'ROBOT_ENCOUNTER') {
    return { state, activityEvents: [], blocking: false }
  }

  const definition = raidActivities.find(entry => entry.id === activity.id)
  const robot = robots.find(entry => entry.id === activity.robotId)
  if (!definition || !robot) {
    return {
      state: { ...state, raid: { ...state.raid, activeRaidActivity: null } },
      activityEvents: [activityLogEvent(activity, 'failed', state.tick, now, 'Robot encounter failed: missing activity data. Raider blamed the clipboard.')],
      blocking: true,
      robotSurvivedId: activity.robotId,
    }
  }

  const baseDamage = Math.max(1, activity.raiderBaseDamage ?? DEFAULT_RAIDER_WEAPON.damage)
  const weaponDamageMultiplier = Math.max(0.01, activity.raiderDamageMultiplier ?? 1)
  const levelDamageMultiplier = raiderLevelDamageMultiplier(state.raider.levelXp)
  const moodDamageMultiplier = raiderMoodDamageMultiplier(state.raider.mood)
  const activityDamageMultiplier = Math.max(0.01, activity.robotDamageTakenMultiplier ?? 1)
  const rawRaiderDamage = baseDamage * weaponDamageMultiplier * levelDamageMultiplier * moodDamageMultiplier * activityDamageMultiplier
  const raiderDamage = Math.max(1, Math.ceil(rawRaiderDamage))
  const nextRobotHp = Math.max(0, (activity.robotHp ?? robotMaxHp(robot, state.raid.dangerLevel)) - raiderDamage)

  if (nextRobotHp <= 0) {
    const loot = robotLootToBackpackItem(rng.weightedPick(robot.lootTable), robot)
    const nextRaid = addBackpackItem({ ...state.raid, activeRaidActivity: null }, loot)
    const text = fillActivityText(definition.text.completed, {
      robot_name: robot.name,
      weapon_name: activity.weaponName ?? DEFAULT_RAIDER_WEAPON.name,
      raider_damage: raiderDamage,
      robot_hp: 0,
      robot_max_hp: activity.robotMaxHp ?? robotMaxHp(robot, state.raid.dangerLevel),
      loot_name: loot.name,
    })
    return {
      state: { ...state, raid: nextRaid },
      activityEvents: [activityLogEvent(activity, 'completed', state.tick, now, text)],
      blocking: true,
      robotDefeatedId: robot.id,
    }
  }

  const shieldDamage = applyRobotRoundDamage(state, robot, activity, rng)
  const nextActivity = {
    ...activity,
    robotHp: nextRobotHp,
    ticksRemaining: Math.max(0, activity.ticksRemaining - 1),
  }
  const robotDamageSummary = describeShieldDamage(shieldDamage)
  const downedReason: DownedReason | undefined = shieldDamage.raider.hp <= 0
    ? {
        kind: 'robot',
        text: `${robot.name} downed the Raider during the exchange. ${robotDamageSummary}`,
        robotId: robot.id,
        robotName: robot.name,
        activityId: activity.id,
        damageSummary: robotDamageSummary,
      }
    : undefined

  const text = fillActivityText(rng.pick(definition.text.progress), {
    robot_name: robot.name,
    weapon_name: activity.weaponName ?? DEFAULT_RAIDER_WEAPON.name,
    raider_damage: raiderDamage,
    robot_hp: nextRobotHp,
    robot_max_hp: activity.robotMaxHp ?? robotMaxHp(robot, state.raid.dangerLevel),
    robot_damage_summary: robotDamageSummary,
  })

  return {
    state: {
      ...state,
      raider: shieldDamage.raider,
      raid: { ...shieldDamage.raid, activeRaidActivity: downedReason ? null : nextActivity },
    },
    activityEvents: [activityLogEvent(activity, 'progress', state.tick, now, text)],
    blocking: true,
    downedReason,
  }
}

function advanceSearchActivity(
  state: GameState,
  activity: ActiveRaidActivity,
  rng: RNG,
  now: number,
): AdvanceRaidActivityResult {
  const definition = raidActivities.find(entry => entry.id === activity.id)
  const blocking = definition?.blocking ?? false
  if (!definition || definition.kind !== 'SEARCH') {
    return {
      state: { ...state, raid: { ...state.raid, activeRaidActivity: null } },
      activityEvents: [activityLogEvent(activity, 'failed', state.tick, now, 'Search activity failed: missing activity data. Raider blamed the filing system.')],
      blocking,
    }
  }

  const nextTicksRemaining = Math.max(0, activity.ticksRemaining - 1)
  if (nextTicksRemaining <= 0) {
    if (activity.shieldRecharger ?? definition.shieldRecharger) {
      const shieldRecharger = rng.weightedPick(shieldRechargers)
      const backpackItem = shieldRechargerToBackpackItem(shieldRecharger)
      const nextRaid = addBackpackItem({ ...state.raid, activeRaidActivity: null }, backpackItem)
      const healingRoll = rollSearchHealingItem(nextRaid, rng, SEARCH_BONUS_HEALING_ITEM_CHANCE)
      const text = appendSearchHealingText(fillActivityText(definition.text.completed, {
        shield_recharger: shieldRecharger.name,
        ticks_remaining: 0,
      }), healingRoll.item)

      return {
        state: { ...state, raid: healingRoll.raid },
        activityEvents: [activityLogEvent(activity, 'completed', state.tick, now, text)],
        blocking,
      }
    }

    if (activity.healingItem ?? definition.healingItem) {
      const healingRoll = rollSearchHealingItem({ ...state.raid, activeRaidActivity: null }, rng, MEDICAL_SEARCH_HEALING_ITEM_CHANCE)
      const text = fillActivityText(definition.text.completed, {
        healing_item: healingRoll.item?.name ?? 'field meds',
        ticks_remaining: 0,
      })

      return {
        state: { ...state, raid: healingRoll.raid },
        activityEvents: [activityLogEvent(activity, 'completed', state.tick, now, text)],
        blocking,
      }
    }

    const lootTableId = activity.lootTableId ?? definition.lootTableId
    const lootTable = resolveSearchLootTable(lootTableId)
    if (lootTable.length === 0) {
      return {
        state: { ...state, raid: { ...state.raid, activeRaidActivity: null } },
        activityEvents: [activityLogEvent(activity, 'failed', state.tick, now, fillActivityText(definition.text.failed, { loot_table: Array.isArray(lootTableId) ? lootTableId.join(', ') : lootTableId ?? 'unknown' }))],
        blocking,
      }
    }

    const lootItems = Array.from({ length: searchLootRollCount(activity, definition) }, () => lootItemToBackpackItem(pickSearchLootItem(lootTable, state, rng)))
    const nextRaid = lootItems.reduce<GameState['raid']>(
      (raid, loot) => addBackpackItem(raid, loot),
      { ...state.raid, activeRaidActivity: null },
    )
    const healingRoll = rollSearchHealingItem(nextRaid, rng, SEARCH_BONUS_HEALING_ITEM_CHANCE)
    const text = appendSearchHealingText(fillActivityText(definition.text.completed, {
      loot_name: formatLootList(lootItems),
      loot_count: lootItems.length,
      ticks_remaining: 0,
    }), healingRoll.item)

    return {
      state: { ...state, raid: healingRoll.raid },
      activityEvents: [activityLogEvent(activity, 'completed', state.tick, now, text)],
      blocking,
    }
  }

  const nextActivity = {
    ...activity,
    ticksRemaining: nextTicksRemaining,
  }
  const text = fillActivityText(rng.pick(definition.text.progress), {
    ticks_remaining: nextTicksRemaining,
  })

  return {
    state: {
      ...state,
      raid: {
        ...state.raid,
        activeRaidActivity: nextActivity,
      },
    },
    activityEvents: [activityLogEvent(activity, 'progress', state.tick, now, text)],
    blocking,
  }
}