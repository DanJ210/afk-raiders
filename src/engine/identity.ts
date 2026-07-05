/**
 * Raider identity — seeded name generation and personality trait rolls.
 *
 * Names and trait definitions live in src/content/raider_identity.json
 * (content-as-data). The engine only stores the generated name string and
 * trait id list on RaiderStats. Trait ids gate event templates via
 * `requires.traits` in the event resolver.
 */

import identityData from '../content/raider_identity.json'
import { createRNG, type RNG } from './rng.js'

export interface NamePartEntry {
  id: string
  weight: number
  text: string
}

export interface PersonalityTraitDefinition {
  id: string
  weight: number
  name: string
  description: string
}

interface RaiderIdentityContent {
  firstNames: NamePartEntry[]
  callsigns: NamePartEntry[]
  lastNames: NamePartEntry[]
  traits: PersonalityTraitDefinition[]
}

const identity = identityData as RaiderIdentityContent

export const personalityTraits: PersonalityTraitDefinition[] = identity.traits

/** Fallback name for states created without an identity roll (tests, legacy saves with blank names). */
export const DEFAULT_RAIDER_NAME = 'Raider Danakin'

/** Number of distinct personality traits rolled at Raider creation. */
export const PERSONALITY_TRAIT_COUNT = 2

/** Salt mixed into the save seed so identity rolls don't mirror early tick rolls. */
const IDENTITY_SEED_SALT = 0x1d3a97

export interface RaiderIdentity {
  name: string
  traits: string[]
}

export function findPersonalityTrait(id: string): PersonalityTraitDefinition | undefined {
  return personalityTraits.find(trait => trait.id === id)
}

/** Generate a seeded raider name: First "Callsign" Last. */
export function generateRaiderName(rng: RNG): string {
  const first = rng.weightedPick(identity.firstNames).text
  const callsign = rng.weightedPick(identity.callsigns).text
  const last = rng.weightedPick(identity.lastNames).text
  return `${first} "${callsign}" ${last}`
}

/** Roll PERSONALITY_TRAIT_COUNT distinct trait ids using weighted selection. */
export function rollPersonalityTraits(rng: RNG): string[] {
  const pool = [...personalityTraits]
  const rolled: string[] = []
  while (rolled.length < PERSONALITY_TRAIT_COUNT && pool.length > 0) {
    const picked = rng.weightedPick(pool)
    rolled.push(picked.id)
    pool.splice(pool.indexOf(picked), 1)
  }
  return rolled
}

/** Full identity roll from a dedicated RNG. */
export function generateRaiderIdentity(rng: RNG): RaiderIdentity {
  return {
    name: generateRaiderName(rng),
    traits: rollPersonalityTraits(rng),
  }
}

/**
 * Deterministic identity for a save seed. Used for fresh saves and for
 * backfilling traits on legacy saves that predate the identity system.
 */
export function generateIdentityForSeed(seed: number): RaiderIdentity {
  return generateRaiderIdentity(createRNG((seed ^ IDENTITY_SEED_SALT) >>> 0))
}

/** Keep only known, deduplicated trait ids from an untrusted saved value. */
export function sanitizePersonalityTraits(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  for (const entry of value) {
    if (typeof entry === 'string' && findPersonalityTrait(entry)) {
      seen.add(entry)
    }
  }
  return [...seen]
}
