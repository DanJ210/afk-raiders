import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { createInitialSkills, skillDefinitionById } from '../../src/engine/skills'
import { useSkillsViewModel } from '../../src/composables/useSkillsViewModel'

describe('useSkillsViewModel', () => {
  it('derives ordered skill rows and aggregate counts', () => {
    const initial = createInitialSkills()
    const hoardingDefinition = skillDefinitionById('hoarding')
    const hoardingLevelOneXp = hoardingDefinition.xpThresholds[0]
    const hoardingLevelTwoXp = hoardingDefinition.xpThresholds[1]
    const skills = ref({
      ...initial,
      hoarding: {
        ...initial.hoarding,
        level: 1,
        xp: hoardingLevelOneXp + Math.floor((hoardingLevelTwoXp - hoardingLevelOneXp) / 2),
        discovered: true,
      },
    })

    const viewModel = useSkillsViewModel(skills)
    const hoarding = viewModel.rows.value.find(row => row.id === 'hoarding')

    expect(viewModel.rows.value.map(row => row.id)).toEqual(['cardio', 'hoarding', 'hiding_in_lockers', 'signal_handling'])
    expect(viewModel.learnedCount.value).toBe(1)
    expect(viewModel.totalLevel.value).toBe(1)
    expect(hoarding?.name).toBe('Hoarding')
    expect(hoarding?.progressPercent).toBe(50)
    expect(hoarding?.nextEffectText).toBe('Bonus finds become slightly more likely.')
  })
})