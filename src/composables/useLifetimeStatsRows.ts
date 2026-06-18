/**
 * useLifetimeStatsRows — view-model logic for lifetime stats display.
 *
 * Responsibilities:
 * - Provide sorted row arrays for zone, danger level, robot, and healing stats
 * - Helper functions for formatting and parsing stat keys
 */

import { computed } from 'vue'
import type { RaiderLifetimeStats } from '../engine/types.js'
import { zoneName } from '../utils/zones.js'

export interface ZoneDangerKey {
  zoneId: string
  dangerLevel: string
}

export function useLifetimeStatsRows(statsRef: { value: RaiderLifetimeStats }) {
  // Extracts by zone, sorted descending
  const extractZoneRows = computed(() =>
    Object.entries(statsRef.value.extracts.byZone).sort((a, b) => b[1] - a[1]),
  )

  // Deaths by zone, sorted descending
  const deathZoneRows = computed(() =>
    Object.entries(statsRef.value.deaths.byZone).sort((a, b) => b[1] - a[1]),
  )

  // Extracts by zone + danger level, sorted descending
  const extractZoneTimeRows = computed(() =>
    Object.entries(statsRef.value.extracts.byZoneAndDanger).sort((a, b) => b[1] - a[1]),
  )

  // Deaths by zone + danger level, sorted descending
  const deathZoneTimeRows = computed(() =>
    Object.entries(statsRef.value.deaths.byZoneAndDanger).sort((a, b) => b[1] - a[1]),
  )

  // Robots defeated, sorted descending
  const robotRows = computed(() =>
    Object.entries(statsRef.value.robotDefeats).sort((a, b) => b[1] - a[1]),
  )

  // Healing items used, sorted descending
  const healingRows = computed(() =>
    Object.entries(statsRef.value.healingItemsUsed.byItem).sort((a, b) => b[1] - a[1]),
  )

  // Parse zone__dangerLevel key into components
  function parseZoneDangerLevelKey(key: string): ZoneDangerKey {
    const [zoneId, dangerLevel] = key.split('__')
    return { zoneId, dangerLevel }
  }

  // Convert snake_case ID to Title Case label
  function prettyId(id: string): string {
    return id
      .split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }

  // Get display name for zone, falling back to prettyId
  function zoneLabel(zoneId: string): string {
    return zoneName(zoneId) ?? prettyId(zoneId)
  }

  return {
    extractZoneRows,
    deathZoneRows,
    extractZoneTimeRows,
    deathZoneTimeRows,
    robotRows,
    healingRows,
    parseZoneDangerLevelKey,
    prettyId,
    zoneLabel,
  }
}
