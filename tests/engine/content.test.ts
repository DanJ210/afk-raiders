/**
 * Content validation tests:
 * - Every {slot} referenced by an event template resolves to an existing flavor table,
 *   a loot item group, or a known slot name
 * - All weights > 0
 * - All IDs unique within their tables
 */

import { describe, it, expect } from 'vitest'
import { events, flavor, healingItems, loot, robots, shieldRechargers } from '../../src/engine/eventResolver'
import type { Phase, DangerLevel } from '../../src/engine/types'
import apparelAccessoriesData from '../../src/content/loot-tables/apparel_accessories.json'
import arcTechData from '../../src/content/loot-tables/arc_tech.json'
import consumablesData from '../../src/content/loot-tables/consumables.json'
import cursedWeirdItemsData from '../../src/content/loot-tables/cursed_weird_items.json'
import lootData from '../../src/content/loot-tables/loot.json'
import personalJunkData from '../../src/content/loot-tables/personal_junk.json'
import scrapComponentsData from '../../src/content/loot-tables/scrap_components.json'
import valuablesData from '../../src/content/loot-tables/valuables.json'
import weaponsPartsData from '../../src/content/loot-tables/weapons_parts.json'
import skillsData from '../../src/content/skills.json'
import raiderLevelsData from '../../src/content/raider_levels.json'
import weaponsData from '../../src/content/weapons.json'
import combatMessagesData from '../../src/content/combat_messages.json'
import { MAX_RAIDER_LEVEL } from '../../src/engine/raiderLevel'
import type { CombatMessageEntry, RaiderLevelContent, SkillDefinition, SkillTrackId, WeaponClass, WeaponEntry, WeaponFireRateStyle } from '../../src/engine/types'

const rawLoot = [
  ...(apparelAccessoriesData as { items: typeof loot }).items,
  ...(arcTechData as { items: typeof loot }).items,
  ...(consumablesData as { items: typeof loot }).items,
  ...(cursedWeirdItemsData as { items: typeof loot }).items,
  ...(lootData as { items: typeof loot }).items,
  ...(personalJunkData as { items: typeof loot }).items,
  ...(scrapComponentsData as { items: typeof loot }).items,
  ...(valuablesData as { items: typeof loot }).items,
  ...(weaponsPartsData as { items: typeof loot }).items,
]

function mergeLootTables(items: typeof loot): typeof loot {
  const merged = new Map<string, (typeof loot)[number]>()
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

const baseLoot = mergeLootTables(rawLoot)

const DEADLINESS_RANK = {
  weak: 1,
  moderate: 2,
  dangerous: 3,
  nasty: 4,
  deadly: 5,
} as const

// Known non-table slot names handled directly in fillSlots()
const BUILT_IN_SLOTS = new Set(['mundane_item', 'water_item', 'healing_item', 'count'])
const VALID_PHASES = new Set<Phase>(['HUB', 'DEPLOYING', 'RAIDING', 'EXTRACTING', 'DOWNED'])
const VALID_DANGER_LEVELS = new Set<DangerLevel>(['Low', 'Medium', 'High'])
const VALID_SKILL_IDS = new Set<SkillTrackId>(['cardio', 'hoarding', 'hiding_in_lockers'])
const VALID_WEAPON_CLASSES = new Set<WeaponClass>(['sidearm', 'hand_cannon', 'smg', 'assault_rifle', 'battle_rifle', 'shotgun', 'lmg', 'sniper', 'launcher', 'energy_oddity'])
const VALID_FIRE_RATE_STYLES = new Set<WeaponFireRateStyle>(['steady', 'burst', 'slow', 'wild', 'charged'])
const skills = skillsData as SkillDefinition[]
const raiderLevels = raiderLevelsData as RaiderLevelContent
const weapons = weaponsData as WeaponEntry[]
const combatMessages = combatMessagesData as Record<string, CombatMessageEntry[]>

// Robot flavor slots: {robot_flavor_<robotId>}
function isRobotFlavorSlot(slot: string): boolean {
  if (!slot.startsWith('robot_flavor_')) return false
  const robotId = slot.replace('robot_flavor_', '')
  return robots.some(r => r.id === robotId)
}

function extractSlots(text: string): string[] {
  const matches = text.matchAll(/\{([^}]+)\}/g)
  return [...matches].map(m => m[1])
}

function getRobotEncounterEvents(robotId: string) {
  return events.filter(event => event.effects?.robotEncounter === robotId)
}

function getMaxFailureDamage(robotId: string): number {
  const robot = robots.find(entry => entry.id === robotId)
  expect(robot, `unknown robot "${robotId}"`).toBeDefined()

  const maxMultiplier = Math.max(
    ...getRobotEncounterEvents(robotId).map(event => event.effects?.robotDamageMultiplier ?? 1),
  )

  return Math.ceil(robot!.menace * 5 * maxMultiplier)
}

function getTotalEncounterWeight(robotId: string): number {
  return getRobotEncounterEvents(robotId).reduce((sum, event) => sum + event.weight, 0)
}

describe('content validation', () => {
  describe('phase event files', () => {
    it('all event weights are > 0', () => {
      for (const ev of events) {
        expect(ev.weight, `event "${ev.id}" has weight ${ev.weight}`).toBeGreaterThan(0)
      }
    })

    it('all event IDs are unique', () => {
      const ids = events.map(e => e.id)
      const unique = new Set(ids)
      expect(unique.size).toBe(ids.length)
    })

    it('all phase and danger-level requirements are valid', () => {
      for (const event of events) {
        const phases = event.requires?.phase === undefined
          ? []
          : Array.isArray(event.requires.phase) ? event.requires.phase : [event.requires.phase]
        const dangerLevels = event.requires?.dangerLevel === undefined
          ? []
          : Array.isArray(event.requires.dangerLevel) ? event.requires.dangerLevel : [event.requires.dangerLevel]

        for (const phase of phases) {
          expect(VALID_PHASES.has(phase), `event "${event.id}" has invalid phase "${phase}"`).toBe(true)
        }
        for (const dangerLevel of dangerLevels) {
          expect(VALID_DANGER_LEVELS.has(dangerLevel), `event "${event.id}" has invalid dangerLevel "${dangerLevel}"`).toBe(true)
        }
      }
    })

    it('all {slot} placeholders resolve to a known source', () => {
      const unknown: string[] = []

      for (const ev of events) {
        const slots = extractSlots(ev.text)
        for (const slot of slots) {
          const isKnown =
            slot in flavor ||
            BUILT_IN_SLOTS.has(slot) ||
            isRobotFlavorSlot(slot)

          if (!isKnown) {
            unknown.push(`event "${ev.id}" references unknown slot "{${slot}}"`)
          }
        }
      }

      expect(unknown).toEqual([])
    })

    it('all robot encounter effects reference known robots', () => {
      const robotIds = new Set(robots.map(robot => robot.id))
      const unknown = events
        .map(event => ({ eventId: event.id, robotId: event.effects?.robotEncounter }))
        .filter(({ robotId }) => robotId !== undefined && !robotIds.has(robotId))

      expect(unknown).toEqual([])
    })

    it('robot damage multipliers are non-negative when present', () => {
      for (const event of events) {
        const multiplier = event.effects?.robotDamageMultiplier
        if (multiplier !== undefined) {
          expect(
            multiplier,
            `event "${event.id}" has negative robotDamageMultiplier`,
          ).toBeGreaterThanOrEqual(0)
        }
      }
    })

    it('all robots have at least one encounter event', () => {
      const encounterRobotIds = new Set(
        events
          .map(event => event.effects?.robotEncounter)
          .filter((robotId): robotId is string => robotId !== undefined),
      )

      for (const robot of robots) {
        expect(
          encounterRobotIds.has(robot.id),
          `robot "${robot.id}" has no encounter event`,
        ).toBe(true)
      }
    })

    it('anxietick is the most abundant encounter robot', () => {
      const anxietickWeight = getTotalEncounterWeight('anxietick')
      const weakRobots = robots.filter(robot => robot.id !== 'anxietick' && robot.deadliness === 'weak')
      for (const robot of weakRobots) {
        expect(
          anxietickWeight,
          `anxietick encounter weight should be greater than weak robot ${robot.id}`,
        ).toBeGreaterThan(getTotalEncounterWeight(robot.id))
      }
    })

    it('nasty and deadly robots only appear once greed has built up', () => {
      for (const robot of robots) {
        if (DEADLINESS_RANK[robot.deadliness] < DEADLINESS_RANK.nasty) continue

        for (const event of getRobotEncounterEvents(robot.id)) {
          expect(
            event.requires?.minGreed ?? 0,
            `high-tier robot event "${event.id}" should require greed`,
          ).toBeGreaterThanOrEqual(20)
        }
      }
    })

    it('max failed-encounter damage rises with robot deadliness', () => {
      const tierMaxDamage = new Map<number, number>()
      for (const robot of robots) {
        const tierRank = DEADLINESS_RANK[robot.deadliness]
        const robotMaxDamage = getMaxFailureDamage(robot.id)
        const current = tierMaxDamage.get(tierRank) ?? 0
        if (robotMaxDamage > current) tierMaxDamage.set(tierRank, robotMaxDamage)
      }

      const sortedTiers = [...tierMaxDamage.keys()].sort((a, b) => a - b)
      for (let i = 1; i < sortedTiers.length; i += 1) {
        expect(
          tierMaxDamage.get(sortedTiers[i]),
          `deadliness tier ${sortedTiers[i]} should have higher max damage than tier ${sortedTiers[i - 1]}`,
        ).toBeGreaterThan(tierMaxDamage.get(sortedTiers[i - 1])!)
      }
    })

    it('healing item find events only appear during RAIDING', () => {
      const healingEvents = events.filter(event => event.effects?.healingItem)
      expect(healingEvents.length).toBeGreaterThan(0)
      for (const event of healingEvents) {
        expect(event.requires?.phase, `healing event "${event.id}" must require RAIDING`).toBe('RAIDING')
      }
    })

    it('shield recharger find events only appear during RAIDING', () => {
      const shieldEvents = events.filter(event => event.effects?.shieldRecharger)
      expect(shieldEvents.length).toBeGreaterThan(0)
      for (const event of shieldEvents) {
        expect(event.requires?.phase, `shield event "${event.id}" must require RAIDING`).toBe('RAIDING')
      }
    })
  })

  describe('flavor.json', () => {
    it('all flavor table weights are > 0', () => {
      for (const [tableName, entries] of Object.entries(flavor)) {
        for (const entry of entries) {
          expect(
            entry.weight,
            `flavor table "${tableName}" entry "${entry.id}" has weight ${entry.weight}`,
          ).toBeGreaterThan(0)
        }
      }
    })

    it('all flavor IDs are unique within their table', () => {
      for (const [tableName, entries] of Object.entries(flavor)) {
        const ids = entries.map(e => e.id)
        const unique = new Set(ids)
        expect(
          unique.size,
          `flavor table "${tableName}" has duplicate IDs`,
        ).toBe(ids.length)
      }
    })

    it('flavor table nested {slot} references are resolvable', () => {
      const unknown: string[] = []
      for (const [tableName, entries] of Object.entries(flavor)) {
        for (const entry of entries) {
          const slots = extractSlots(entry.text)
          for (const slot of slots) {
            const isKnown =
              slot in flavor ||
              BUILT_IN_SLOTS.has(slot) ||
              isRobotFlavorSlot(slot)
            if (!isKnown) {
              unknown.push(`flavor[${tableName}] "${entry.id}" references unknown slot "{${slot}}"`)
            }
          }
        }
      }
      expect(unknown).toEqual([])
    })
  })

  describe('loot tables', () => {
    it('all loot weights are > 0', () => {
      for (const item of baseLoot) {
        expect(item.weight, `loot "${item.id}" has weight ${item.weight}`).toBeGreaterThan(0)
      }
    })

    it('all loot rarities are valid', () => {
      for (const item of baseLoot) {
        expect(Number.isInteger(item.rarity), `loot "${item.id}" rarity must be an integer`).toBe(true)
        expect(item.rarity, `loot "${item.id}" has rarity ${item.rarity}`).toBeGreaterThan(0)
        expect(item.rarity, `loot "${item.id}" has rarity ${item.rarity}`).toBeLessThanOrEqual(5)
      }
    })

    it('all loot IDs are unique', () => {
      const ids = baseLoot.map(l => l.id)
      const unique = new Set(ids)
      expect(unique.size).toBe(ids.length)
    })

    it('has at least 12 items', () => {
      expect(baseLoot.length).toBeGreaterThanOrEqual(12)
    })

    it('has at least 3 water bottle variants', () => {
      const waterBottles = baseLoot.filter(l => l.id.startsWith('water_bottle'))
      expect(waterBottles.length).toBeGreaterThanOrEqual(3)
    })

    it('resolver loot pool includes robot loot in addition to loot tables', () => {
      expect(loot.some(item => item.id === 'anxietick_gear')).toBe(true)
      expect(loot.some(item => item.id === 'roomba_battery')).toBe(true)
      expect(loot.some(item => item.id === 'right_boot')).toBe(true)
      expect(loot.some(item => item.id === 'protein_cube_sad')).toBe(true)
      expect(loot.length).toBeGreaterThan(baseLoot.length)
    })
  })

  describe('robots.json', () => {
    it('all robot weights are > 0', () => {
      for (const robot of robots) {
        expect(robot.weight, `robot "${robot.id}" has weight ${robot.weight}`).toBeGreaterThan(0)
      }
    })

    it('all robot IDs are unique', () => {
      const ids = robots.map(r => r.id)
      const unique = new Set(ids)
      expect(unique.size).toBe(ids.length)
    })

    it('all robots have at least one flavor line', () => {
      for (const robot of robots) {
        expect(
          robot.flavorLines.length,
          `robot "${robot.id}" has no flavor lines`,
        ).toBeGreaterThan(0)
      }
    })

    it('all robots have valid deadliness labels', () => {
      for (const robot of robots) {
        expect(
          robot.deadliness in DEADLINESS_RANK,
          `robot "${robot.id}" has invalid deadliness "${robot.deadliness}"`,
        ).toBe(true)
      }
    })

    it('current robot deadliness labels match the intended tier ladder', () => {
      const labels = Object.fromEntries(robots.map(robot => [robot.id, robot.deadliness]))
      expect(labels).toEqual({
        anxietick: 'weak',
        overthinker_tick: 'weak',
        tattletale: 'moderate',
        passive_aggressor: 'moderate',
        seeker_validation: 'moderate',
        harvester_annoyance: 'moderate',
        walker_texas_malfunction: 'dangerous',
        enforcer_inconvenience: 'dangerous',
        bomber_misread: 'nasty',
        roomba_prime: 'deadly',
        crusher_of_dreams: 'deadly',
        sniper_poor_decisions: 'deadly',
        tank_overcompensation: 'deadly',
      })
    })

    it('all robot menace values are on the placeholder 1-10 scale', () => {
      for (const robot of robots) {
        expect(robot.menace, `robot "${robot.id}" menace must be >= 1`).toBeGreaterThanOrEqual(1)
        expect(robot.menace, `robot "${robot.id}" menace must be <= 10`).toBeLessThanOrEqual(10)
      }
    })

    it('all robots have battle HP that rises with deadliness', () => {
      for (const robot of robots) {
        expect(Number.isInteger(robot.maxHp), `robot "${robot.id}" maxHp must be an integer`).toBe(true)
        expect(robot.maxHp, `robot "${robot.id}" maxHp must be positive`).toBeGreaterThan(0)
      }

      const minHpByTier = new Map<number, number>()
      const maxHpByTier = new Map<number, number>()
      for (const robot of robots) {
        const tier = DEADLINESS_RANK[robot.deadliness]
        minHpByTier.set(tier, Math.min(minHpByTier.get(tier) ?? Number.POSITIVE_INFINITY, robot.maxHp))
        maxHpByTier.set(tier, Math.max(maxHpByTier.get(tier) ?? 0, robot.maxHp))
      }

      for (let tier = 2; tier <= DEADLINESS_RANK.deadly; tier += 1) {
        expect(
          minHpByTier.get(tier),
          `deadliness tier ${tier} should have more HP than tier ${tier - 1}`,
        ).toBeGreaterThan(maxHpByTier.get(tier - 1)!)
      }
    })

    it('robot menace rises and robot-table abundance falls with deadliness', () => {
      for (const current of robots) {
        for (const other of robots) {
          if (DEADLINESS_RANK[current.deadliness] <= DEADLINESS_RANK[other.deadliness]) continue

          expect(
            current.menace,
            `${current.id} should have higher menace than ${other.id}`,
          ).toBeGreaterThan(other.menace)
          expect(
            current.weight,
            `${current.id} should be less abundant than ${other.id}`,
          ).toBeLessThan(other.weight)
        }
      }
    })

    it('all robots have success text and loot tables', () => {
      for (const robot of robots) {
        expect(robot.successText.length, `robot "${robot.id}" has no success text`).toBeGreaterThan(0)
        expect(robot.lootTable.length, `robot "${robot.id}" has no loot table`).toBeGreaterThan(0)

        for (const item of robot.lootTable) {
          expect(item.weight, `robot loot "${item.id}" has weight ${item.weight}`).toBeGreaterThan(0)
          expect(item.value, `robot loot "${item.id}" has value ${item.value}`).toBeGreaterThanOrEqual(0)
        }
      }
    })
  })

  describe('healing_items.json', () => {
    it('defines the four bandage tiers with exact heal amounts', () => {
      const amounts = Object.fromEntries(healingItems.map(item => [item.id, item.healAmount]))
      expect(amounts).toEqual({
        bandage_white: 5,
        bandage_green: 10,
        bandage_blue: 25,
        bandage_purple: 50,
      })
    })

    it('higher-tier bandages grant higher mood gains', () => {
      const moodGains = Object.fromEntries(healingItems.map(item => [item.id, item.moodGain]))
      expect(moodGains).toEqual({
        bandage_white: 1,
        bandage_green: 2,
        bandage_blue: 3,
        bandage_purple: 4,
      })
    })

    it('all healing item weights and rarities are valid', () => {
      for (const item of healingItems) {
        expect(item.weight, `healing item "${item.id}" has weight ${item.weight}`).toBeGreaterThan(0)
        expect(item.healAmount, `healing item "${item.id}" exceeds one-use heal cap`).toBeLessThanOrEqual(50)
        expect(item.moodGain, `healing item "${item.id}" moodGain must be positive`).toBeGreaterThan(0)
        expect(item.rarity, `healing item "${item.id}" rarity must be >= 1`).toBeGreaterThanOrEqual(1)
        expect(item.rarity, `healing item "${item.id}" rarity must be <= 5`).toBeLessThanOrEqual(5)
      }
    })

    it('all healing item IDs are unique', () => {
      const ids = healingItems.map(item => item.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  })

  describe('shield_rechargers.json', () => {
    it('all shield recharger weights, rarities, and charge amounts are valid', () => {
      for (const item of shieldRechargers) {
        expect(item.weight, `shield recharger "${item.id}" has weight ${item.weight}`).toBeGreaterThan(0)
        expect(item.chargeAmount, `shield recharger "${item.id}" must restore charge`).toBeGreaterThan(0)
        expect(item.rarity, `shield recharger "${item.id}" rarity must be >= 1`).toBeGreaterThanOrEqual(1)
        expect(item.rarity, `shield recharger "${item.id}" rarity must be <= 5`).toBeLessThanOrEqual(5)
      }
    })

    it('all shield recharger IDs are unique', () => {
      const ids = shieldRechargers.map(item => item.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('higher-value shield rechargers are never more common than cheaper ones', () => {
      for (const a of shieldRechargers) {
        for (const b of shieldRechargers) {
          if (a.value > b.value) {
            expect(
              a.weight,
              `shield recharger "${a.id}" is more valuable than "${b.id}" but more common`,
            ).toBeLessThanOrEqual(b.weight)
          }
        }
      }
    })
  })

  describe('weapons.json', () => {
    it('defines legally distinct weapon records with valid tuning fields', () => {
      expect(weapons.length).toBeGreaterThanOrEqual(5)

      for (const weapon of weapons) {
        expect(weapon.weight, `weapon "${weapon.id}" has invalid weight`).toBeGreaterThan(0)
        expect(weapon.name.trim(), `weapon "${weapon.id}" missing name`).not.toBe('')
        expect(VALID_WEAPON_CLASSES.has(weapon.class), `weapon "${weapon.id}" has invalid class`).toBe(true)
        expect(Number.isInteger(weapon.rarity), `weapon "${weapon.id}" rarity must be an integer`).toBe(true)
        expect(weapon.rarity, `weapon "${weapon.id}" rarity must be >= 1`).toBeGreaterThanOrEqual(1)
        expect(weapon.rarity, `weapon "${weapon.id}" rarity must be <= 5`).toBeLessThanOrEqual(5)
        expect(weapon.baseDamage, `weapon "${weapon.id}" baseDamage must be positive`).toBeGreaterThan(0)
        expect(weapon.accuracy, `weapon "${weapon.id}" accuracy must be > 0`).toBeGreaterThan(0)
        expect(weapon.accuracy, `weapon "${weapon.id}" accuracy must be <= 1`).toBeLessThanOrEqual(1)
        expect(weapon.critChance, `weapon "${weapon.id}" critChance must be >= 0`).toBeGreaterThanOrEqual(0)
        expect(weapon.critChance, `weapon "${weapon.id}" critChance must be <= 1`).toBeLessThanOrEqual(1)
        expect(weapon.armorPierce, `weapon "${weapon.id}" armorPierce must be >= 0`).toBeGreaterThanOrEqual(0)
        expect(weapon.durability, `weapon "${weapon.id}" durability must be positive`).toBeGreaterThan(0)
        expect(VALID_FIRE_RATE_STYLES.has(weapon.fireRateStyle), `weapon "${weapon.id}" has invalid fireRateStyle`).toBe(true)
        expect(weapon.flavor?.trim(), `weapon "${weapon.id}" missing flavor`).not.toBe('')
      }
    })

    it('all weapon IDs are unique and include the starter weapon', () => {
      const ids = weapons.map(weapon => weapon.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids).toContain('committee_sidearm')
    })

    it('higher rarity weapons increase offensive ceiling without changing defense', () => {
      const maxDamageByRarity = new Map<number, number>()
      for (const weapon of weapons) {
        maxDamageByRarity.set(weapon.rarity, Math.max(maxDamageByRarity.get(weapon.rarity) ?? 0, weapon.baseDamage + weapon.armorPierce))
      }

      expect(maxDamageByRarity.get(5)).toBeGreaterThan(maxDamageByRarity.get(1)!)
      expect(weapons.every(weapon => !('damageResistance' in weapon))).toBe(true)
    })
  })

  describe('combat_messages.json', () => {
    it('has valid weighted templates for robot battle logs', () => {
      for (const [tableName, entries] of Object.entries(combatMessages)) {
        expect(entries.length, `combat message table "${tableName}" is empty`).toBeGreaterThan(0)
        for (const entry of entries) {
          expect(entry.weight, `combat message "${entry.id}" has invalid weight`).toBeGreaterThan(0)
          expect(entry.text.trim(), `combat message "${entry.id}" has empty text`).not.toBe('')
        }
      }
    })
  })

  describe('skills.json', () => {
    it('defines exactly the supported parody skill ids once', () => {
      const ids = skills.map(skill => skill.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect(new Set(ids)).toEqual(VALID_SKILL_IDS)
    })

    it('uses valid level caps, thresholds, and display text', () => {
      for (const skill of skills) {
        expect(skill.name.trim(), `skill "${skill.id}" is missing a name`).not.toBe('')
        expect(skill.description.trim(), `skill "${skill.id}" is missing a description`).not.toBe('')
        expect(Number.isInteger(skill.maxLevel), `skill "${skill.id}" maxLevel must be an integer`).toBe(true)
        expect(skill.maxLevel, `skill "${skill.id}" maxLevel`).toBeGreaterThan(0)
        expect(skill.xpThresholds, `skill "${skill.id}" threshold count`).toHaveLength(skill.maxLevel)
        expect(skill.effectTextByLevel, `skill "${skill.id}" effect text count`).toHaveLength(skill.maxLevel + 1)
        expect(skill.levelUpTextByLevel, `skill "${skill.id}" level-up text count`).toHaveLength(skill.maxLevel)

        let previousThreshold = 0
        for (const threshold of skill.xpThresholds) {
          expect(Number.isInteger(threshold), `skill "${skill.id}" threshold must be an integer`).toBe(true)
          expect(threshold, `skill "${skill.id}" thresholds must ascend`).toBeGreaterThan(previousThreshold)
          previousThreshold = threshold
        }

        for (const text of [...skill.effectTextByLevel, ...skill.levelUpTextByLevel]) {
          expect(text.trim(), `skill "${skill.id}" has empty text`).not.toBe('')
        }
      }
    })
  })

  describe('raider_levels.json', () => {
    it('defines contiguous title bands for Raider Levels 1-75', () => {
      const ids = raiderLevels.titleBands.map(band => band.id)
      expect(new Set(ids).size).toBe(ids.length)

      const coveredLevels = new Set<number>()
      for (const band of raiderLevels.titleBands) {
        expect(band.id.trim(), 'title band id is empty').not.toBe('')
        expect(band.name.trim(), `title band "${band.id}" missing name`).not.toBe('')
        expect(band.description.trim(), `title band "${band.id}" missing description`).not.toBe('')
        expect(Number.isInteger(band.minLevel), `title band "${band.id}" minLevel`).toBe(true)
        expect(Number.isInteger(band.maxLevel), `title band "${band.id}" maxLevel`).toBe(true)
        expect(band.minLevel, `title band "${band.id}" minLevel`).toBeGreaterThanOrEqual(1)
        expect(band.maxLevel, `title band "${band.id}" maxLevel`).toBeLessThanOrEqual(MAX_RAIDER_LEVEL)
        expect(band.maxLevel, `title band "${band.id}" maxLevel`).toBeGreaterThanOrEqual(band.minLevel)
        expect(band.levelUpText.length, `title band "${band.id}" needs level-up text`).toBeGreaterThan(0)

        for (const text of band.levelUpText) {
          expect(text.trim(), `title band "${band.id}" has empty level-up text`).not.toBe('')
          expect(text, `title band "${band.id}" level-up text should include {level}`).toContain('{level}')
        }

        for (let level = band.minLevel; level <= band.maxLevel; level += 1) {
          expect(coveredLevels.has(level), `Raider Level ${level} covered more than once`).toBe(false)
          coveredLevels.add(level)
        }
      }

      expect([...coveredLevels].sort((a, b) => a - b)).toEqual(
        Array.from({ length: MAX_RAIDER_LEVEL }, (_, index) => index + 1),
      )
    })
  })
})
