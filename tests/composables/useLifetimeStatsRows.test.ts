import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { createInitialLifetimeStats } from '../../src/engine/stats'
import { useLifetimeStatsRows } from '../../src/composables/useLifetimeStatsRows'

describe('useLifetimeStatsRows', () => {
  it('sorts zone/time/robot/healing rows descending by count', () => {
    const stats = createInitialLifetimeStats()
    stats.extracts.byZone = { alpha: 2, bravo: 7, charlie: 3 }
    stats.deaths.byZone = { alpha: 1, bravo: 4 }
    stats.extracts.byZoneAndDanger = { alpha__Low: 3, bravo__High: 5 }
    stats.deaths.byZoneAndDanger = { alpha__Low: 1, bravo__High: 6 }
    stats.robotDefeats = { anxietick: 12, roomba_prime: 2 }
    stats.healingItemsUsed.byItem = { bandage_white: 1, bandage_blue: 3 }

    const vm = useLifetimeStatsRows(ref(stats))

    expect(vm.extractZoneRows.value[0]).toEqual(['bravo', 7])
    expect(vm.deathZoneRows.value[0]).toEqual(['bravo', 4])
    expect(vm.extractZoneTimeRows.value[0]).toEqual(['bravo__High', 5])
    expect(vm.deathZoneTimeRows.value[0]).toEqual(['bravo__High', 6])
    expect(vm.robotRows.value[0]).toEqual(['anxietick', 12])
    expect(vm.healingRows.value[0]).toEqual(['bandage_blue', 3])
  })

  it('parses and formats helper labels', () => {
    const vm = useLifetimeStatsRows(ref(createInitialLifetimeStats()))

    expect(vm.parseZoneDangerLevelKey('damp_battlegrounds__High')).toEqual({
      zoneId: 'damp_battlegrounds',
      dangerLevel: 'High',
    })
    expect(vm.prettyId('sniper_poor_decisions')).toBe('Sniper Poor Decisions')
    expect(vm.zoneLabel('damp_battlegrounds')).toBe('Damp Battlegrounds')
    expect(vm.zoneLabel('unknown_zone')).toBe('Unknown Zone')
  })
})
