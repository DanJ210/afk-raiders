/**
 * Content validation tests:
 * - Every {slot} referenced by an event template resolves to an existing flavor table,
 *   a loot item group, or a known slot name
 * - All weights > 0
 * - All IDs unique within their tables
 */

import { describe, it, expect } from 'vitest'
import { events, flavor, loot, robots } from '../../src/engine/eventResolver'

// Known non-table slot names handled directly in fillSlots()
const BUILT_IN_SLOTS = new Set(['mundane_item', 'water_item', 'count'])

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
  describe('events.json', () => {
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
      for (const item of loot) {
        expect(item.weight, `loot "${item.id}" has weight ${item.weight}`).toBeGreaterThan(0)
      }
    })

    it('all loot rarities are valid', () => {
      for (const item of loot) {
        expect(Number.isInteger(item.rarity), `loot "${item.id}" rarity must be an integer`).toBe(true)
        expect(item.rarity, `loot "${item.id}" has rarity ${item.rarity}`).toBeGreaterThan(0)
        expect(item.rarity, `loot "${item.id}" has rarity ${item.rarity}`).toBeLessThanOrEqual(5)
      }
    })

    it('all loot IDs are unique', () => {
      const ids = loot.map(l => l.id)
      const unique = new Set(ids)
      expect(unique.size).toBe(ids.length)
    })

    it('has at least 12 items', () => {
      expect(loot.length).toBeGreaterThanOrEqual(12)
    })

    it('has at least 3 water bottle variants', () => {
      const waterBottles = loot.filter(l => l.id.startsWith('water_bottle'))
      expect(waterBottles.length).toBeGreaterThanOrEqual(3)
    })

    it('lighter loot items are at least as rare as heavier loot items', () => {
      for (const a of loot) {
        for (const b of loot) {
          if (a.weight < b.weight) {
            expect(
              a.rarity,
              `loot "${a.id}" is lighter than "${b.id}" but not rarer`,
            ).toBeGreaterThanOrEqual(b.rarity)
          }
        }
      }
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
  })
})
