/**
 * Greed Check unit tests.
 * - Higher greed reduces extraction probability
 * - Pressure reduces push-deeper probability
 * - CALL_EXTRACT forces extraction attempt
 * - forceExtract in raid state forces EXTRACT outcome
 */

import { describe, it, expect } from 'vitest'
import { createRNG } from '../../src/engine/rng'
import { runGreedCheck } from '../../src/engine/greedCheck'
import type { RaidState } from '../../src/engine/types'

interface GreedCheckOpts {
  calmed: boolean
  pressured: boolean
  currentHp?: number
  maxHp?: number
  hasHealingItems?: boolean
}

function makeRaid(overrides: Partial<RaidState> = {}): RaidState {
  const baseRaid: RaidState = {
    zone: 'damp_battlegrounds',
    dangerLevel: 'Low',
    shield: null,
    activeShieldRecharge: null,
    backpack: [],
    hiddenPocket: null,
    healingItems: [],
    backpackValue: 0,
    greedLevel: 0,
    phase: 'RAIDING',
    phaseTicksRemaining: 999,
    forceExtract: false,
  }

  return {
    ...baseRaid,
    ...overrides,
    // Preserve explicit null overrides while still filling omitted properties.
    zone: Object.prototype.hasOwnProperty.call(overrides, 'zone') ? overrides.zone! : baseRaid.zone,
    dangerLevel: Object.prototype.hasOwnProperty.call(overrides, 'dangerLevel') ? overrides.dangerLevel! : baseRaid.dangerLevel,
    shield: Object.prototype.hasOwnProperty.call(overrides, 'shield') ? overrides.shield! : baseRaid.shield,
    activeShieldRecharge: Object.prototype.hasOwnProperty.call(overrides, 'activeShieldRecharge') ? overrides.activeShieldRecharge! : baseRaid.activeShieldRecharge,
    hiddenPocket: Object.prototype.hasOwnProperty.call(overrides, 'hiddenPocket') ? overrides.hiddenPocket! : baseRaid.hiddenPocket,
  }
}

/** Run N greed checks with fixed seed, count outcomes */
function countOutcomes(raid: RaidState, n = 500, opts: GreedCheckOpts = { calmed: false, pressured: false }) {
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
  it('allows explicit null overrides in makeRaid', () => {
    const raid = makeRaid({
      zone: null,
      dangerLevel: null,
      shield: null,
      activeShieldRecharge: null,
      hiddenPocket: null,
    })

    expect(raid.zone).toBeNull()
    expect(raid.dangerLevel).toBeNull()
    expect(raid.shield).toBeNull()
    expect(raid.activeShieldRecharge).toBeNull()
    expect(raid.hiddenPocket).toBeNull()
  })

  it('forceExtract always returns EXTRACT', () => {
    const rng = createRNG(1)
    const raid = makeRaid({ forceExtract: true, greedLevel: 90 })
    for (let i = 0; i < 20; i++) {
      const result = runGreedCheck(raid, rng, { calmed: false, pressured: false })
      expect(result.outcome).toBe('EXTRACT')
    }
  })

  it('higher greed level increases push-deeper frequency (fewer extracts)', () => {
    const lowGreed = countOutcomes(makeRaid({ greedLevel: 10 }))
    const highGreed = countOutcomes(makeRaid({ greedLevel: 60 }))
    // Higher greed should mean fewer extracts (extract chance penalised)
    expect(highGreed.extract).toBeLessThan(lowGreed.extract)
  })

  it('calming decreases extract rate vs baseline', () => {
    const baseline = countOutcomes(makeRaid({ greedLevel: 30 }))
    const calmed = countOutcomes(makeRaid({ greedLevel: 30 }), 500, { calmed: true, pressured: false })
    expect(calmed.extract).toBeLessThan(baseline.extract)
  })

  it('pressuring increases extract rate vs baseline', () => {
    const baseline = countOutcomes(makeRaid({ greedLevel: 0 }))
    const pressured = countOutcomes(makeRaid({ greedLevel: 0 }), 500, { calmed: false, pressured: true })
    expect(pressured.extract).toBeGreaterThan(baseline.extract)
  })

  it('very high greed produces some deaths', () => {
    const { downed } = countOutcomes(makeRaid({ greedLevel: 100 }), 3000)
    expect(downed).toBeGreaterThan(0)
  })

  it('low greed produces no deaths', () => {
    const { downed } = countOutcomes(makeRaid({ greedLevel: 0 }), 500)
    expect(downed).toBe(0)
  })

  it('push-deeper keeps greed unchanged (event-driven greed)', () => {
    const rng = createRNG(999)
    const raid = makeRaid({ greedLevel: 0 })
    // Find a push-deeper outcome
    for (let i = 0; i < 100; i++) {
      const result = runGreedCheck(raid, rng, { calmed: false, pressured: false })
      if (result.outcome === 'PUSH_DEEPER') {
        expect(result.newGreedLevel).toBe(raid.greedLevel)
        return
      }
    }
    // If no push-deeper found in 100 rolls, fail
    throw new Error('No PUSH_DEEPER outcome found in 100 rolls')
  })

  it('keeps extract and downed rates relatively small even at max greed', () => {
    const n = 5000
    const outcomes = countOutcomes(makeRaid({ greedLevel: 100 }), n, { calmed: false, pressured: false })
    const extractRate = outcomes.extract / n
    const downedRate = outcomes.downed / n

    expect(extractRate).toBeLessThan(0.02)
    expect(downedRate).toBeLessThan(0.01)
  })

  it('low HP without bandages increases extraction rate', () => {
    const baseline = countOutcomes(makeRaid({ greedLevel: 20 }), 500, { calmed: false, pressured: false })
    const wounded = countOutcomes(makeRaid({ greedLevel: 20 }), 500, {
      calmed: false,
      pressured: false,
      currentHp: 35,
      maxHp: 100,
      hasHealingItems: false,
    })

    expect(wounded.extract).toBeGreaterThan(baseline.extract)
  })

  it('danger level dampens the low-HP no-bandage extraction bonus', () => {
    const lowDanger = countOutcomes(makeRaid({ greedLevel: 20, dangerLevel: 'Low' }), 500, {
      calmed: false,
      pressured: false,
      currentHp: 35,
      maxHp: 100,
      hasHealingItems: false,
    })
    const mediumDanger = countOutcomes(makeRaid({ greedLevel: 20, dangerLevel: 'Medium' }), 500, {
      calmed: false,
      pressured: false,
      currentHp: 35,
      maxHp: 100,
      hasHealingItems: false,
    })
    const highDanger = countOutcomes(makeRaid({ greedLevel: 20, dangerLevel: 'High' }), 500, {
      calmed: false,
      pressured: false,
      currentHp: 35,
      maxHp: 100,
      hasHealingItems: false,
    })

    expect(mediumDanger.extract).toBeLessThan(lowDanger.extract)
    expect(highDanger.extract).toBeLessThan(mediumDanger.extract)
  })

  it('low HP with bandages does not get the no-bandage extraction bonus', () => {
    const woundedNoBandages = countOutcomes(makeRaid({ greedLevel: 20 }), 500, {
      calmed: false,
      pressured: false,
      currentHp: 35,
      maxHp: 100,
      hasHealingItems: false,
    })
    const woundedWithBandages = countOutcomes(makeRaid({ greedLevel: 20 }), 500, {
      calmed: false,
      pressured: false,
      currentHp: 35,
      maxHp: 100,
      hasHealingItems: true,
    })

    expect(woundedWithBandages.extract).toBeLessThan(woundedNoBandages.extract)
  })
})
