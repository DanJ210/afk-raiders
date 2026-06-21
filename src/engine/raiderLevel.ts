import raiderLevelData from '../content/raider_levels.json'
import type { RaiderLevelContent, RaiderLevelTitleBand } from './types.js'

export const MAX_RAIDER_LEVEL = 75
export const RAIDER_LEVEL_RESILIENCE_PERCENT_PER_TITLE_BAND = 0.2

const content = raiderLevelData as RaiderLevelContent
const titleBands = [...content.titleBands].sort((a, b) => a.minLevel - b.minLevel)

export type RaiderXpReason =
  | 'loot_found'
  | 'loot_extracted'
  | 'extraction_success'
  | 'close_call_extraction'
  | 'high_danger_survived'
  | 'death_recovered'
  | 'hidden_pocket_saved'
  | 'stash_overflow_sale'
  | 'robot_defeated'
  | 'robot_survived'
  | 'failed_extraction'
  | 'skill_level_up'

export interface RaiderXpTrigger {
  reason: RaiderXpReason
  minXp: number
  maxXp: number
}

export interface RaiderXpGain {
  reason: RaiderXpReason
  xp: number
}

export interface RaiderLevelUp {
  level: number
  fromLevel: number
  levelsGained: number
  title: string
  text: string
}

export interface RaiderXpResult {
  levelXp: number
  level: number
  previousLevel: number
  xpGained: number
  levelUps: RaiderLevelUp[]
}

export interface RaiderLevelProgress {
  level: number
  levelXp: number
  currentLevelXp: number
  nextLevelXp: number
  xpIntoLevel: number
  xpForNextLevel: number
  progressPercent: number
  isMaxLevel: boolean
  title: RaiderLevelTitleBand
}

export interface RaiderLevelBenefitProfile {
  level: number
  titleBandIndex: number
  extractionCoinBonus: number
  resilienceReductionPercent: number
}

function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return 1
  return Math.max(1, Math.min(MAX_RAIDER_LEVEL, Math.floor(level)))
}

function xpNeededToAdvanceFromLevel(level: number): number {
  const clampedLevel = clampLevel(level)
  if (clampedLevel >= MAX_RAIDER_LEVEL) return 0
  return Math.floor(110 + clampedLevel * 28 + Math.pow(clampedLevel, 1.62) * 10 + Math.pow(clampedLevel, 2) * 0.7)
}

export function xpRequiredForLevel(level: number): number {
  const targetLevel = clampLevel(level)
  let total = 0
  for (let currentLevel = 1; currentLevel < targetLevel; currentLevel += 1) {
    total += xpNeededToAdvanceFromLevel(currentLevel)
  }
  return total
}

const MAX_RAIDER_LEVEL_XP = xpRequiredForLevel(MAX_RAIDER_LEVEL)

export function normalizeRaiderLevelXp(rawXp: unknown): number {
  const xp = typeof rawXp === 'number' && Number.isFinite(rawXp) ? rawXp : 0
  return Math.max(0, Math.min(MAX_RAIDER_LEVEL_XP, Math.floor(xp)))
}

export function getRaiderLevelFromXp(rawXp: unknown): number {
  const xp = normalizeRaiderLevelXp(rawXp)
  let level = 1
  for (let nextLevel = 2; nextLevel <= MAX_RAIDER_LEVEL; nextLevel += 1) {
    if (xp < xpRequiredForLevel(nextLevel)) break
    level = nextLevel
  }
  return level
}

export function getRaiderTitleBand(level: number): RaiderLevelTitleBand {
  const clampedLevel = clampLevel(level)
  const band = titleBands.find(entry => clampedLevel >= entry.minLevel && clampedLevel <= entry.maxLevel)
  if (!band) {
    throw new Error(`No Raider Level title band for level ${clampedLevel}`)
  }
  return band
}

export function getRaiderLevelProgress(rawXp: unknown): RaiderLevelProgress {
  const levelXp = normalizeRaiderLevelXp(rawXp)
  const level = getRaiderLevelFromXp(levelXp)
  const isMaxLevel = level >= MAX_RAIDER_LEVEL
  const currentLevelXp = xpRequiredForLevel(level)
  const nextLevelXp = isMaxLevel ? currentLevelXp : xpRequiredForLevel(level + 1)
  const xpForNextLevel = Math.max(0, nextLevelXp - currentLevelXp)
  const xpIntoLevel = isMaxLevel ? xpForNextLevel : Math.max(0, levelXp - currentLevelXp)
  const progressPercent = isMaxLevel
    ? 100
    : Math.max(0, Math.min(100, Math.round((xpIntoLevel / Math.max(1, xpForNextLevel)) * 100)))

  return {
    level,
    levelXp,
    currentLevelXp,
    nextLevelXp,
    xpIntoLevel,
    xpForNextLevel,
    progressPercent,
    isMaxLevel,
    title: getRaiderTitleBand(level),
  }
}

export function getRaiderLevelBenefitProfile(rawXp: unknown): RaiderLevelBenefitProfile {
  const level = getRaiderLevelFromXp(rawXp)
  const title = getRaiderTitleBand(level)
  const titleBandIndex = Math.max(0, titleBands.findIndex(entry => entry.id === title.id))

  return {
    level,
    titleBandIndex,
    extractionCoinBonus: titleBandIndex,
    resilienceReductionPercent: titleBandIndex * RAIDER_LEVEL_RESILIENCE_PERCENT_PER_TITLE_BAND,
  }
}

export function rollRaiderXp(triggers: RaiderXpTrigger[], rng: { int: (min: number, max: number) => number }): RaiderXpGain[] {
  return triggers
    .map(trigger => {
      const minXp = Math.max(0, Math.floor(trigger.minXp))
      const maxXp = Math.max(minXp, Math.floor(trigger.maxXp))
      const xp = minXp === maxXp ? minXp : rng.int(minXp, maxXp)
      return { reason: trigger.reason, xp }
    })
    .filter(gain => gain.xp > 0)
}

function formatLevelUpText(level: number, fromLevel: number): string {
  const title = getRaiderTitleBand(level)
  const templateIndex = Math.max(0, (level - title.minLevel) % title.levelUpText.length)
  const template = title.levelUpText[templateIndex] ?? 'Raider Level {level}: {title}.'
  return template
    .replace(/\{level\}/g, String(level))
    .replace(/\{fromLevel\}/g, String(fromLevel))
    .replace(/\{levelsGained\}/g, String(Math.max(1, level - fromLevel)))
    .replace(/\{title\}/g, title.name)
}

export function applyRaiderXpGain(levelXp: unknown, gains: RaiderXpGain[]): RaiderXpResult {
  const currentXp = normalizeRaiderLevelXp(levelXp)
  const previousLevel = getRaiderLevelFromXp(currentXp)
  const xpGained = gains.reduce((sum, gain) => sum + Math.max(0, Math.floor(gain.xp)), 0)
  if (xpGained <= 0) {
    return {
      levelXp: currentXp,
      level: previousLevel,
      previousLevel,
      xpGained: 0,
      levelUps: [],
    }
  }

  const nextXp = normalizeRaiderLevelXp(currentXp + xpGained)
  const level = getRaiderLevelFromXp(nextXp)
  const title = getRaiderTitleBand(level)
  const levelUps = level > previousLevel
    ? [
        {
          level,
          fromLevel: previousLevel,
          levelsGained: level - previousLevel,
          title: title.name,
          text: formatLevelUpText(level, previousLevel),
        },
      ]
    : []

  return {
    levelXp: nextXp,
    level,
    previousLevel,
    xpGained: nextXp - currentXp,
    levelUps,
  }
}