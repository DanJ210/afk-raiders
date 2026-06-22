import skillsData from '../content/skills.json'
import progressionConfigData from '../content/progression_config.json'
import type { RaiderSkillProgress, RaiderSkillsState, SkillDefinition, SkillTrackId } from './types.js'
import type { RNG } from './rng.js'

export const SKILL_TRACK_IDS: SkillTrackId[] = ['cardio', 'hoarding', 'hiding_in_lockers', 'signal_handling']

type SkillXpThresholdProfileId = 'standard' | 'prototype'

interface ProgressionConfig {
  skillXpThresholdProfile: SkillXpThresholdProfileId
  skillXpThresholdProfiles: Record<SkillXpThresholdProfileId, number[]>
}

const progressionConfig = progressionConfigData as ProgressionConfig

function activeSkillXpThresholds(definition: SkillDefinition): number[] {
  const thresholds = progressionConfig.skillXpThresholdProfiles[progressionConfig.skillXpThresholdProfile]
  if (!thresholds) {
    throw new Error(`Unknown skill XP threshold profile: ${progressionConfig.skillXpThresholdProfile}`)
  }
  if (thresholds.length !== definition.maxLevel) {
    throw new Error(`Skill XP threshold profile "${progressionConfig.skillXpThresholdProfile}" must define ${definition.maxLevel} thresholds`)
  }
  return thresholds
}

export const skillDefinitions = (skillsData as SkillDefinition[]).map(definition => ({
  ...definition,
  xpThresholds: [...activeSkillXpThresholds(definition)],
}))

const definitionById = new Map<SkillTrackId, SkillDefinition>()
for (const definition of skillDefinitions) {
  definitionById.set(definition.id, definition)
}

export type SkillPracticeReason =
  | 'extraction_started'
  | 'extraction_success'
  | 'low_hp_extraction'
  | 'high_danger_survived'
  | 'loot_added'
  | 'valuable_extraction'
  | 'stash_overflow_sale'
  | 'robot_survived'
  | 'failed_extraction'
  | 'hidden_pocket_saved'
  | 'signal_used'

export interface SkillPracticeTrigger {
  skillId: SkillTrackId
  reason: SkillPracticeReason
  minXp: number
  maxXp: number
}

export interface SkillPracticeGain {
  skillId: SkillTrackId
  reason: SkillPracticeReason
  xp: number
}

export interface SkillLevelUp {
  skillId: SkillTrackId
  name: string
  level: number
  text: string
}

export interface SkillPracticeResult {
  skills: RaiderSkillsState
  levelUps: SkillLevelUp[]
}

export interface SkillModifierProfile {
  extractionChanceBonus: number
  ambientRaidDeathChanceMultiplier: number
  lootValueMultiplier: number
  lootBonusConsumableChanceBonus: number
  robotFailureDamageMultiplier: number
}

const CARDIO_EXTRACT_CHANCE_PER_LEVEL = 0.0015
const CARDIO_AMBIENT_RAID_DEATH_REDUCTION_PER_LEVEL = 0.03
const HOARDING_LOOT_VALUE_PER_LEVEL = 0.01
const HOARDING_BONUS_CONSUMABLE_CHANCE_PER_LEVEL = 0.005
const HIDING_ROBOT_DAMAGE_REDUCTION_PER_LEVEL = 0.025

export function skillDefinitionById(skillId: SkillTrackId): SkillDefinition {
  const definition = definitionById.get(skillId)
  if (!definition) {
    throw new Error(`Unknown skill id: ${skillId}`)
  }
  return definition
}

function maxXpForDefinition(definition: SkillDefinition): number {
  return definition.xpThresholds[definition.maxLevel - 1] ?? 0
}

function clampLevel(definition: SkillDefinition, level: number): number {
  if (!Number.isFinite(level)) return 0
  return Math.max(0, Math.min(definition.maxLevel, Math.floor(level)))
}

function clampXp(definition: SkillDefinition, xp: number): number {
  if (!Number.isFinite(xp)) return 0
  return Math.max(0, Math.min(maxXpForDefinition(definition), Math.floor(xp)))
}

function minimumXpForLevel(definition: SkillDefinition, level: number): number {
  if (level <= 0) return 0
  return definition.xpThresholds[level - 1] ?? maxXpForDefinition(definition)
}

export function levelForXp(definition: SkillDefinition, xp: number): number {
  const cappedXp = clampXp(definition, xp)
  let level = 0
  for (const threshold of definition.xpThresholds) {
    if (cappedXp >= threshold) level += 1
  }
  return Math.min(definition.maxLevel, level)
}

function formatLevelUpText(definition: SkillDefinition, level: number): string {
  const template = definition.levelUpTextByLevel[level - 1] ?? `${definition.name} reached Level {level}.`
  return template
    .replace(/\{level\}/g, String(level))
    .replace(/\{skill\}/g, definition.name)
}

export function createInitialSkills(): RaiderSkillsState {
  return SKILL_TRACK_IDS.reduce((skills, skillId) => {
    skills[skillId] = {
      id: skillId,
      level: 0,
      xp: 0,
      discovered: false,
    }
    return skills
  }, {} as RaiderSkillsState)
}

function normalizeSkillProgress(skillId: SkillTrackId, raw: Partial<RaiderSkillProgress> | undefined): RaiderSkillProgress {
  const definition = skillDefinitionById(skillId)
  const savedLevel = clampLevel(definition, raw?.level ?? 0)
  const savedXp = clampXp(definition, raw?.xp ?? 0)
  const xp = Math.max(savedXp, minimumXpForLevel(definition, savedLevel))
  const level = Math.max(savedLevel, levelForXp(definition, xp))

  return {
    id: skillId,
    level,
    xp,
    discovered: Boolean(raw?.discovered) || level > 0,
  }
}

export function normalizeSkills(rawSkills: unknown): RaiderSkillsState {
  if (!rawSkills || typeof rawSkills !== 'object') return createInitialSkills()

  const partialSkills = rawSkills as Partial<Record<SkillTrackId, Partial<RaiderSkillProgress>>>
  return SKILL_TRACK_IDS.reduce((skills, skillId) => {
    skills[skillId] = normalizeSkillProgress(skillId, partialSkills[skillId])
    return skills
  }, {} as RaiderSkillsState)
}

export function getSkillLevel(skills: RaiderSkillsState | undefined, skillId: SkillTrackId): number {
  return normalizeSkillProgress(skillId, skills?.[skillId]).level
}

export function rollSkillPractice(triggers: SkillPracticeTrigger[], rng: RNG): SkillPracticeGain[] {
  return triggers
    .map(trigger => {
      const minXp = Math.max(0, Math.floor(trigger.minXp))
      const maxXp = Math.max(minXp, Math.floor(trigger.maxXp))
      const xp = minXp === maxXp ? minXp : rng.int(minXp, maxXp)
      return { skillId: trigger.skillId, reason: trigger.reason, xp }
    })
    .filter(gain => gain.xp > 0)
}

export function applySkillPractice(skills: RaiderSkillsState, gains: SkillPracticeGain[]): SkillPracticeResult {
  if (gains.length === 0) return { skills, levelUps: [] }

  const nextSkills = normalizeSkills(skills)
  const levelUps: SkillLevelUp[] = []
  const gainsBySkill = new Map<SkillTrackId, number>()

  for (const gain of gains) {
    gainsBySkill.set(gain.skillId, (gainsBySkill.get(gain.skillId) ?? 0) + gain.xp)
  }

  for (const skillId of SKILL_TRACK_IDS) {
    const totalGain = gainsBySkill.get(skillId) ?? 0
    if (totalGain <= 0) continue

    const definition = skillDefinitionById(skillId)
    const current = nextSkills[skillId]
    const xp = clampXp(definition, current.xp + totalGain)
    const level = levelForXp(definition, xp)
    nextSkills[skillId] = {
      ...current,
      xp,
      level,
      discovered: current.discovered || level > 0,
    }

    for (let nextLevel = current.level + 1; nextLevel <= level; nextLevel += 1) {
      levelUps.push({
        skillId,
        name: definition.name,
        level: nextLevel,
        text: formatLevelUpText(definition, nextLevel),
      })
    }
  }

  return { skills: nextSkills, levelUps }
}

export function getSkillModifierProfile(skills: RaiderSkillsState | undefined): SkillModifierProfile {
  const cardioLevel = getSkillLevel(skills, 'cardio')
  const hoardingLevel = getSkillLevel(skills, 'hoarding')
  const hidingLevel = getSkillLevel(skills, 'hiding_in_lockers')

  return {
    extractionChanceBonus: cardioLevel * CARDIO_EXTRACT_CHANCE_PER_LEVEL,
    ambientRaidDeathChanceMultiplier: Math.max(0.75, 1 - cardioLevel * CARDIO_AMBIENT_RAID_DEATH_REDUCTION_PER_LEVEL),
    lootValueMultiplier: 1 + hoardingLevel * HOARDING_LOOT_VALUE_PER_LEVEL,
    lootBonusConsumableChanceBonus: hoardingLevel * HOARDING_BONUS_CONSUMABLE_CHANCE_PER_LEVEL,
    robotFailureDamageMultiplier: Math.max(0.75, 1 - hidingLevel * HIDING_ROBOT_DAMAGE_REDUCTION_PER_LEVEL),
  }
}