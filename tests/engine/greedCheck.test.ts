/**
 * Greed Check unit tests.
 * - Higher backpack value increases push-deeper probability
 * - Scold reduces push-deeper probability
 * - CALL_EXTRACT forces extraction attempt
 * - forceExtract in raid state forces EXTRACT outcome
 */

import { describe, it, expect } from 'vitest'
import { createRNG } from '../../src/engine/rng'
import { runGreedCheck } from '../../src/engine/greedCheck'
import type { RaidState } from '../../src/engine/types'

function makeRaid(overrides: Partial<RaidState> = {}): RaidState {
  return {
    zone: 'damp_battlegrounds',
    timeOfDay: 'Day',
    backpack: [],
    healingItems: [],
    backpackValue: 0,
    greedLevel: 0,
    phase: 'RAIDING',
    phaseTicksRemaining: 999,
    forceExtract: false,
    ...overrides,
  }
}

/** Run N greed checks with fixed seed, count outcomes */
function countOutcomes(raid: RaidState, n = 500, opts = { encouraged: false, scolded: false }) {
  const rng = createRNG(12345)
  let pushDeeper = 0, extract = 0, downed = 0
  for (let i = 0; i < n; i++) {
    const result = runGreedCheck(raid, rng, opts)
    if (result.outcome === 'PUSH_DEEPER') pushDeeper++
    else if (result.outcome === 'EXTRACT') extract++
    else downed++
  }
  return { pushDeeper, extract, downed }
}

describe('greedCheck', () => {
  it('forceExtract always returns EXTRACT', () => {
    const rng = createRNG(1)
    const raid = makeRaid({ forceExtract: true, greedLevel: 90 })
    for (let i = 0; i < 20; i++) {
      const result = runGreedCheck(raid, rng, { encouraged: false, scolded: false })
      expect(result.outcome).toBe('EXTRACT')
    }
  })

  it('higher greed level increases push-deeper frequency (fewer extracts)', () => {
    const lowGreed = countOutcomes(makeRaid({ greedLevel: 10 }))
    const highGreed = countOutcomes(makeRaid({ greedLevel: 60 }))
    // Higher greed should mean fewer extracts (extract chance penalised)
    expect(highGreed.extract).toBeLessThan(lowGreed.extract)
  })

  it('scolding increases extract rate vs baseline', () => {
    const baseline = countOutcomes(makeRaid({ greedLevel: 30 }))
    const scolded = countOutcomes(makeRaid({ greedLevel: 30 }), 500, { encouraged: false, scolded: true })
    expect(scolded.extract).toBeGreaterThan(baseline.extract)
  })

  it('encouraging decreases extract rate vs baseline', () => {
    const baseline = countOutcomes(makeRaid({ greedLevel: 0 }))
    const encouraged = countOutcomes(makeRaid({ greedLevel: 0 }), 500, { encouraged: true, scolded: false })
    expect(encouraged.extract).toBeLessThan(baseline.extract)
  })

  it('very high greed produces some deaths', () => {
    const { downed } = countOutcomes(makeRaid({ greedLevel: 100 }), 500)
    expect(downed).toBeGreaterThan(0)
  })

  it('low greed produces no deaths', () => {
    const { downed } = countOutcomes(makeRaid({ greedLevel: 0 }), 500)
    expect(downed).toBe(0)
  })

  it('push-deeper increments greed level', () => {
    const rng = createRNG(999)
    const raid = makeRaid({ greedLevel: 0 })
    // Find a push-deeper outcome
    for (let i = 0; i < 100; i++) {
      const result = runGreedCheck(raid, rng, { encouraged: false, scolded: false })
      if (result.outcome === 'PUSH_DEEPER') {
        expect(result.newGreedLevel).toBeGreaterThan(raid.greedLevel)
        return
      }
    }
    // If no push-deeper found in 100 rolls, fail
    throw new Error('No PUSH_DEEPER outcome found in 100 rolls')
  })

  it('low HP without bandages increases extraction rate', () => {
    const baseline = countOutcomes(makeRaid({ greedLevel: 20 }), 500, { encouraged: false, scolded: false })
    const wounded = countOutcomes(makeRaid({ greedLevel: 20 }), 500, {
      encouraged: false,
      scolded: false,
      currentHp: 35,
      maxHp: 100,
      hasHealingItems: false,
    })

    expect(wounded.extract).toBeGreaterThan(baseline.extract)
  })

  it('low HP with bandages does not get the no-bandage extraction bonus', () => {
    const woundedNoBandages = countOutcomes(makeRaid({ greedLevel: 20 }), 500, {
      encouraged: false,
      scolded: false,
      currentHp: 35,
      maxHp: 100,
      hasHealingItems: false,
    })
    const woundedWithBandages = countOutcomes(makeRaid({ greedLevel: 20 }), 500, {
      encouraged: false,
      scolded: false,
      currentHp: 35,
      maxHp: 100,
      hasHealingItems: true,
    })

    expect(woundedWithBandages.extract).toBeLessThan(woundedNoBandages.extract)
  })
})
