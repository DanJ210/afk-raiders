import { describe, expect, it } from 'vitest'
import { applySkillPractice, createInitialSkills, getSkillModifierProfile, normalizeSkills, rollSkillPractice, skillDefinitionById } from '../../src/engine/skills'
import { createRNG } from '../../src/engine/rng'

describe('skill progression helpers', () => {
  it('creates all parody skill tracks at level 0', () => {
    const skills = createInitialSkills()

    expect(skills.cardio).toMatchObject({ id: 'cardio', level: 0, xp: 0, discovered: false })
    expect(skills.hoarding).toMatchObject({ id: 'hoarding', level: 0, xp: 0, discovered: false })
    expect(skills.hiding_in_lockers).toMatchObject({ id: 'hiding_in_lockers', level: 0, xp: 0, discovered: false })
  })

  it('levels a skill when practice reaches the next threshold', () => {
    const initial = createInitialSkills()
    const result = applySkillPractice(initial, [
      { skillId: 'cardio', reason: 'extraction_success', xp: 8 },
    ])

    expect(result.skills.cardio.level).toBe(1)
    expect(result.skills.cardio.discovered).toBe(true)
    expect(result.levelUps).toEqual([
      {
        skillId: 'cardio',
        name: 'Cardio',
        level: 1,
        text: 'Skill acquired: Cardio. Raider discovered lungs can be negotiated with.',
      },
    ])
    expect(initial.cardio.level).toBe(0)
  })

  it('caps XP and level at the skill max', () => {
    const initial = createInitialSkills()
    const definition = skillDefinitionById('hoarding')
    const result = applySkillPractice(initial, [
      { skillId: 'hoarding', reason: 'valuable_extraction', xp: 9999 },
    ])

    expect(result.skills.hoarding.level).toBe(definition.maxLevel)
    expect(result.skills.hoarding.xp).toBe(definition.xpThresholds.at(-1))
  })

  it('rolls practice XP through the seeded RNG', () => {
    const triggers = [
      { skillId: 'hiding_in_lockers' as const, reason: 'robot_survived' as const, minXp: 1, maxXp: 3 },
      { skillId: 'hiding_in_lockers' as const, reason: 'failed_extraction' as const, minXp: 1, maxXp: 3 },
    ]

    const first = rollSkillPractice(triggers, createRNG(123))
    const second = rollSkillPractice(triggers, createRNG(123))

    expect(first).toEqual(second)
    expect(first.every(gain => gain.xp >= 1 && gain.xp <= 3)).toBe(true)
  })

  it('normalizes missing or legacy skill state', () => {
    const skills = normalizeSkills({ cardio: { level: 2 } })

    expect(skills.cardio.level).toBe(2)
    expect(skills.cardio.discovered).toBe(true)
    expect(skills.cardio.xp).toBe(skillDefinitionById('cardio').xpThresholds[1])
    expect(skills.hoarding.level).toBe(0)
    expect(skills.hiding_in_lockers.level).toBe(0)
  })

  it('derives subtle mechanical modifiers from skill levels', () => {
    const initial = createInitialSkills()
    const skills = {
      ...initial,
      cardio: { ...initial.cardio, level: 3, xp: skillDefinitionById('cardio').xpThresholds[2], discovered: true },
      hoarding: { ...initial.hoarding, level: 2, xp: skillDefinitionById('hoarding').xpThresholds[1], discovered: true },
      hiding_in_lockers: { ...initial.hiding_in_lockers, level: 4, xp: skillDefinitionById('hiding_in_lockers').xpThresholds[3], discovered: true },
    }

    const modifiers = getSkillModifierProfile(skills)

    expect(modifiers.extractionChanceBonus).toBeGreaterThan(0)
    expect(modifiers.lootValueMultiplier).toBeGreaterThan(1)
    expect(modifiers.lootBonusConsumableChanceBonus).toBeGreaterThan(0)
    expect(modifiers.robotFailureDamageMultiplier).toBeLessThan(1)
    expect(modifiers.greedDeathChanceMultiplier).toBeLessThan(1)
  })
})