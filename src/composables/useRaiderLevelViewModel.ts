import { computed } from 'vue'
import type { RaiderStats } from '../engine/types.js'
import { getRaiderLevelProgress } from '../engine/raiderLevel.js'

export function useRaiderLevelViewModel(raiderRef: { value: Pick<RaiderStats, 'levelXp'> }) {
  const progress = computed(() => getRaiderLevelProgress(raiderRef.value.levelXp))
  const xpLabel = computed(() => progress.value.isMaxLevel
    ? 'MAX'
    : `${progress.value.xpIntoLevel}/${progress.value.xpForNextLevel}`)

  return {
    progress,
    xpLabel,
  }
}