import zonesData from '../content/zones/zones.json'
import zoneConditionsData from '../content/zones/zone_conditions.json'
import type { ZoneEntry } from '../engine/types.js'

const zones = zonesData as ZoneEntry[]

interface ZoneConditionContentEntry {
  id: string
  name: string
  description: string
  dangerLevel: string
}

const zoneConditions = [
  ...zoneConditionsData.minor_conditions,
  ...zoneConditionsData.major_conditions,
] as ZoneConditionContentEntry[]

export function zoneName(zoneId: string | null): string | null {
  if (!zoneId) return null
  return zones.find(zone => zone.id === zoneId)?.name ?? null
}

export function zoneDescription(zoneId: string | null): string | null {
  if (!zoneId) return null
  return zones.find(zone => zone.id === zoneId)?.description ?? null
}

export function zoneConditionByDangerLevel(
  dangerLevel: string | null,
): { name: string; description: string } | null {
  if (!dangerLevel) return null
  const normalizedDangerLevel = dangerLevel.trim()
  const condition = zoneConditions.find(
    (entry) => entry.dangerLevel.trim() === normalizedDangerLevel,
  )
  if (!condition) return null
  return {
    name: condition.name,
    description: condition.description,
  }
}
