/**
 * Raider identity tests:
 * - Seeded name and trait generation is deterministic
 * - Trait rolls are distinct and reference known trait ids
 * - Trait sanitization keeps only valid ids
 */

import { describe, it, expect } from 'vitest'
import { createRNG } from '../../src/engine/rng'
import {
  DEFAULT_RAIDER_NAME,
  PERSONALITY_TRAIT_COUNT,
  generateIdentityForSeed,
  generateRaiderIdentity,
  generateRaiderName,
  personalityTraits,
  rollPersonalityTraits,
  sanitizePersonalityTraits,
} from '../../src/engine/identity'
import { createInitialState } from '../../src/engine/initialState'

describe('raider identity', () => {
  it('generates the same name and traits for the same seed', () => {
    const a = generateIdentityForSeed(12345)
    const b = generateIdentityForSeed(12345)
    expect(a).toEqual(b)
  })

  it('generates different identities for different seeds', () => {
    const seen = new Set<string>()
    for (let seed = 0; seed < 50; seed++) {
      seen.add(JSON.stringify(generateIdentityForSeed(seed)))
    }
    // Not strictly guaranteed unique, but 50 identical rolls would mean the seed is ignored.
    expect(seen.size).toBeGreaterThan(10)
  })

  it('names follow the First "Callsign" Last format', () => {
    const name = generateRaiderName(createRNG(42))
    expect(name).toMatch(/^\S.* ".+" \S.*$/)
  })

  it('rolls distinct, known trait ids', () => {
    const validIds = new Set(personalityTraits.map(trait => trait.id))
    for (let seed = 0; seed < 25; seed++) {
      const traits = rollPersonalityTraits(createRNG(seed))
      expect(traits).toHaveLength(PERSONALITY_TRAIT_COUNT)
      expect(new Set(traits).size).toBe(traits.length)
      for (const trait of traits) {
        expect(validIds.has(trait), `unknown trait id "${trait}"`).toBe(true)
      }
    }
  })

  it('sanitizePersonalityTraits keeps only known ids and dedupes', () => {
    const [first] = personalityTraits
    expect(sanitizePersonalityTraits([first.id, first.id, 'not_a_trait', 42])).toEqual([first.id])
    expect(sanitizePersonalityTraits(undefined)).toEqual([])
    expect(sanitizePersonalityTraits('coward')).toEqual([])
  })

  it('createInitialState uses the provided identity', () => {
    const identity = generateRaiderIdentity(createRNG(7))
    const state = createInitialState(1000, identity)
    expect(state.raider.name).toBe(identity.name)
    expect(state.raider.traits).toEqual(identity.traits)
  })

  it('createInitialState without identity falls back to defaults', () => {
    const state = createInitialState(1000)
    expect(state.raider.name).toBe(DEFAULT_RAIDER_NAME)
    expect(state.raider.traits).toEqual([])
  })
})
