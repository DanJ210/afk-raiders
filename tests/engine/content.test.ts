/// <reference types="vite/client" />

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
import progressionConfigData from '../../src/content/progression_config.json'
import raiderLevelsData from '../../src/content/raider_levels.json'
import zoneConditionsData from '../../src/content/zones/zone_conditions.json'
import zonesData from '../../src/content/zones/zones.json'
import { MAX_RAIDER_LEVEL } from '../../src/engine/raiderLevel'
import { raidActivities } from '../../src/engine/raidActivities'
import type { RaidActivityDefinition, RaiderLevelContent, SkillDefinition, SkillTrackId } from '../../src/engine/types'

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
const VALID_PHASES = new Set<Phase>(['HUB', 'DEPLOYING', 'RAIDING', 'KNOCKED_OUT'])
const VALID_DANGER_LEVELS = new Set<DangerLevel>(['Low', 'Medium', 'High'])
const VALID_SKILL_IDS = new Set<SkillTrackId>(['cardio', 'hoarding', 'hiding_in_lockers', 'signal_handling'])
const VALID_ZONE_CONDITION_IDS = new Set([
  ...zoneConditionsData.minor_conditions,
  ...zoneConditionsData.major_conditions,
].map(condition => condition.id))
const VALID_ZONE_IDS = new Set(zonesData.map(zone => zone.id))
const contentJsonModules = import.meta.glob('../../src/content/**/*.json', { eager: true }) as Record<string, { default: unknown }>
const NON_PLAYER_FACING_CONTENT_KEYS = new Set([
  'category',
  'dangerLevel',
  'id',
  'phase',
  'robotEncounter',
  'skillXpThresholdProfile',
  'zone',
  'zoneCondition',
])
const FORBIDDEN_PLAYER_FACING_TERMS = [
  { pattern: /\bARC Raiders\b/i, message: 'source trademark must not appear in player-facing content' },
  { pattern: /\bARC\b/, message: 'use A.R.C. for the AFK acronym in player-facing content' },
  { pattern: /\bStella(?:\s+(?:Red|Camping|Montis))?\b/i, message: 'use Staycation/AFK-original names instead of source-specific Stella terms' },
  { pattern: /\bSperanza\b/i, message: 'use Desperanza instead of the source hub name' },
  { pattern: /Emotional Support Pocket/i, message: 'use Secret Hidden Pocket as the canonical pocket name' },
]
const skills = skillsData as SkillDefinition[]
const progressionConfig = progressionConfigData as {
  skillXpThresholdProfile: string
  skillXpThresholdProfiles: Record<string, number[]>
}
const raiderLevels = raiderLevelsData as RaiderLevelContent
const VALID_RAID_ACTIVITY_KINDS = new Set<RaidActivityDefinition['kind']>(['SEARCH', 'ROBOT_ENCOUNTER', 'EXTRACTION', 'DOWNED'])
const VALID_ROBOT_DEADLINESS = new Set(robots.map(robot => robot.deadliness))
const VALID_SEARCH_LOOT_TABLE_IDS = new Set([
  'scrap_components',
  'water_bottles',
  'apparel_accessories',
  'arc_tech',
  'consumables',
  'cursed_weird_items',
  'loot',
  'personal_junk',
  'valuables',
  'weapons_parts'
])

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
  return events.filter(event => event.effects?.startRaidActivity?.robotId === robotId)
}

function getMaxFailureDamage(robotId: string): number {
  const robot = robots.find(entry => entry.id === robotId)
  expect(robot, `unknown robot "${robotId}"`).toBeDefined()

  const maxMultiplier = Math.max(
    ...getRobotEncounterEvents(robotId).map(event => event.effects?.startRaidActivity?.robotDamageMultiplier ?? 1),
  )

  return Math.ceil(robot!.menace * 5 * maxMultiplier)
}

function getTotalEncounterWeight(robotId: string): number {
  return getRobotEncounterEvents(robotId).reduce((sum, event) => sum + event.weight, 0)
}

function isNegativeHpEffect(hp: unknown): boolean {
  if (typeof hp === 'number') return hp < 0
  if (typeof hp === 'string') return hp.trim().startsWith('-')
  return false
}

function collectPlayerFacingStrings(value: unknown, path: string[] = []): Array<{ path: string[], text: string }> {
  if (typeof value === 'string') {
    return [{ path, text: value }]
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectPlayerFacingStrings(entry, [...path, String(index)]))
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, entry]) => {
      if (NON_PLAYER_FACING_CONTENT_KEYS.has(key)) return []
      return collectPlayerFacingStrings(entry, [...path, key])
    })
  }

  return []
}

describe('content validation', () => {
  describe('parody guardrails', () => {
    it('keeps source-specific terms out of player-facing content strings', () => {
      const violations: string[] = []

      for (const [modulePath, module] of Object.entries(contentJsonModules)) {
        const relativePath = modulePath.replace('../../src/content/', '')
        const content = module.default

        for (const { path, text } of collectPlayerFacingStrings(content)) {
          for (const forbiddenTerm of FORBIDDEN_PLAYER_FACING_TERMS) {
            if (!forbiddenTerm.pattern.test(text)) continue
            violations.push(`${relativePath}:${path.join('.')}: ${forbiddenTerm.message}: "${text}"`)
          }
        }
      }

      expect(violations).toEqual([])
    })
  })

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

    it('all phase, danger-level, zone, and zone-condition requirements are valid', () => {
      for (const event of events) {
        const phases = event.requires?.phase === undefined
          ? []
          : Array.isArray(event.requires.phase) ? event.requires.phase : [event.requires.phase]
        const dangerLevels = event.requires?.dangerLevel === undefined
          ? []
          : Array.isArray(event.requires.dangerLevel) ? event.requires.dangerLevel : [event.requires.dangerLevel]
        const zones = event.requires?.zone === undefined
          ? []
          : Array.isArray(event.requires.zone) ? event.requires.zone : [event.requires.zone]
        const zoneConditions = event.requires?.zoneCondition === undefined
          ? []
          : Array.isArray(event.requires.zoneCondition) ? event.requires.zoneCondition : [event.requires.zoneCondition]

        for (const phase of phases) {
          expect(VALID_PHASES.has(phase), `event "${event.id}" has invalid phase "${phase}"`).toBe(true)
        }
        for (const dangerLevel of dangerLevels) {
          expect(VALID_DANGER_LEVELS.has(dangerLevel), `event "${event.id}" has invalid dangerLevel "${dangerLevel}"`).toBe(true)
        }
        for (const zone of zones) {
          expect(VALID_ZONE_IDS.has(zone), `event "${event.id}" has invalid zone "${zone}"`).toBe(true)
        }
        for (const zoneCondition of zoneConditions) {
          expect(VALID_ZONE_CONDITION_IDS.has(zoneCondition), `event "${event.id}" has invalid zoneCondition "${zoneCondition}"`).toBe(true)
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

    it('ordinary diary events do not use legacy robot encounter effects', () => {
      const legacy = events
        .filter(event => (
          Object.prototype.hasOwnProperty.call(event.effects ?? {}, 'robotEncounter') ||
          Object.prototype.hasOwnProperty.call(event.effects ?? {}, 'robotDamageMultiplier')
        ))
        .map(event => event.id)

      expect(legacy).toEqual([])
    })

    it('all startRaidActivity effects reference known activity and robot IDs', () => {
      const activityIds = new Set(raidActivities.map(activity => activity.id))
      const robotIds = new Set(robots.map(robot => robot.id))
      const unknown: string[] = []

      for (const event of events) {
        const effect = event.effects?.startRaidActivity
        if (!effect) continue

        if (!activityIds.has(effect.activityId)) {
          unknown.push(`event "${event.id}" references unknown activity "${effect.activityId}"`)
        }
        if (effect.robotId !== undefined && !robotIds.has(effect.robotId)) {
          unknown.push(`event "${event.id}" references unknown activity robot "${effect.robotId}"`)
        }
        if (effect.robotDamageMultiplier !== undefined && effect.robotDamageMultiplier < 0) {
          unknown.push(`event "${event.id}" has negative activity robotDamageMultiplier`)
        }
        if (effect.hazardDamage !== undefined && effect.hazardDamage < 0) {
          unknown.push(`event "${event.id}" has negative activity hazardDamage`)
        }
      }

      expect(unknown).toEqual([])
    })

    it('ordinary diary events do not apply direct damage or negative HP effects', () => {
      const directDamageEvents = events
        .filter(event => (
          Object.prototype.hasOwnProperty.call(event.effects ?? {}, 'damage') ||
          isNegativeHpEffect(event.effects?.hp)
        ))
        .map(event => event.id)

      expect(directDamageEvents).toEqual([])
    })

    it('has at least one generic robot activity starter that selects from a robot pool', () => {
      const genericRobotStarters = events.filter(event => {
        const effect = event.effects?.startRaidActivity
        return effect?.kind === 'ROBOT_ENCOUNTER' && effect.robotId === undefined && effect.robotPool !== undefined
      })

      expect(genericRobotStarters.length).toBeGreaterThan(0)
    })

    it('all robots have at least one robot activity starter event', () => {
      const encounterRobotIds = new Set(
        events
          .map(event => event.effects?.startRaidActivity?.robotId)
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

    it('healing item find events and activity starters only appear during RAIDING', () => {
      const healingEvents = events.filter(event => event.effects?.healingItem)
      for (const event of healingEvents) {
        expect(event.requires?.phase, `healing event "${event.id}" must require RAIDING`).toBe('RAIDING')
      }

      const healingActivityStarters = events.filter(event => event.effects?.startRaidActivity?.healingItem)
      expect(healingEvents.length + healingActivityStarters.length).toBeGreaterThan(0)
      for (const event of healingActivityStarters) {
        expect(event.requires?.phase, `healing activity event "${event.id}" must require RAIDING`).toBe('RAIDING')
      }
    })

    it('shield recharger find events and activity starters only appear during RAIDING', () => {
      const shieldEvents = events.filter(event => event.effects?.shieldRecharger)
      for (const event of shieldEvents) {
        expect(event.requires?.phase, `shield event "${event.id}" must require RAIDING`).toBe('RAIDING')
      }

      const shieldActivityStarters = events.filter(event => event.effects?.startRaidActivity?.shieldRecharger)
      expect(shieldEvents.length + shieldActivityStarters.length).toBeGreaterThan(0)
      for (const event of shieldActivityStarters) {
        expect(event.requires?.phase, `shield activity event "${event.id}" must require RAIDING`).toBe('RAIDING')
      }
    })

    it('does not use legacy forcePhase effects', () => {
      for (const event of events) {
        expect(
          Object.prototype.hasOwnProperty.call(event.effects ?? {}, 'forcePhase'),
          `event "${event.id}" should use condition-specific extraction effects instead of forcePhase`,
        ).toBe(false)
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

  describe('raid activity definitions', () => {
    it('all activity weights, durations, and IDs are valid', () => {
      const ids = raidActivities.map(activity => activity.id)
      expect(new Set(ids).size, 'raid activity IDs must be unique').toBe(ids.length)

      for (const activity of raidActivities) {
        expect(activity.weight, `activity "${activity.id}" has weight ${activity.weight}`).toBeGreaterThan(0)
        expect(activity.name, `activity "${activity.id}" needs a user-facing name`).toBeTruthy()
        expect(activity.ticks, `activity "${activity.id}" must take at least one tick`).toBeGreaterThan(0)
        expect(VALID_RAID_ACTIVITY_KINDS.has(activity.kind), `activity "${activity.id}" has invalid kind`).toBe(true)
        expect(activity.text.started, `activity "${activity.id}" needs started text`).toBeTruthy()
        expect(activity.text.progress.length, `activity "${activity.id}" needs progress text`).toBeGreaterThan(0)
        expect(activity.text.completed, `activity "${activity.id}" needs completed text`).toBeTruthy()
        expect(activity.text.failed, `activity "${activity.id}" needs failed text`).toBeTruthy()

        const dangerLevels = activity.requires?.dangerLevel === undefined
          ? []
          : Array.isArray(activity.requires.dangerLevel) ? activity.requires.dangerLevel : [activity.requires.dangerLevel]
        const zones = activity.requires?.zone === undefined
          ? []
          : Array.isArray(activity.requires.zone) ? activity.requires.zone : [activity.requires.zone]
        const zoneConditions = activity.requires?.zoneCondition === undefined
          ? []
          : Array.isArray(activity.requires.zoneCondition) ? activity.requires.zoneCondition : [activity.requires.zoneCondition]

        for (const dangerLevel of dangerLevels) {
          expect(VALID_DANGER_LEVELS.has(dangerLevel), `activity "${activity.id}" has invalid dangerLevel "${dangerLevel}"`).toBe(true)
        }
        for (const zone of zones) {
          expect(VALID_ZONE_IDS.has(zone), `activity "${activity.id}" has invalid zone "${zone}"`).toBe(true)
        }
        for (const zoneCondition of zoneConditions) {
          expect(VALID_ZONE_CONDITION_IDS.has(zoneCondition), `activity "${activity.id}" has invalid zoneCondition "${zoneCondition}"`).toBe(true)
        }
      }
    })

    it('has JSON-backed extraction countdown activity text', () => {
      const extractionCountdown = raidActivities.find(activity => activity.id === 'extraction_countdown')

      expect(extractionCountdown).toMatchObject({
        kind: 'EXTRACTION',
        ticks: 4,
      })
      expect(extractionCountdown?.text.started).toContain('{ticks_remaining}')
      expect(extractionCountdown?.text.progress.some(line => line.includes('{ticks_remaining}'))).toBe(true)
    })

    it('has JSON-backed downed countdown activity text', () => {
      const downedCountdown = raidActivities.find(activity => activity.id === 'downed_countdown')

      expect(downedCountdown).toMatchObject({
        kind: 'DOWNED',
        ticks: 2,
      })
      expect(downedCountdown?.text.started).toContain('{tick_count}')
      expect(downedCountdown?.text.progress.some(line => line.includes('{tick_count}'))).toBe(true)
    })

    it('has a JSON-backed medical search activity', () => {
      const medicalSearch = raidActivities.find(activity => activity.id === 'search_medical_pouch')

      expect(medicalSearch).toMatchObject({
        kind: 'SEARCH',
        healingItem: true,
      })
      expect(medicalSearch?.text.completed).toContain('{healing_item}')
    })

    it('has a JSON-backed shield recharger search activity', () => {
      const shieldSearch = raidActivities.find(activity => activity.id === 'search_shield_recharger_crate')

      expect(shieldSearch).toMatchObject({
        kind: 'SEARCH',
        shieldRecharger: true,
      })
      expect(shieldSearch?.text.completed).toContain('{shield_recharger}')
    })

    it('has a JSON-backed water bottle search activity', () => {
      const waterSearch = raidActivities.find(activity => activity.id === 'search_water_bottle_stash')

      expect(waterSearch).toMatchObject({
        kind: 'SEARCH',
        lootTableId: 'water_bottles',
      })
      expect(waterSearch?.text.completed).toContain('{loot_name}')
    })

    it('robot activity definitions reference known robots and deadliness tiers', () => {
      const robotIds = new Set(robots.map(robot => robot.id))
      const unknown: string[] = []

      for (const activity of raidActivities) {
        if (activity.robotId !== undefined && !robotIds.has(activity.robotId)) {
          unknown.push(`activity "${activity.id}" references unknown robot "${activity.robotId}"`)
        }

        const deadliness = activity.robotPool?.deadliness === undefined
          ? []
          : Array.isArray(activity.robotPool.deadliness) ? activity.robotPool.deadliness : [activity.robotPool.deadliness]
        const dangerLevels = activity.robotPool?.dangerLevel === undefined
          ? []
          : Array.isArray(activity.robotPool.dangerLevel) ? activity.robotPool.dangerLevel : [activity.robotPool.dangerLevel]
        const zones = activity.robotPool?.zone === undefined
          ? []
          : Array.isArray(activity.robotPool.zone) ? activity.robotPool.zone : [activity.robotPool.zone]
        const zoneConditions = activity.robotPool?.zoneCondition === undefined
          ? []
          : Array.isArray(activity.robotPool.zoneCondition) ? activity.robotPool.zoneCondition : [activity.robotPool.zoneCondition]
        for (const tier of deadliness) {
          if (!VALID_ROBOT_DEADLINESS.has(tier)) {
            unknown.push(`activity "${activity.id}" references unknown deadliness "${tier}"`)
          }
        }
        for (const dangerLevel of dangerLevels) {
          if (!VALID_DANGER_LEVELS.has(dangerLevel)) {
            unknown.push(`activity "${activity.id}" references unknown dangerLevel "${dangerLevel}"`)
          }
        }
        for (const zone of zones) {
          if (!VALID_ZONE_IDS.has(zone)) {
            unknown.push(`activity "${activity.id}" references unknown zone "${zone}"`)
          }
        }
        for (const zoneCondition of zoneConditions) {
          if (!VALID_ZONE_CONDITION_IDS.has(zoneCondition)) {
            unknown.push(`activity "${activity.id}" references unknown zoneCondition "${zoneCondition}"`)
          }
        }
      }

      expect(unknown).toEqual([])
    })

    it('search activity definitions reference known search loot tables', () => {
      const unknown = raidActivities
        .filter(activity => activity.kind === 'SEARCH')
        .filter(activity => !activity.shieldRecharger)
        .filter(activity => !activity.healingItem)
        .filter(activity => activity.lootTableId === undefined || !VALID_SEARCH_LOOT_TABLE_IDS.has(activity.lootTableId))
        .map(activity => `${activity.id}:${activity.lootTableId ?? 'missing'}`)

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
        receipt_printer_doom: 'moderate',
        walker_texas_malfunction: 'dangerous',
        enforcer_inconvenience: 'dangerous',
        apology_turret: 'dangerous',
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
      const bandages = healingItems.filter(item => item.id.startsWith('bandage_'))
      const amounts = Object.fromEntries(bandages.map(item => [item.id, item.healAmount]))
      expect(amounts).toEqual({
        bandage_white: 5,
        bandage_green: 10,
        bandage_blue: 25,
        bandage_purple: 50,
      })
    })

    it('higher-tier bandages grant higher mood gains', () => {
      const bandages = healingItems.filter(item => item.id.startsWith('bandage_'))
      const moodGains = Object.fromEntries(bandages.map(item => [item.id, item.moodGain]))
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
        expect(item.healAmount + (item.reviveAmount ?? 0), `healing item "${item.id}" must heal or revive`).toBeGreaterThan(0)
        if (item.reviveAmount !== undefined) {
          expect(item.reviveAmount, `healing item "${item.id}" reviveAmount must be positive`).toBeGreaterThan(0)
        }
        expect(item.moodGain, `healing item "${item.id}" moodGain must be positive`).toBeGreaterThan(0)
        expect(item.rarity, `healing item "${item.id}" rarity must be >= 1`).toBeGreaterThanOrEqual(1)
        expect(item.rarity, `healing item "${item.id}" rarity must be <= 5`).toBeLessThanOrEqual(5)
      }
    })

    it('all healing item IDs are unique', () => {
      const ids = healingItems.map(item => item.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('defines Panic Paddles as a revive-only field med', () => {
      const item = healingItems.find(entry => entry.id === 'panic_paddles')
      expect(item).toMatchObject({
        name: 'Panic Paddles',
        healAmount: 0,
        reviveAmount: 25,
      })
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

  describe('progression_config.json', () => {
    it('defines valid skill XP threshold profiles', () => {
      const profileEntries = Object.entries(progressionConfig.skillXpThresholdProfiles)
      expect(profileEntries.length).toBeGreaterThan(0)
      expect(
        progressionConfig.skillXpThresholdProfiles[progressionConfig.skillXpThresholdProfile],
        'active skill XP threshold profile must exist',
      ).toBeDefined()

      for (const [profileId, thresholds] of profileEntries) {
        for (const skill of skills) {
          expect(thresholds, `profile "${profileId}" threshold count for skill "${skill.id}"`).toHaveLength(skill.maxLevel)
        }

        let previousThreshold = 0
        for (const threshold of thresholds) {
          expect(Number.isInteger(threshold), `profile "${profileId}" threshold must be an integer`).toBe(true)
          expect(threshold, `profile "${profileId}" thresholds must ascend`).toBeGreaterThan(previousThreshold)
          previousThreshold = threshold
        }
      }
    })

    it('keeps the standard skill XP profile aligned with skill definitions', () => {
      const standardThresholds = progressionConfig.skillXpThresholdProfiles.standard
      expect(standardThresholds, 'standard skill XP threshold profile must exist').toBeDefined()

      for (const skill of skills) {
        expect(skill.xpThresholds, `skill "${skill.id}" standard thresholds`).toEqual(standardThresholds)
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
