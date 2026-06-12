import zonesData from '../content/zones.json'
import type { ZoneEntry } from '../engine/types.js'

const zones = zonesData as ZoneEntry[]

export function zoneName(zoneId: string | null): string | null {
  if (!zoneId) return null
  return zones.find(zone => zone.id === zoneId)?.name ?? null
}
