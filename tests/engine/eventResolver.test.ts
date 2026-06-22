/**
 * Focused unit tests for applyEffects in eventResolver.ts.
 *
 * Verifies that applying a loot effect:
 *   - adds a BackpackItem to the backpack with the correct fields
 *   - increments quantity when the same item is looted again
 *   - keeps backpackValue consistent with the sum of applied deltas
 *   - does not mutate the input state
 */

import { describe, it, expect } from 'vitest'
import { createRNG } from '../../src/engine/rng'
import { applyEffects, consumeHealingItem, consumeShieldRecharger, resolveEvent, resolveHealingItemFind, resolveRobotEncounter, resolveShieldRechargerFind } from '../../src/engine/eventResolver'
import { createInitialState } from '../../src/engine/initialState'
import { xpRequiredForLevel } from '../../src/engine/raiderLevel'
import type { EventTemplate, HealingItemStack } from '../../src/engine/types'
import zoneConditionsData from '../../src/content/zones/zone_conditions.json'

// backpackValue=450 maps exclusively to Snack Mix (Chaos Blend),
// so item selection is fully deterministic — no RNG variance.
const LOOT_TEMPLATE: EventTemplate = {
  id: 'test_loot',
  weight: 1,
  text: 'You found something.',
  effects: { backpackValue: 450 },
}

const DAMAGE_TEMPLATE: EventTemplate = {
  id: 'test_damage',
  weight: 1,
  text: 'You found something sharp.',
  effects: { hp: '-5d10' },
}

const FIXED_DAMAGE_TEMPLATE: EventTemplate = {
  id: 'test_fixed_damage',
  weight: 1,
  text: 'You found something aggressively harmful.',
  effects: { hp: -20 },
}

const SHIELD_AWARE_DAMAGE_TEMPLATE: EventTemplate = {
  id: 'test_shield_aware_damage',
  weight: 1,
  text: 'You found a truly unfair hazard.',
  effects: { damage: 20 },
}

const NEGATIVE_DAMAGE_TEMPLATE: EventTemplate = {
  id: 'test_negative_damage',
  weight: 1,
  text: 'You found a surprisingly gentle hazard.',
  effects: { damage: -20 },
}

const GREED_EFFECT_TEMPLATE: EventTemplate = {
  id: 'test_greed_effect',
  weight: 1,
  text: 'You saw loot bait and made a bad choice.',
  effects: { greedLevel: 5 },
}

function makeBandage(overrides: Partial<HealingItemStack> = {}): HealingItemStack {
  return {
    itemId: 'bandage_white',
    name: 'White Bandage',
    healAmount: 5,
    moodGain: 1,
    rarity: 1,
    quantity: 1,
    ...overrides,
  }
}

describe('applyEffects — backpack item behavior', () => {
  it('adds a new BackpackItem when a loot effect is applied', () => {
    const state = createInitialState(0)
    const rng = createRNG(42)

    const result = applyEffects(state, LOOT_TEMPLATE, rng)

    expect(result.state.raid.backpack).toHaveLength(1)
    const item = result.state.raid.backpack[0]
    expect(item.itemId).toBe('snack_mix_chaos')
    expect(item.name).toBe('Snack Mix (Chaos Blend)')
    expect(item.value).toBe(450)
    expect(item.rarity).toBe(5)
    expect(item.quantity).toBe(1)
  })

  it('increments quantity when the same item is looted a second time', () => {
    const state = createInitialState(0)
    const rng = createRNG(42)

    const afterFirst = applyEffects(state, LOOT_TEMPLATE, rng)
    expect(afterFirst.state.raid.backpack).toHaveLength(1)
    expect(afterFirst.state.raid.backpack[0].quantity).toBe(1)

    const afterSecond = applyEffects(afterFirst.state, LOOT_TEMPLATE, rng)
    expect(afterSecond.state.raid.backpack).toHaveLength(1)
    expect(afterSecond.state.raid.backpack[0].itemId).toBe('snack_mix_chaos')
    expect(afterSecond.state.raid.backpack[0].quantity).toBe(2)
  })

  it('keeps backpackValue equal to the cumulative sum of applied deltas', () => {
    const state = createInitialState(0)
    const rng = createRNG(42)

    const afterFirst = applyEffects(state, LOOT_TEMPLATE, rng)
    expect(afterFirst.state.raid.backpackValue).toBe(450)

    const afterSecond = applyEffects(afterFirst.state, LOOT_TEMPLATE, rng)
    expect(afterSecond.state.raid.backpackValue).toBe(900)
  })

  it('does not mutate the input state', () => {
    const state = createInitialState(0)
    const rng = createRNG(42)

    applyEffects(state, LOOT_TEMPLATE, rng)

    expect(state.raid.backpack).toHaveLength(0)
    expect(state.raid.backpackValue).toBe(0)
  })

  it('applies deterministic dice-based HP damage within range', () => {
    const state = createInitialState(0)
    const result1 = applyEffects(state, DAMAGE_TEMPLATE, createRNG(42))
    const result2 = applyEffects(state, DAMAGE_TEMPLATE, createRNG(42))

    expect(result1.state.raider.hp).toBe(result2.state.raider.hp)
    expect(result1.state.raider.hp).toBeLessThanOrEqual(95)
    expect(result1.state.raider.hp).toBeGreaterThanOrEqual(86)
  })

  it('scales loot value by danger-level profile derived from zone conditions', () => {
    const initial = createInitialState(0)
    const template: EventTemplate = {
      id: 'test_zone_condition_loot',
      weight: 1,
      text: 'You found something timely.',
      effects: { backpackValue: 100 },
    }

    const allConditions = [
      ...zoneConditionsData.minor_conditions,
      ...zoneConditionsData.major_conditions,
    ]

    const lowCondition = allConditions.find(c => c.dangerLevel.trim() === 'Low')
    const mediumCondition = allConditions.find(c => c.dangerLevel.trim() === 'Medium')
    const highCondition = allConditions.find(c => c.dangerLevel.trim() === 'High')

    expect(lowCondition).toBeDefined()
    expect(mediumCondition).toBeDefined()
    expect(highCondition).toBeDefined()

    const lowDanger = applyEffects(
      {
        ...initial,
        raid: {
          ...initial.raid,
          dangerLevel: lowCondition!.dangerLevel.trim() as 'Low',
          zoneCondition: {
            id: lowCondition!.id,
            name: lowCondition!.name,
            description: lowCondition!.description,
          },
        },
      },
      template,
      createRNG(1),
    )
    const mediumDanger = applyEffects(
      {
        ...initial,
        raid: {
          ...initial.raid,
          dangerLevel: mediumCondition!.dangerLevel.trim() as 'Medium',
          zoneCondition: {
            id: mediumCondition!.id,
            name: mediumCondition!.name,
            description: mediumCondition!.description,
          },
        },
      },
      template,
      createRNG(1),
    )
    const highDanger = applyEffects(
      {
        ...initial,
        raid: {
          ...initial.raid,
          dangerLevel: highCondition!.dangerLevel.trim() as 'High',
          zoneCondition: {
            id: highCondition!.id,
            name: highCondition!.name,
            description: highCondition!.description,
          },
        },
      },
      template,
      createRNG(1),
    )

    expect(lowDanger.state.raid.backpackValue).toBe(85)
    expect(mediumDanger.state.raid.backpackValue).toBe(120)
    expect(highDanger.state.raid.backpackValue).toBe(155)
  })

  it('slightly biases loot rarity quality by mood', () => {
    const template: EventTemplate = {
      id: 'test_mood_rarity_bias',
      weight: 1,
      text: 'Mood-adjusted loot roll.',
      effects: { backpackValue: 90 },
    }

    const averageRarityForMood = (mood: number): number => {
      let totalRarity = 0
      const sampleSize = 600

      for (let seed = 1; seed <= sampleSize; seed += 1) {
        const initial = createInitialState(0)
        const state = {
          ...initial,
          raider: { ...initial.raider, mood },
          raid: { ...initial.raid, dangerLevel: null },
        }
        const result = applyEffects(state, template, createRNG(seed))
        totalRarity += result.state.raid.backpack[0].rarity
      }

      return totalRarity / sampleSize
    }

    const lowMoodAverage = averageRarityForMood(-5)
    const neutralMoodAverage = averageRarityForMood(0)
    const highMoodAverage = averageRarityForMood(5)

    expect(highMoodAverage).toBeGreaterThan(neutralMoodAverage)
    expect(neutralMoodAverage).toBeGreaterThan(lowMoodAverage)
    expect(highMoodAverage - lowMoodAverage).toBeGreaterThan(0.05)
  })

  it('slightly biases loot rarity quality by greed', () => {
    const template: EventTemplate = {
      id: 'test_greed_rarity_bias',
      weight: 1,
      text: 'Greed-adjusted loot roll.',
      effects: { backpackValue: 90 },
    }

    const averageRarityForGreed = (greedLevel: number): number => {
      let totalRarity = 0
      const sampleSize = 800

      for (let seed = 1; seed <= sampleSize; seed += 1) {
        const initial = createInitialState(0)
        const state = {
          ...initial,
          raid: { ...initial.raid, dangerLevel: null, greedLevel },
        }
        const result = applyEffects(state, template, createRNG(seed))
        totalRarity += result.state.raid.backpack[0].rarity
      }

      return totalRarity / sampleSize
    }

    const lowGreedAverage = averageRarityForGreed(0)
    const highGreedAverage = averageRarityForGreed(100)

    expect(highGreedAverage).toBeGreaterThan(lowGreedAverage)
    expect(highGreedAverage - lowGreedAverage).toBeGreaterThan(0.03)
  })

  it('routes negative HP effects through shield mitigation', () => {
    const initial = createInitialState(0)
    const result = applyEffects(initial, FIXED_DAMAGE_TEMPLATE, createRNG(1))

    expect(result.state.raider.hp).toBe(88)
    expect(result.state.raid.shield?.charge).toBe(20)
    expect(result.state.raid.shield?.durability).toBe(95)
    expect(result.shieldDamage).toMatchObject({
      hpDamage: 12,
      shieldChargeLost: 20,
      mitigated: true,
    })
  })

  it('routes generic damage effects through shield mitigation', () => {
    const initial = createInitialState(0)
    const result = applyEffects(initial, SHIELD_AWARE_DAMAGE_TEMPLATE, createRNG(1))

    expect(result.state.raider.hp).toBe(88)
    expect(result.state.raid.shield?.charge).toBe(20)
    expect(result.state.raid.shield?.durability).toBe(95)
    expect(result.shieldDamage).toMatchObject({
      hpDamage: 12,
      shieldChargeLost: 20,
      mitigated: true,
    })
  })

  it('returns damage details for generic damage even without a shield', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        shield: null,
      },
    }
    const result = applyEffects(state, SHIELD_AWARE_DAMAGE_TEMPLATE, createRNG(1))

    expect(result.state.raider.hp).toBe(80)
    expect(result.shieldDamage).toMatchObject({
      hpDamage: 20,
      shieldChargeLost: 0,
      mitigated: false,
    })
  })

  it('treats negative generic damage as a no-op', () => {
    const initial = createInitialState(0)
    const result = applyEffects(initial, NEGATIVE_DAMAGE_TEMPLATE, createRNG(1))

    expect(result.state.raider.hp).toBe(initial.raider.hp)
    expect(result.state.raid.shield?.charge).toBe(initial.raid.shield?.charge)
    expect(result.state.raid.shield?.durability).toBe(initial.raid.shield?.durability)
  })

  it('applies effects.greedLevel and clamps to 0-100', () => {
    const initial = createInitialState(0)
    const raised = applyEffects(initial, GREED_EFFECT_TEMPLATE, createRNG(1))
    expect(raised.state.raid.greedLevel).toBe(initial.raid.greedLevel + 5)

    const cappedHigh = applyEffects(
      { ...initial, raid: { ...initial.raid, greedLevel: 99 } },
      GREED_EFFECT_TEMPLATE,
      createRNG(1),
    )
    expect(cappedHigh.state.raid.greedLevel).toBe(100)

    const dropped = applyEffects(
      { ...initial, raid: { ...initial.raid, greedLevel: 1 } },
      { ...GREED_EFFECT_TEMPLATE, effects: { greedLevel: -10 } },
      createRNG(1),
    )
    expect(dropped.state.raid.greedLevel).toBe(0)
  })

  it('reports mood and greed deltas for event effects', () => {
    const initial = createInitialState(0)

    const raised = applyEffects(
      { ...initial, raider: { ...initial.raider, mood: 1 }, raid: { ...initial.raid, greedLevel: 10 } },
      { ...GREED_EFFECT_TEMPLATE, effects: { mood: 2, greedLevel: 5 } },
      createRNG(1),
    )
    expect(raised.effectLogText).toBe('Mood +2. Greed +5.')

    const dropped = applyEffects(
      { ...initial, raider: { ...initial.raider, mood: 1 }, raid: { ...initial.raid, greedLevel: 10 } },
      { ...GREED_EFFECT_TEMPLATE, effects: { mood: -3, greedLevel: -4 } },
      createRNG(1),
    )
    expect(dropped.effectLogText).toBe('Mood -3. Greed -4.')
  })

  it('reports only actual mood and greed deltas after clamping', () => {
    const initial = createInitialState(0)

    const capped = applyEffects(
      { ...initial, raider: { ...initial.raider, mood: 4 }, raid: { ...initial.raid, greedLevel: 98 } },
      { ...GREED_EFFECT_TEMPLATE, effects: { mood: 5, greedLevel: 5 } },
      createRNG(1),
    )
    expect(capped.state.raider.mood).toBe(5)
    expect(capped.state.raid.greedLevel).toBe(100)
    expect(capped.effectLogText).toBe('Mood +1. Greed +2.')

    const unchanged = applyEffects(
      { ...initial, raider: { ...initial.raider, mood: 5 }, raid: { ...initial.raid, greedLevel: 100 } },
      { ...GREED_EFFECT_TEMPLATE, effects: { mood: 5, greedLevel: 5 } },
      createRNG(1),
    )
    expect(unchanged.effectLogText).toBeUndefined()
  })

  it('still mitigates a full hit when the shield only has 1 charge left', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        shield: {
          ...initial.raid.shield!,
          charge: 1,
          durability: 82.5,
        },
      },
    }

    const result = applyEffects(state, { ...FIXED_DAMAGE_TEMPLATE, effects: { hp: -35 } }, createRNG(1))

    expect(result.state.raider.hp).toBe(79)
    expect(result.state.raid.shield?.charge).toBe(0)
    expect(result.state.raid.shield?.durability).toBe(82.25)
  })

  it('defeats a robot when the combat roll beats menace and awards robot loot', () => {
    const state = createInitialState(0)
    const result = resolveRobotEncounter(state, 'anxietick', createRNG(1), 0)

    expect(result).not.toBeNull()
    expect(result!.event.id).toBe('robot_anxietick_defeated')
    expect(result!.event.text).toContain('Well that tick needed to chill')
    expect(result!.state.raid.backpack).toHaveLength(1)
    expect(['anxietick_gear', 'robot_alloy']).toContain(result!.state.raid.backpack[0].itemId)
    expect(result!.state.raider.hp).toBe(state.raider.hp)
  })

  it('damages the raider when the combat roll does not beat menace', () => {
    const state = createInitialState(0)
    const result = resolveRobotEncounter(state, 'roomba_prime', createRNG(1), 0)

    expect(result).not.toBeNull()
    expect(result!.event.id).toBe('robot_roomba_prime_escaped')
    expect(result!.event.text).toContain('Shield lost 16 charge')
    expect(result!.event.text).toContain('10 HP damage landed')
    expect(result!.state.raider.hp).toBe(90)
    expect(result!.state.raid.shield?.charge).toBe(24)
    expect(result!.state.raid.backpack).toHaveLength(0)
  })

  it('reduces robot damage when mood is positive but leaves raw robot damage unchanged', () => {
    const neutral = {
      ...createInitialState(0),
      raider: { ...createInitialState(0).raider, mood: 0 },
    }
    const upbeat = {
      ...createInitialState(0),
      raider: { ...createInitialState(0).raider, mood: 5 },
    }

    const neutralResult = resolveRobotEncounter(neutral, 'roomba_prime', createRNG(1), 0)
    const upbeatResult = resolveRobotEncounter(upbeat, 'roomba_prime', createRNG(1), 0)

    expect(neutralResult).not.toBeNull()
    expect(upbeatResult).not.toBeNull()
    expect(neutralResult!.event.text).toContain('Shield lost 16 charge')
    expect(neutralResult!.event.text).toContain('Shield lost 16 charge and mitigated 6 damage; 10 HP damage landed')
    expect(upbeatResult!.event.text).toContain('Incoming 16 damage. Resilience mitigated 2 damage before shields. Shield lost 14 charge and mitigated 5 damage; 9 HP damage landed')
    expect(upbeatResult!.state.raider.hp).toBeGreaterThan(neutralResult!.state.raider.hp)
    expect(upbeatResult!.state.raid.shield?.charge).toBeGreaterThan(neutralResult!.state.raid.shield!.charge)
    expect(upbeatResult!.state.raid.shield?.durability).toBeGreaterThan(neutralResult!.state.raid.shield!.durability)
  })

  it('shows the mood resilience callout even when no shield is active', () => {
    const state = {
      ...createInitialState(0),
      raider: { ...createInitialState(0).raider, mood: 5 },
      raid: { ...createInitialState(0).raid, shield: null },
    }

    const result = resolveRobotEncounter(state, 'roomba_prime', createRNG(1), 0)

    expect(result).not.toBeNull()
    expect(result!.event.text).toContain('Incoming 16 damage')
    expect(result!.event.text).toContain('Resilience mitigated 2 damage before shields')
    expect(result!.event.text).toContain('Took 14 damage')
    expect(result!.state.raider.hp).toBe(86)
  })

  it('adds Raider Level title-band resilience to mood resilience', () => {
    const base = createInitialState(0)
    const lowLevel = {
      ...base,
      raider: { ...base.raider, mood: 5, levelXp: 0 },
      raid: { ...base.raid, dangerLevel: 'High' as const, shield: null },
    }
    const maxLevel = {
      ...base,
      raider: { ...base.raider, mood: 5, levelXp: xpRequiredForLevel(75) },
      raid: { ...base.raid, dangerLevel: 'High' as const, shield: null },
    }

    const lowLevelResult = resolveRobotEncounter(lowLevel, 'tank_overcompensation', createRNG(1), 0)
    const maxLevelResult = resolveRobotEncounter(maxLevel, 'tank_overcompensation', createRNG(1), 0)

    expect(lowLevelResult).not.toBeNull()
    expect(maxLevelResult).not.toBeNull()
    expect(maxLevelResult!.state.raider.hp).toBeGreaterThan(lowLevelResult!.state.raider.hp)
    expect(maxLevelResult!.event.text).toContain('Resilience mitigated')
  })

  it('scales failed robot damage by danger-level profile', () => {
    const initial = createInitialState(0)
    const medium = resolveRobotEncounter(
      { ...initial, raid: { ...initial.raid, dangerLevel: 'Medium' } },
      'roomba_prime',
      createRNG(1),
      0,
    )
    const high = resolveRobotEncounter(
      { ...initial, raid: { ...initial.raid, dangerLevel: 'High' } },
      'roomba_prime',
      createRNG(1),
      0,
    )

    expect(medium).not.toBeNull()
    expect(high).not.toBeNull()
    expect(medium!.state.raider.hp).toBe(85)
    expect(high!.state.raider.hp).toBe(80)
  })

  it('falls back to the baseline profile when danger level data is invalid', () => {
    const state = {
      ...createInitialState(0),
      raid: { ...createInitialState(0).raid, dangerLevel: 'Broken' as any },
    }

    const result = resolveEvent(state, createRNG(1), 0)

    expect(result).not.toBeNull()
    expect(result!.phase).toBe('HUB')
  })

  it('applies encounter-specific damage multipliers only on failed robot encounters', () => {
    const state = createInitialState(0)
    const failed = resolveRobotEncounter(state, 'tattletale', createRNG(7), 0, { damageMultiplier: 7 })
    const defeated = resolveRobotEncounter(state, 'anxietick', createRNG(1), 0, { damageMultiplier: 10 })

    expect(failed).not.toBeNull()
    expect(failed!.event.id).toBe('robot_tattletale_escaped')
    expect(failed!.event.text).toContain('Shield lost 40 charge')
    expect(failed!.event.text).toContain('26 HP damage landed')
    expect(failed!.state.raider.hp).toBe(74)

    expect(defeated).not.toBeNull()
    expect(defeated!.event.id).toBe('robot_anxietick_defeated')
    expect(defeated!.state.raider.hp).toBe(100)
  })

  it('does not let a failed robot encounter down a full-health raider', () => {
    const state = createInitialState(0)
    const result = resolveRobotEncounter(state, 'roomba_prime', createRNG(1), 0, { damageMultiplier: 3 })

    expect(result).not.toBeNull()
    expect(result!.event.id).toBe('robot_roomba_prime_escaped')
    expect(result!.event.text).toContain('Shield lost 40 charge')
    expect(result!.event.text).toContain('29 HP damage landed')
    expect(result!.state.raider.hp).toBe(71)
  })

  it('calls out damage prevented by the nonlethal robot floor', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: { ...initial.raid, shield: null },
    }
    const result = resolveRobotEncounter(state, 'tattletale', createRNG(7), 0, { damageMultiplier: 14 })

    expect(result).not.toBeNull()
    expect(result!.event.id).toBe('robot_tattletale_escaped')
    expect(result!.event.text).toContain('Incoming 84 damage')
    expect(result!.event.text).toContain('Took 75 damage')
    expect(result!.event.text).toContain('Nonlethal floor prevented 9 damage')
    expect(result!.state.raider.hp).toBe(25)
  })

  it('only lets nasty and deadly robots down already-wounded raiders', () => {
    const initial = createInitialState(0)
    const wounded = {
      ...initial,
      raider: { ...initial.raider, hp: 40 },
    }
    const deadly = resolveRobotEncounter(wounded, 'roomba_prime', createRNG(1), 0, { damageMultiplier: 3 })
    const moderate = resolveRobotEncounter(wounded, 'tattletale', createRNG(7), 0, { damageMultiplier: 7 })

    expect(deadly).not.toBeNull()
    expect(deadly!.event.id).toBe('robot_roomba_prime_escaped')
    expect(deadly!.event.text).toContain('Shield lost 40 charge')
    expect(deadly!.state.raider.hp).toBe(11)

    expect(moderate).not.toBeNull()
    expect(moderate!.event.id).toBe('robot_tattletale_escaped')
    expect(moderate!.state.raider.hp).toBe(14)
  })

  it('finds a current-raid healing item without adding stash loot', () => {
    const state = {
      ...createInitialState(0),
      raid: { ...createInitialState(0).raid, phase: 'RAIDING' as const },
    }

    const result = resolveHealingItemFind(state, createRNG(1), 0)

    expect(result.event.id).toMatch(/^healing_bandage_.*_found$/)
    expect(result.state.raid.healingItems).toHaveLength(1)
    expect(result.state.raid.backpack).toHaveLength(0)
    expect(result.state.homeStash).toHaveLength(0)
  })

  it('finds a shield recharger as backpack loot', () => {
    const state = {
      ...createInitialState(0),
      raid: { ...createInitialState(0).raid, phase: 'RAIDING' as const },
    }

    const result = resolveShieldRechargerFind(state, createRNG(1), 0)

    expect(result.event.id).toMatch(/^shield_recharger_.*_found$/)
    expect(result.state.raid.backpack).toHaveLength(1)
    expect(result.state.raid.backpack[0].kind).toBe('shield_recharger')
    expect(result.state.raid.backpack[0].shieldChargeAmount).toBeGreaterThan(0)
  })

  it('preserves shield recharger applyTicks when found', () => {
    const state = {
      ...createInitialState(0),
      raid: { ...createInitialState(0).raid, phase: 'RAIDING' as const },
    }
    const fakeRng = {
      weightedPick: () => ({
        id: 'instant_cell',
        weight: 1,
        rarity: 4,
        name: 'Instant Cell',
        value: 50,
        chargeAmount: 30,
        applyTicks: 0,
      }),
    } as unknown as Parameters<typeof resolveShieldRechargerFind>[1]

    const result = resolveShieldRechargerFind(state, fakeRng, 0)

    expect(result.state.raid.backpack).toHaveLength(1)
    expect(result.state.raid.backpack[0].applyTicks).toBe(0)
  })

  it('uses a backpack shield recharger to restore shield charge', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        shield: {
          ...initial.raid.shield!,
          charge: 5,
          durability: 80,
        },
        backpack: [
          {
            itemId: 'panic_capacitor',
            name: 'Panic Capacitor',
            value: 70,
            rarity: 4,
            quantity: 1,
            kind: 'shield_recharger' as const,
            shieldChargeAmount: 50,
          },
        ],
        backpackValue: 70,
      },
    }

    const result = consumeShieldRecharger(state, 'panic_capacitor', 0)

    expect(result).not.toBeNull()
    expect(result!.event.id).toBe('shield_recharger_panic_capacitor_started')
    expect(result!.state.raid.shield?.charge).toBe(5)
    expect(result!.state.raid.shield?.durability).toBe(80)
    expect(result!.state.raid.backpack).toEqual([])
    expect(result!.state.raid.backpackValue).toBe(0)
    expect(result!.state.raid.activeShieldRecharge).toMatchObject({
      itemId: 'panic_capacitor',
      chargeRemaining: 50,
      totalTicks: 5,
      ticksRemaining: 5,
    })
  })

  it('supports future instant shield rechargers', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        shield: {
          ...initial.raid.shield!,
          charge: 5,
          durability: 80,
        },
        backpack: [
          {
            itemId: 'flash_cell',
            name: 'Flash Cell',
            value: 55,
            rarity: 4,
            quantity: 1,
            kind: 'shield_recharger' as const,
            shieldChargeAmount: 35,
            applyTicks: 0,
          },
        ],
        backpackValue: 55,
      },
    }

    const result = consumeShieldRecharger(state, 'flash_cell', 0)

    expect(result).not.toBeNull()
    expect(result!.event.id).toBe('shield_recharger_flash_cell_used')
    expect(result!.state.raid.shield?.charge).toBe(40)
    expect(result!.state.raid.activeShieldRecharge).toBeNull()
    expect(result!.state.raid.backpack).toEqual([])
    expect(result!.state.raid.backpackValue).toBe(0)
  })

  it('cannot use a shield recharger at full charge', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'RAIDING' as const,
        backpack: [
          {
            itemId: 'fizz_cell',
            name: 'Fizz Cell',
            value: 12,
            rarity: 1,
            quantity: 1,
            kind: 'shield_recharger' as const,
            shieldChargeAmount: 20,
          },
        ],
        backpackValue: 12,
      },
    }

    expect(consumeShieldRecharger(state, 'fizz_cell', 0)).toBeNull()
  })

  it('cannot use a shield recharger outside RAIDING', () => {
    const initial = createInitialState(0)
    const state = {
      ...initial,
      raid: {
        ...initial.raid,
        phase: 'DEPLOYING' as const,
        shield: {
          ...initial.raid.shield!,
          charge: 5,
          durability: 80,
        },
        backpack: [
          {
            itemId: 'fizz_cell',
            name: 'Fizz Cell',
            value: 12,
            rarity: 1,
            quantity: 1,
            kind: 'shield_recharger' as const,
            shieldChargeAmount: 20,
          },
        ],
        backpackValue: 12,
      },
    }

    expect(consumeShieldRecharger(state, 'fizz_cell', 0)).toBeNull()
  })

  it('uses the selected current-raid bandage', () => {
    const state = {
      ...createInitialState(0),
      raider: { ...createInitialState(0).raider, hp: 75, mood: -2 },
      raid: {
        ...createInitialState(0).raid,
        phase: 'RAIDING' as const,
        healingItems: [
          makeBandage({ itemId: 'bandage_white', name: 'White Bandage', healAmount: 5, rarity: 1 }),
          makeBandage({ itemId: 'bandage_blue', name: 'Blue Bandage', healAmount: 25, moodGain: 3, rarity: 3 }),
          makeBandage({ itemId: 'bandage_purple', name: 'Purple Bandage', healAmount: 50, moodGain: 4, rarity: 4 }),
        ],
      },
    }

    const result = consumeHealingItem(state, 'bandage_blue', 0)

    expect(result).not.toBeNull()
    expect(result!.event.id).toBe('healing_bandage_blue_used')
    expect(result!.event.text).toContain('gained 3 mood')
    expect(result!.state.raider.hp).toBe(100)
    expect(result!.state.raider.mood).toBe(1)
    expect(result!.state.raid.healingItems.map(item => item.itemId)).toEqual([
      'bandage_white',
      'bandage_purple',
    ])
  })

  it('allows manual bandage use even above the old auto-heal threshold', () => {
    const state = {
      ...createInitialState(0),
      raider: { ...createInitialState(0).raider, hp: 80 },
      raid: {
        ...createInitialState(0).raid,
        phase: 'RAIDING' as const,
        healingItems: [makeBandage({ itemId: 'bandage_blue', name: 'Blue Bandage', healAmount: 25, rarity: 3 })],
      },
    }

    const result = consumeHealingItem(state, 'bandage_blue', 0)
    expect(result).not.toBeNull()
    expect(result!.state.raider.hp).toBe(100)
  })

  it('never heals more than 50 HP from one bandage use', () => {
    const state = {
      ...createInitialState(0),
      raider: { ...createInitialState(0).raider, hp: 10 },
      raid: {
        ...createInitialState(0).raid,
        phase: 'RAIDING' as const,
        healingItems: [makeBandage({ itemId: 'bandage_purple', name: 'Purple Bandage', healAmount: 50, rarity: 4 })],
      },
    }

    const result = consumeHealingItem(state, 'bandage_purple', 0)

    expect(result).not.toBeNull()
    expect(result!.state.raider.hp).toBe(60)
    expect(result!.event.text).toContain('Restored 50 HP')
  })

  it('caps healing mood gains at the raider mood maximum', () => {
    const state = {
      ...createInitialState(0),
      raider: { ...createInitialState(0).raider, hp: 50, mood: 4 },
      raid: {
        ...createInitialState(0).raid,
        phase: 'RAIDING' as const,
        healingItems: [makeBandage({ itemId: 'bandage_purple', name: 'Purple Bandage', healAmount: 50, moodGain: 4, rarity: 4 })],
      },
    }

    const result = consumeHealingItem(state, 'bandage_purple', 0)

    expect(result).not.toBeNull()
    expect(result!.state.raider.mood).toBe(5)
  })

  it('cannot heal from home stash items without current-raid bandages', () => {
    const state = {
      ...createInitialState(0),
      raider: { ...createInitialState(0).raider, hp: 50 },
      homeStash: [
        {
          itemId: 'bandage_white',
          name: 'White Bandage',
          value: 0,
          rarity: 1,
          quantity: 1,
        },
      ],
      raid: { ...createInitialState(0).raid, phase: 'RAIDING' as const, healingItems: [] },
    }

    expect(consumeHealingItem(state, 'bandage_white', 0)).toBeNull()
  })

  it('does not use a bandage that is not in the current-raid med pocket', () => {
    const state = {
      ...createInitialState(0),
      raider: { ...createInitialState(0).raider, hp: 50 },
      raid: {
        ...createInitialState(0).raid,
        phase: 'RAIDING' as const,
        healingItems: [makeBandage({ itemId: 'bandage_white' })],
      },
    }

    expect(consumeHealingItem(state, 'bandage_blue', 0)).toBeNull()
  })
})
