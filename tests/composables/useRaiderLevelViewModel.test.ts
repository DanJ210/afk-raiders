import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useRaiderLevelViewModel } from '../../src/composables/useRaiderLevelViewModel'
import { xpRequiredForLevel } from '../../src/engine/raiderLevel'

describe('useRaiderLevelViewModel', () => {
  it('derives level title and XP progress labels', () => {
    const raider = ref({
      levelXp: xpRequiredForLevel(2) + 10,
    })

    const viewModel = useRaiderLevelViewModel(raider)

    expect(viewModel.progress.value.level).toBe(2)
    expect(viewModel.progress.value.title.name).toBe('Freshly Briefed Liability')
    expect(viewModel.progress.value.xpIntoLevel).toBe(10)
    expect(viewModel.xpLabel.value).toBe(`10/${viewModel.progress.value.xpForNextLevel}`)
    expect(viewModel.benefitLabel.value).toBe('Stipend locked')
  })

  it('formats unlocked title-band stipend benefits', () => {
    const raider = ref({
      levelXp: xpRequiredForLevel(10),
    })

    const viewModel = useRaiderLevelViewModel(raider)

    expect(viewModel.progress.value.level).toBe(10)
    expect(viewModel.benefitLabel.value).toBe('Stipend +1/extract')
  })
})