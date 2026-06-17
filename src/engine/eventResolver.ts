/**
 * Event resolver — picks a weighted event template valid for the current context
 * and fills {slot} placeholders from content tables.
 *
 * Slot resolution order:
 *   1. Named flavor tables in flavor.json  (e.g. {hub_gossip}, {death_quip})
 *   2. {mundane_item}  → random loot item name
 *   3. {water_item}    → random water-bottle loot item name
 *   4. {healing_item} → random bandage name from healing_items.json
 *   5. {robot_flavor_<id>} → random flavor line from matching robot entry
 *   6. {count}         → random plausible water-bottle count (for flavor)
 */

import type { EventTemplate, GameState, HealingItem, HealingItemStack, LogEvent, LootItem, Phase, RobotEntry, RobotLootItem, ShieldRechargerItem } from './types.js'
import type { RNG } from './rng.js'
import hubEventsData from '../content/hub_events.json'
import deploymentEventsData from '../content/deployment_events.json'
import raidingEventsData from '../content/raiding_events.json'
import extractionEventsData from '../content/extraction_events.json'
import downedEventsData from '../content/downed_events.json'
import healingItemsData from '../content/healing_items.json'
import shieldRechargersData from '../content/shield_rechargers.json'
import robotsData from '../content/robots.json'
import flavorData from '../content/flavor.json'
<<<<<<< HEAD
import apparelAccessoriesData from '../content/loot-tables/apparel_accessories.json'
import arcTechData from '../content/loot-tables/arc_tech.json'
import consumablesData from '../content/loot-tables/consumables.json'
import cursedWeirdItemsData from '../content/loot-tables/cursed_weird_items.json'
import lootData from '../content/loot-tables/loot.json'
import personalJunkData from '../content/loot-tables/personal_junk.json'
import scrapComponentsData from '../content/loot-tables/scrap_components.json'
import valuablesData from '../content/loot-tables/valuables.json'
import weaponsPartsData from '../content/loot-tables/weapons_parts.json'
import { getDangerLevelProfile, rarityWeight, type DangerLevelProfile } from './dangerLevelProfiles.js'
import { applyShieldedDamage, startShieldRecharge } from './shields.js'
=======
import { getTimeOfDayProfile, rarityWeight, type TimeOfDayProfile } from './timeProfiles.js'
import { applyShieldedDamage, startShieldRecharge, type ShieldDamageResult } from './shields.js'
>>>>>>> origin/main

// One events file per phase: HUB, DEPLOYING, RAIDING, EXTRACTING, DOWNED
const events = [
  ...hubEventsData,
  ...deploymentEventsData,
  ...raidingEventsData,
  ...extractionEventsData,
  ...downedEventsData,
] as EventTemplate[]
const baseLoot = [
  ...(apparelAccessoriesData as { items: LootItem[] }).items,
  ...(arcTechData as { items: LootItem[] }).items,
  ...(consumablesData as { items: LootItem[] }).items,
  ...(cursedWeirdItemsData as { items: LootItem[] }).items,
  ...(lootData as { items: LootItem[] }).items,
  ...(personalJunkData as { items: LootItem[] }).items,
  ...(scrapComponentsData as { items: LootItem[] }).items,
  ...(valuablesData as { items: LootItem[] }).items,
  ...(weaponsPartsData as { items: LootItem[] }).items,
]
const healingItems = healingItemsData as HealingItem[]
const shieldRechargers = shieldRechargersData as ShieldRechargerItem[]
const robots = robotsData as RobotEntry[]
const flavor = flavorData as Record<string, Array<{ id: string; weight: number; text: string }>>

function rarityFromMenace(menace: number): number {
  return Math.max(1, Math.min(5, Math.ceil(menace / 2)))
}

function toLootItem(item: RobotLootItem, robot: RobotEntry): LootItem {
  return {
    ...item,
    rarity: item.rarity ?? rarityFromMenace(robot.menace),
  }
}

function mergeLootTables(items: LootItem[]): LootItem[] {
  const merged = new Map<string, LootItem>()
  for (const item of items) {
    const existing = merged.get(item.id)
    if (existing) {
      merged.set(item.id, { ...existing, weight: existing.weight + item.weight })
    } else {
      merged.set(item.id, { ...item })
    }
  }
  return [...merged.values()]
}

const robotLoot = robots.flatMap(robot => robot.lootTable.map(item => toLootItem(item, robot)))
const loot = mergeLootTables([...baseLoot, ...robotLoot])

const ROBOT_LETHAL_HP_RATIO = 0.5
const ROBOT_NONLETHAL_MIN_HP_RATIO = 0.25
const ROBOT_DAMAGE_PER_MENACE = 2
const LETHAL_ROBOT_DEADLINESS: ReadonlySet<RobotEntry['deadliness']> = new Set(['nasty', 'deadly'])

function clampMood(mood: number): number {
  return Math.max(-5, Math.min(5, mood))
}

function healingMoodGain(item: HealingItemStack): number {
  return item.moodGain ?? Math.max(1, Math.min(4, item.rarity))
}

export function describeShieldDamage(damage: ShieldDamageResult): string {
  if (!damage.mitigated || damage.shieldChargeLost <= 0) {
    return `Took ${damage.hpDamage} damage.`
  }

  if (damage.hpDamage <= 0) {
    return `Shield lost ${damage.shieldChargeLost} charge. No HP damage landed.`
  }

  return `Shield lost ${damage.shieldChargeLost} charge; ${damage.hpDamage} HP damage landed.`
}

/** Filter events valid for the current game context */
function eligibleEvents(state: GameState): EventTemplate[] {
  const { raid } = state
  return events.filter(ev => {
    const r = ev.requires
    if (!r) return true
    if (r.phase) {
      const phases: Phase[] = Array.isArray(r.phase) ? r.phase : [r.phase]
      if (!phases.includes(raid.phase)) return false
    }
    if (r.dangerLevel) {
      if (!raid.dangerLevel) return false
      const levels = Array.isArray(r.dangerLevel) ? r.dangerLevel : [r.dangerLevel]
      if (!levels.includes(raid.dangerLevel)) return false
    }
    if (r.minGreed !== undefined && raid.greedLevel < r.minGreed) return false
    if (r.maxGreed !== undefined && raid.greedLevel > r.maxGreed) return false
    if (r.minHp !== undefined && state.raider.hp < r.minHp) return false
    if (r.maxHp !== undefined && state.raider.hp > r.maxHp) return false
    return true
  })
}

function isNegativeHpEffect(hp: number | string | undefined): boolean {
  if (hp === undefined) return false
  if (typeof hp === 'number') return hp < 0
  return hp.trim().startsWith('-')
}

// review and test in future 
function isPositiveDamageEffect(damage: number | string | undefined): boolean {
  if (damage === undefined) return false
  if (typeof damage === 'number') return damage > 0
  const trimmed = damage.trim()
  const match = trimmed.match(/^([+-]?\d+)(?:d(\d+))?$/)
  if (!match) return false

  const base = parseInt(match[1], 10)
  const die = match[2] ? parseInt(match[2], 10) : 0
  if (die <= 0) return base > 0

  // Dice expressions can still resolve to damage when non-negative base + die are used.
  return base >= 0
}

function isRiskyExtractionEvent(template: EventTemplate): boolean {
  const effects = template.effects
  if (!effects) return false
  return effects.forcePhase === 'RAIDING' ||
    effects.forcePhase === 'DOWNED' ||
    effects.robotEncounter !== undefined ||
    isPositiveDamageEffect(effects.damage) ||
    isNegativeHpEffect(effects.hp)
}

function isSafeExtractionEvent(template: EventTemplate): boolean {
  const effects = template.effects
  if (!effects) return false
  return effects.forcePhase === 'HUB' || (!isRiskyExtractionEvent(template) && (effects.mood ?? 0) > 0)
}

function adjustedEventWeight(template: EventTemplate, state: GameState): number {
  const profile = getDangerLevelProfile(state.raid.dangerLevel)
  let weight = template.weight

  if (template.effects?.robotEncounter) {
    weight *= profile.robotEncounterWeightMultiplier
  }

  if (state.raid.phase === 'EXTRACTING') {
    if (isRiskyExtractionEvent(template)) {
      weight *= profile.extractionRiskEventWeightMultiplier
    } else if (isSafeExtractionEvent(template)) {
      weight *= profile.extractionSafeEventWeightMultiplier
    }
  }

  return Math.max(0.001, weight)
}

/** Fill {slot} placeholders in a template string */
function fillSlots(text: string, rng: RNG): string {
  return text.replace(/\{([^}]+)\}/g, (_match, slot: string) => {
    // Named flavor tables
    if (slot in flavor) {
      const table = flavor[slot]
      const entry = rng.weightedPick(table)
      // Recursively fill any nested slots in the chosen flavor text
      return fillSlots(entry.text, rng)
    }

    // Robot flavor slots: {robot_flavor_<robotId>}
    if (slot.startsWith('robot_flavor_')) {
      const robotId = slot.replace('robot_flavor_', '')
      const robot = robots.find(r => r.id === robotId)
      if (robot) return rng.pick(robot.flavorLines)
    }

    // Mundane item slot — any loot item, including robot salvage
    if (slot === 'mundane_item') {
      const item = rng.weightedPick(loot)
      return item.name
    }

    // Water item slot — only water bottle items
    if (slot === 'water_item') {
      const waterItems = loot.filter(l => l.id.startsWith('water_bottle'))
      if (waterItems.length > 0) {
        return rng.weightedPick(waterItems).name
      }
      return rng.weightedPick(loot).name
    }

    // Healing item slot — current-raid-only bandages
    if (slot === 'healing_item') {
      const item = rng.weightedPick(healingItems)
      return item.name
    }

    // Plausible water-bottle count for flavor
    if (slot === 'count') {
      return String(rng.int(3, 80))
    }

    // Unknown slot — return placeholder as-is so tests catch missing slots
    return `{${slot}}`
  })
}

function weightedLootPick(items: LootItem[], rng: RNG, profile: DangerLevelProfile): LootItem {
  return rng.weightedPick(items.map(item => ({
    ...item,
    weight: item.weight * rarityWeight(profile, item.rarity),
  })))
}

function pickLootItemForValue(targetValue: number, rng: RNG, profile: DangerLevelProfile): LootItem {
  const exactMatches = loot.filter(item => item.value === targetValue)
  if (exactMatches.length > 0) {
    return weightedLootPick(exactMatches, rng, profile)
  }

  const lowerMatches = loot.filter(item => item.value <= targetValue)
  if (lowerMatches.length > 0) {
    const highestValue = Math.max(...lowerMatches.map(item => item.value))
    const bestMatches = lowerMatches.filter(item => item.value === highestValue)
    return weightedLootPick(bestMatches, rng, profile)
  }

  return weightedLootPick(loot, rng, profile)
}

function addBackpackItem(
  raid: GameState['raid'],
  item: LootItem | ShieldRechargerItem,
): GameState['raid'] {
  const existing = raid.backpack.find(entry => entry.itemId === item.id)
  const extraFields = 'chargeAmount' in item
    ? {
        kind: 'shield_recharger' as const,
        shieldChargeAmount: item.chargeAmount,
        applyTicks: item.applyTicks,
      }
    : {}
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
        ...extraFields,
      }]

  return {
    ...raid,
    backpack,
    backpackValue: raid.backpackValue + item.value,
  }
}

function removeBackpackItem(
  raid: GameState['raid'],
  itemId: string,
): GameState['raid'] {
  const current = raid.backpack.find(entry => entry.itemId === itemId)
  if (!current) return raid

  const backpack = current.quantity <= 1
    ? raid.backpack.filter(entry => entry.itemId !== itemId)
    : raid.backpack.map(entry => (
        entry.itemId === itemId
          ? { ...entry, quantity: entry.quantity - 1 }
          : entry
      ))

  return {
    ...raid,
    backpack,
    hiddenPocket: current.quantity <= 1 && raid.hiddenPocket?.itemId === itemId
      ? null
      : raid.hiddenPocket,
  }
}

function addHealingItem(
  raid: GameState['raid'],
  item: HealingItem,
): GameState['raid'] {
  const existing = raid.healingItems.find(entry => entry.itemId === item.id)
  const healingItems = existing
    ? raid.healingItems.map(entry => (
        entry.itemId === item.id
          ? { ...entry, quantity: entry.quantity + 1 }
          : entry
      ))
    : [...raid.healingItems, {
        itemId: item.id,
        name: item.name,
        healAmount: item.healAmount,
        moodGain: item.moodGain,
        rarity: item.rarity,
        flavor: item.flavor,
        quantity: 1,
      }]

  return { ...raid, healingItems }
}

function removeHealingItem(
  raid: GameState['raid'],
  item: HealingItemStack,
): GameState['raid'] {
  const healingItems = item.quantity <= 1
    ? raid.healingItems.filter(entry => entry.itemId !== item.itemId)
    : raid.healingItems.map(entry => (
        entry.itemId === item.itemId
          ? { ...entry, quantity: entry.quantity - 1 }
          : entry
      ))

  return { ...raid, healingItems }
}

export interface HealingItemResult {
  state: GameState
  event: LogEvent
}

export interface BackpackConsumableResult {
  state: GameState
  event: LogEvent
}

/** Finds one bandage for this raid only. It is not backpack loot and never extracts home. */
export function resolveHealingItemFind(
  state: GameState,
  rng: RNG,
  now: number,
): HealingItemResult {
  const item = rng.weightedPick(healingItems)
  return {
    state: { ...state, raid: addHealingItem(state.raid, item) },
    event: {
      id: `healing_${item.id}_found`,
      tick: state.tick,
      timestamp: now,
      text: `Found ${item.name}. Tucked it into the current-raid med pocket.`,
      phase: state.raid.phase,
    },
  }
}

export function resolveShieldRechargerFind(
  state: GameState,
  rng: RNG,
  now: number,
): BackpackConsumableResult {
  const item = rng.weightedPick(shieldRechargers)
  return {
    state: { ...state, raid: addBackpackItem(state.raid, item) },
    event: {
      id: `shield_recharger_${item.id}_found`,
      tick: state.tick,
      timestamp: now,
      text: `Found ${item.name}. Into the backpack it goes for a future defensive emergency.`,
      phase: state.raid.phase,
    },
  }
}

/** Uses one specific current-raid bandage if the raider is hurt and alive. */
export function consumeHealingItem(
  state: GameState,
  itemId: string,
  now: number,
): HealingItemResult | null {
  if (state.raid.phase === 'HUB' || state.raid.phase === 'DOWNED') return null
  if (state.raider.hp <= 0 || state.raider.hp >= state.raider.maxHp) return null
  if (state.raid.healingItems.length === 0) return null

  const item = state.raid.healingItems.find(entry => entry.itemId === itemId)
  if (!item) return null
  const missingHp = state.raider.maxHp - state.raider.hp
  const healed = Math.min(50, item.healAmount, missingHp)
  const moodGain = healingMoodGain(item)
  const hp = Math.min(state.raider.maxHp, state.raider.hp + healed)
  const mood = clampMood(state.raider.mood + moodGain)

  return {
    state: {
      ...state,
      raider: { ...state.raider, hp, mood },
      raid: removeHealingItem(state.raid, item),
    },
    event: {
      id: `healing_${item.itemId}_used`,
      tick: state.tick,
      timestamp: now,
      text: `Used ${item.name}. Restored ${healed} HP and gained ${moodGain} mood. Medical dignity restored to acceptable levels.`,
      phase: state.raid.phase,
    },
  }
}

export function consumeShieldRecharger(
  state: GameState,
  itemId: string,
  now: number,
): BackpackConsumableResult | null {
  if (state.raid.phase !== 'RAIDING') return null
  if (!state.raid.shield || state.raid.shield.durability <= 0) return null
  if (state.raid.shield.charge >= state.raid.shield.maxCharge) return null
  if (state.raid.activeShieldRecharge) return null

  const item = state.raid.backpack.find(entry => entry.itemId === itemId)
  if (!item || item.kind !== 'shield_recharger' || !item.shieldChargeAmount) return null

  const start = startShieldRecharge(state.raid, {
    itemId: item.itemId,
    name: item.name,
    chargeAmount: item.shieldChargeAmount,
    applyTicks: item.applyTicks,
  })
  if (start.startedCharge <= 0) return null

  const baseRaid = {
    ...removeBackpackItem(start.raid, item.itemId),
    backpackValue: Math.max(0, state.raid.backpackValue - item.value),
  }

  const eventText = start.completedImmediately
    ? `Used ${item.name}. Restored ${start.startedCharge} shield charge instantly. Confidence field humming again.`
    : `Used ${item.name}. Shield recharge started and will fill over ${start.raid.activeShieldRecharge!.totalTicks} ticks. The slider is doing tiny heroic work.`

  return {
    state: {
      ...state,
      raid: baseRaid,
    },
    event: {
      id: start.completedImmediately
        ? `shield_recharger_${item.itemId}_used`
        : `shield_recharger_${item.itemId}_started`,
      tick: state.tick,
      timestamp: now,
      text: eventText,
      phase: state.raid.phase,
    },
  }
}

function pickRobotLoot(robot: RobotEntry, rng: RNG): LootItem {
  const item = rng.weightedPick(robot.lootTable)
  return toLootItem(item, robot)
}

function canRobotEncounterBeLethal(state: GameState, robot: RobotEntry): boolean {
  if (!LETHAL_ROBOT_DEADLINESS.has(robot.deadliness)) return false
  if (state.raider.maxHp <= 0) return false
  return state.raider.hp / state.raider.maxHp <= ROBOT_LETHAL_HP_RATIO
}

function applyRobotDamage(
  state: GameState,
  robot: RobotEntry,
  rawDamage: number,
): { raider: GameState['raider']; raid: GameState['raid']; damage: number; shieldDamage: ShieldDamageResult } {
  if (state.raider.hp <= 0) {
    return {
      raider: state.raider,
      raid: state.raid,
      damage: 0,
      shieldDamage: {
        raider: state.raider,
        raid: state.raid,
        hpDamage: 0,
        shieldChargeLost: 0,
        shieldDurabilityLost: 0,
        mitigated: false,
      },
    }
  }

  const shielded = applyShieldedDamage(state.raider, state.raid, rawDamage)
  if (state.raider.maxHp <= 0) {
    return {
      raider: shielded.raider,
      raid: shielded.raid,
      damage: state.raider.hp - shielded.raider.hp,
      shieldDamage: shielded,
    }
  }

  let hp = shielded.raider.hp
  if (!canRobotEncounterBeLethal(state, robot)) {
    const nonlethalFloor = state.raider.hp / state.raider.maxHp > ROBOT_LETHAL_HP_RATIO
      ? Math.ceil(state.raider.maxHp * ROBOT_NONLETHAL_MIN_HP_RATIO)
      : 1
    hp = Math.max(nonlethalFloor, hp)
  }

  return {
    raider: { ...shielded.raider, hp },
    raid: shielded.raid,
    damage: state.raider.hp - hp,
    shieldDamage: {
      ...shielded,
      raider: { ...shielded.raider, hp },
      hpDamage: state.raider.hp - hp,
    },
  }
}

export interface RobotEncounterResult {
  state: GameState
  event: LogEvent
}

/**
 * Placeholder robot combat: roll 1-10, beat menace to win. Future weapons can
 * replace the roll/modifier here without changing event content.
 */
export function resolveRobotEncounter(
  state: GameState,
  robotId: string,
  rng: RNG,
  now: number,
  opts: { damageMultiplier?: number } = {},
): RobotEncounterResult | null {
  const robot = robots.find(entry => entry.id === robotId)
  if (!robot) return null

  const roll = rng.int(1, 10)
  if (roll > robot.menace) {
    const item = pickRobotLoot(robot, rng)
    const raid = addBackpackItem(state.raid, item)
    const successText = rng.pick(robot.successText)
    return {
      state: { ...state, raid },
      event: {
        id: `robot_${robot.id}_defeated`,
        tick: state.tick,
        timestamp: now,
        text: `${successText} Salvaged ${item.name}.`,
        phase: state.raid.phase,
      },
    }
  }

  const profile = getDangerLevelProfile(state.raid.dangerLevel)
  const damageMultiplier = Math.max(0, (opts.damageMultiplier ?? 1) * profile.robotFailureDamageMultiplier)
  const rawDamage = Math.ceil(robot.menace * ROBOT_DAMAGE_PER_MENACE * damageMultiplier)
  const damageResult = applyRobotDamage(state, robot, rawDamage)
  return {
    state: {
      ...state,
      raider: damageResult.raider,
      raid: damageResult.raid,
    },
    event: {
      id: `robot_${robot.id}_escaped`,
      tick: state.tick,
      timestamp: now,
      text: `${robot.name} won that exchange. ${describeShieldDamage(damageResult.shieldDamage)} Ran away with the tactical urgency of someone who just learned a lesson.`,
      phase: state.raid.phase,
    },
  }
}

/** Pick a random eligible event and return a filled LogEvent */
export function resolveEvent(
  state: GameState,
  rng: RNG,
  now: number,
): LogEvent | null {
  const eligible = eligibleEvents(state)
  if (eligible.length === 0) return null

  const weightedEligible = eligible.map(template => ({
    ...template,
    weight: adjustedEventWeight(template, state),
  }))
  const template = rng.weightedPick(weightedEligible)
  const text = fillSlots(template.text, rng)

  return {
    id: template.id,
    tick: state.tick,
    timestamp: now,
    text,
    phase: state.raid.phase,
  }
}

/** Apply a template's effects to state, returning the modified state */
export function applyEffects(
  state: GameState,
  template: EventTemplate,
  rng: RNG,
): { state: GameState; shieldDamage?: ShieldDamageResult } {
  const effects = template.effects
  if (!effects) return { state }

  let { raider, raid } = state
  let shieldDamage: ShieldDamageResult | undefined

  if (effects.backpackValue !== undefined) {
    const delta = typeof effects.backpackValue === 'string'
      ? parseDice(effects.backpackValue, rng)
      : effects.backpackValue
    if (delta > 0) {
      const profile = getDangerLevelProfile(raid.dangerLevel)
      const profiledDelta = Math.max(1, Math.round(delta * profile.lootValueMultiplier))
      const item = pickLootItemForValue(profiledDelta, rng, profile)
      raid = addBackpackItem(raid, item)
      raid = {
        ...raid,
        backpackValue: Math.max(0, raid.backpackValue + (profiledDelta - item.value)),
      }
    } else {
      raid = { ...raid, backpackValue: Math.max(0, raid.backpackValue + delta) }
    }
  }

  if (effects.mood !== undefined) {
    raider = { ...raider, mood: clampMood(raider.mood + effects.mood) }
  }

  // Compatibility: Keep `effects.hp` support for direct HP adjustments (for example, HUB healing)
  // and for optional content that should continue using explicit HP semantics.
  if (effects.hp !== undefined) {
    const delta = typeof effects.hp === 'string'
      ? parseDice(effects.hp, rng)
      : effects.hp
    if (delta < 0) {
      const shielded = applyShieldedDamage(raider, raid, Math.abs(delta))
      raider = shielded.raider
      raid = shielded.raid
      shieldDamage = shielded
    } else {
      raider = { ...raider, hp: Math.max(0, Math.min(raider.maxHp, raider.hp + delta)) }
    }
  }

  if (effects.damage !== undefined) {
    const parsed = typeof effects.damage === 'string'
      ? parseDice(effects.damage, rng)
      : effects.damage
    if (parsed > 0) {
      const shielded = applyShieldedDamage(raider, raid, parsed)
      raider = shielded.raider
      raid = shielded.raid
    }
  }

  if (effects.greedLevel !== undefined) {
    raid = { ...raid, greedLevel: Math.min(100, Math.max(0, raid.greedLevel + effects.greedLevel)) }
  }

  if (effects.ratRating !== undefined) {
    raider = { ...raider, ratRating: Math.max(0, raider.ratRating + effects.ratRating) }
  }

  return { state: { ...state, raider, raid }, shieldDamage }
}

/** Simple dice parser using seeded RNG: "+2", "-5", "+1d6" → integer value. */
function parseDice(expr: string, rng: RNG): number {
  const match = expr.match(/^([+-]?\d+)(?:d(\d+))?$/)
  if (!match) return 1
  const base = parseInt(match[1], 10)
  const die = match[2] ? parseInt(match[2], 10) : 0
  if (die <= 0) return base

  const sign = base < 0 ? -1 : 1
  return base + sign * rng.int(0, die - 1)
}

/** Resolve a named flavor key to a random filled string — used by tick.ts for handler action feedback */
export function resolveFlavorKey(key: string, rng: RNG): string {
  if (key in flavor) {
    const table = flavor[key]
    const entry = rng.weightedPick(table)
    return fillSlots(entry.text, rng)
  }
  return `[${key}]`
}

/** Exported for content validation tests */
export { events, flavor, healingItems, loot, robots, shieldRechargers }
