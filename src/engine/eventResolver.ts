/**
 * Event resolver — picks a weighted event template valid for the current context
 * and fills {slot} placeholders from content tables.
 *
 * Slot resolution order:
 *   1. Named flavor tables in flavor.json  (e.g. {hub_gossip}, {death_quip})
 *   2. {mundane_item}  → random loot item name
 *   3. {water_item}    → random water-bottle loot item name
 *   4. {robot_flavor_<id>} → random flavor line from matching robot entry
 *   5. {count}         → random plausible water-bottle count (for flavor)
 */

import type { EventTemplate, GameState, LogEvent, LootItem, Phase } from './types.js'
import type { RNG } from './rng.js'
import hubEventsData from '../content/hub_events.json'
import deploymentEventsData from '../content/deployment_events.json'
import raidingEventsData from '../content/raiding_events.json'
import extractionEventsData from '../content/extraction_events.json'
import downedEventsData from '../content/downed_events.json'
import lootData from '../content/loot.json'
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
const loot = lootData as LootItem[]
const robots = robotsData as Array<{ id: string; weight: number; name: string; menace: number; flavorLines: string[] }>
const flavor = flavorData as Record<string, Array<{ id: string; weight: number; text: string }>>

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

    // Mundane item slot — any loot item
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
    raider = { ...raider, mood: Math.max(-5, Math.min(5, raider.mood + effects.mood)) }
  }

  if (effects.hp !== undefined) {
    raider = { ...raider, hp: Math.max(0, Math.min(raider.maxHp, raider.hp + effects.hp)) }
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
  return die > 0 ? base + rng.int(0, die - 1) : base
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
export { events, flavor, loot, robots }
