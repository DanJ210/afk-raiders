/**
 * Content validation tests:
 * - Every {slot} referenced by an event template resolves to an existing flavor table,
 *   a loot item group, or a known slot name
 * - All weights > 0
 * - All IDs unique within their tables
 */

import { describe, it, expect } from 'vitest'
import { events, flavor, healingItems, loot, robots } from '../../src/engine/eventResolver'
import baseLootData from '../../src/content/loot.json'

const baseLoot = baseLootData as typeof loot

// Known non-table slot names handled directly in fillSlots()
const BUILT_IN_SLOTS = new Set(['mundane_item', 'water_item', 'healing_item', 'count'])

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

    it('healing item find events only appear during RAIDING', () => {
      const healingEvents = events.filter(event => event.effects?.healingItem)
      expect(healingEvents.length).toBeGreaterThan(0)
      for (const event of healingEvents) {
        expect(event.requires?.phase, `healing event "${event.id}" must require RAIDING`).toBe('RAIDING')
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

  describe('loot.json', () => {
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

    it('lighter loot items are at least as rare as heavier loot items', () => {
      for (const a of baseLoot) {
        for (const b of baseLoot) {
          if (a.weight < b.weight) {
            expect(
              a.rarity,
              `loot "${a.id}" is lighter than "${b.id}" but not rarer`,
            ).toBeGreaterThanOrEqual(b.rarity)
          }
        }
      }
    })

    it('resolver loot pool includes robot loot in addition to loot.json', () => {
      expect(loot.some(item => item.id === 'anxietick_gear')).toBe(true)
      expect(loot.some(item => item.id === 'roomba_battery')).toBe(true)
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

    it('all robot menace values are on the placeholder 1-10 scale', () => {
      for (const robot of robots) {
        expect(robot.menace, `robot "${robot.id}" menace must be >= 1`).toBeGreaterThanOrEqual(1)
        expect(robot.menace, `robot "${robot.id}" menace must be <= 10`).toBeLessThanOrEqual(10)
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

    it('all healing item weights and rarities are valid', () => {
      for (const item of healingItems) {
        expect(item.weight, `healing item "${item.id}" has weight ${item.weight}`).toBeGreaterThan(0)
        expect(item.healAmount, `healing item "${item.id}" exceeds one-use heal cap`).toBeLessThanOrEqual(50)
        expect(item.rarity, `healing item "${item.id}" rarity must be >= 1`).toBeGreaterThanOrEqual(1)
        expect(item.rarity, `healing item "${item.id}" rarity must be <= 5`).toBeLessThanOrEqual(5)
      }
    })

    it('all healing item IDs are unique', () => {
      const ids = healingItems.map(item => item.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  })
})
