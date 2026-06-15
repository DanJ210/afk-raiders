import type { RaiderLifetimeStats, TimeOfDay } from './types.js'

export function createInitialLifetimeStats(): RaiderLifetimeStats {
  return {
    extracts: {
      total: 0,
      byZone: {},
      byZoneAndTime: {},
    },
    deaths: {
      total: 0,
      byZone: {},
      byZoneAndTime: {},
    },
    robotDefeats: {},
    healingItemsUsed: {
      total: 0,
      byItem: {},
    },
  }
}

function incrementCounter(counter: Record<string, number>, key: string): Record<string, number> {
  return {
    ...counter,
    [key]: (counter[key] ?? 0) + 1,
  }
}

function zoneTimeKey(zone: string, timeOfDay: TimeOfDay): string {
  return `${zone}__${timeOfDay}`
}

export function recordOutcome(
  stats: RaiderLifetimeStats,
  outcome: 'extracts' | 'deaths',
  zone: string | null,
  timeOfDay: TimeOfDay | null,
): RaiderLifetimeStats {
  const current = stats[outcome]
  return {
    ...stats,
    [outcome]: {
      total: current.total + 1,
      byZone: zone ? incrementCounter(current.byZone, zone) : current.byZone,
      byZoneAndTime: zone && timeOfDay
        ? incrementCounter(current.byZoneAndTime, zoneTimeKey(zone, timeOfDay))
        : current.byZoneAndTime,
    },
  }
}

export function recordRobotDefeat(stats: RaiderLifetimeStats, robotId: string): RaiderLifetimeStats {
  return {
    ...stats,
    robotDefeats: incrementCounter(stats.robotDefeats, robotId),
  }
}

export function recordHealingItemUse(stats: RaiderLifetimeStats, itemId: string): RaiderLifetimeStats {
  return {
    ...stats,
    healingItemsUsed: {
      total: stats.healingItemsUsed.total + 1,
      byItem: incrementCounter(stats.healingItemsUsed.byItem, itemId),
    },
  }
}
