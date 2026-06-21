import { computed } from 'vue'
import type { RaiderStats } from '../engine/types.js'
import { getRaiderLevelBenefitProfile, getRaiderLevelProgress } from '../engine/raiderLevel.js'

export function useRaiderLevelViewModel(raiderRef: { value: Pick<RaiderStats, 'levelXp'> }) {
  const progress = computed(() => getRaiderLevelProgress(raiderRef.value.levelXp))
  const benefits = computed(() => getRaiderLevelBenefitProfile(raiderRef.value.levelXp))
  const xpLabel = computed(() => progress.value.isMaxLevel
    ? 'MAX'
    : `${progress.value.xpIntoLevel}/${progress.value.xpForNextLevel}`)
  const benefitLabel = computed(() => benefits.value.extractionCoinBonus > 0
    ? `Stipend +${benefits.value.extractionCoinBonus}/extract`
    : 'Stipend locked')

  return {
    progress,
    benefits,
    xpLabel,
    benefitLabel,
  }
}