import { computed } from 'vue'
import type { RaiderSkillsState, SkillDefinition, SkillTrackId } from '../engine/types.js'
import { SKILL_TRACK_IDS, skillDefinitionById } from '../engine/skills.js'

export interface SkillRow {
  id: SkillTrackId
  name: string
  description: string
  level: number
  maxLevel: number
  xp: number
  currentLevelXp: number
  nextLevelXp: number
  progressPercent: number
  isMaxed: boolean
  effectText: string
  nextEffectText: string | null
}

function thresholdForLevel(definition: SkillDefinition, level: number): number {
  if (level <= 0) return 0
  return definition.xpThresholds[level - 1] ?? definition.xpThresholds.at(-1) ?? 0
}

function skillRow(skillId: SkillTrackId, skills: RaiderSkillsState): SkillRow {
  const definition = skillDefinitionById(skillId)
  const progress = skills[skillId]
  const level = progress?.level ?? 0
  const xp = progress?.xp ?? 0
  const isMaxed = level >= definition.maxLevel
  const currentLevelXp = thresholdForLevel(definition, level)
  const nextLevelXp = thresholdForLevel(definition, Math.min(definition.maxLevel, level + 1))
  const neededForLevel = Math.max(1, nextLevelXp - currentLevelXp)
  const progressIntoLevel = Math.max(0, xp - currentLevelXp)
  const progressPercent = isMaxed
    ? 100
    : Math.max(0, Math.min(100, Math.round((progressIntoLevel / neededForLevel) * 100)))

  return {
    id: skillId,
    name: definition.name,
    description: definition.description,
    level,
    maxLevel: definition.maxLevel,
    xp,
    currentLevelXp,
    nextLevelXp,
    progressPercent,
    isMaxed,
    effectText: definition.effectTextByLevel[level] ?? definition.effectTextByLevel[0] ?? '',
    nextEffectText: isMaxed ? null : definition.effectTextByLevel[level + 1] ?? null,
  }
}

export function useSkillsViewModel(skillsRef: { value: RaiderSkillsState }) {
  const rows = computed(() => SKILL_TRACK_IDS.map(skillId => skillRow(skillId, skillsRef.value)))
  const learnedCount = computed(() => rows.value.filter(row => row.level > 0).length)
  const totalLevel = computed(() => rows.value.reduce((sum, row) => sum + row.level, 0))

  return {
    rows,
    learnedCount,
    totalLevel,
  }
}