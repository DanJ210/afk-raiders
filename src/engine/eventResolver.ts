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

import type { EventTemplate, GameState, HealingItem, HealingItemStack, LogEvent, LootItem, Phase, RobotEntry, RobotLootItem } from './types.js'
import type { RNG } from './rng.js'
import hubEventsData from '../content/hub_events.json'
import deploymentEventsData from '../content/deployment_events.json'
import raidingEventsData from '../content/raiding_events.json'
import extractionEventsData from '../content/extraction_events.json'
import downedEventsData from '../content/downed_events.json'
import lootData from '../content/loot.json'
import healingItemsData from '../content/healing_items.json'
import robotsData from '../content/robots.json'
import flavorData from '../content/flavor.json'

// One events file per phase: HUB, DEPLOYING, RAIDING, EXTRACTING, DOWNED
const events = [
  ...hubEventsData,
  ...deploymentEventsData,
  ...raidingEventsData,
  ...extractionEventsData,
  ...downedEventsData,
] as EventTemplate[]
const baseLoot = lootData as LootItem[]
const healingItems = healingItemsData as HealingItem[]
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

export const HEALING_USE_HP_RATIO = 0.75

function clampMood(mood: number): number {
  return Math.max(-5, Math.min(5, mood))
}

function healingMoodGain(item: HealingItemStack): number {
  return item.moodGain ?? Math.max(1, Math.min(4, item.rarity))
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
    if (r.minGreed !== undefined && raid.greedLevel < r.minGreed) return false
    if (r.maxGreed !== undefined && raid.greedLevel > r.maxGreed) return false
    if (r.minHp !== undefined && state.raider.hp < r.minHp) return false
    if (r.maxHp !== undefined && state.raider.hp > r.maxHp) return false
    return true
  })
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

function pickLootItemForValue(targetValue: number, rng: RNG): LootItem {
  const exactMatches = loot.filter(item => item.value === targetValue)
  if (exactMatches.length > 0) {
    return rng.weightedPick(exactMatches)
  }

  const lowerMatches = loot.filter(item => item.value <= targetValue)
  if (lowerMatches.length > 0) {
    const highestValue = Math.max(...lowerMatches.map(item => item.value))
    const bestMatches = lowerMatches.filter(item => item.value === highestValue)
    return rng.weightedPick(bestMatches)
  }

  return rng.weightedPick(loot)
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

function pickBestHealingItem(items: HealingItemStack[], missingHp: number): HealingItemStack {
  const sorted = [...items].sort((a, b) => a.healAmount - b.healAmount)
  return sorted.find(item => item.healAmount >= missingHp) ?? sorted[sorted.length - 1]
}

export interface HealingItemResult {
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

/** Uses one current-raid bandage if the raider is hurt and alive. */
export function consumeHealingItemIfUseful(
  state: GameState,
  now: number,
): HealingItemResult | null {
  if (state.raid.phase === 'HUB' || state.raid.phase === 'DOWNED') return null
  if (state.raider.hp <= 0 || state.raider.hp >= state.raider.maxHp) return null
  if (state.raid.healingItems.length === 0) return null
  if (state.raider.hp / state.raider.maxHp > HEALING_USE_HP_RATIO) return null

  const missingHp = state.raider.maxHp - state.raider.hp
  const item = pickBestHealingItem(state.raid.healingItems, missingHp)
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

function pickRobotLoot(robot: RobotEntry, rng: RNG): LootItem {
  const item = rng.weightedPick(robot.lootTable)
  return toLootItem(item, robot)
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

  const damageMultiplier = Math.max(0, opts.damageMultiplier ?? 1)
  const damage = Math.ceil(robot.menace * 5 * damageMultiplier)
  return {
    state: {
      ...state,
      raider: {
        ...state.raider,
        hp: Math.max(0, state.raider.hp - damage),
      },
    },
    event: {
      id: `robot_${robot.id}_escaped`,
      tick: state.tick,
      timestamp: now,
      text: `${robot.name} won that exchange. Took ${damage} damage and ran away with the tactical urgency of someone who just learned a lesson.`,
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

  const template = rng.weightedPick(eligible)
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
): GameState {
  const effects = template.effects
  if (!effects) return state

  let { raider, raid } = state

  if (effects.backpackValue !== undefined) {
    const delta = typeof effects.backpackValue === 'string'
      ? parseDice(effects.backpackValue, rng)
      : effects.backpackValue
    if (delta > 0) {
      const item = pickLootItemForValue(delta, rng)
      raid = addBackpackItem(raid, item)
      raid = {
        ...raid,
        backpackValue: Math.max(0, raid.backpackValue + (delta - item.value)),
      }
    } else {
      raid = { ...raid, backpackValue: Math.max(0, raid.backpackValue + delta) }
    }
  }

  if (effects.mood !== undefined) {
    raider = { ...raider, mood: clampMood(raider.mood + effects.mood) }
  }

  if (effects.hp !== undefined) {
    const delta = typeof effects.hp === 'string'
      ? parseDice(effects.hp, rng)
      : effects.hp
    raider = { ...raider, hp: Math.max(0, Math.min(raider.maxHp, raider.hp + delta)) }
  }

  if (effects.greedLevel !== undefined) {
    raid = { ...raid, greedLevel: Math.min(100, Math.max(0, raid.greedLevel + effects.greedLevel)) }
  }

  if (effects.ratRating !== undefined) {
    raider = { ...raider, ratRating: Math.max(0, raider.ratRating + effects.ratRating) }
  }

  return { ...state, raider, raid }
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
export { events, flavor, healingItems, loot, robots }
