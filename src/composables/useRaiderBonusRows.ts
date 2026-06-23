import { computed } from 'vue'
import type { RaiderStats } from '../engine/types.js'
import { getRaiderLevelBenefitProfile } from '../engine/raiderLevel.js'
import { getSkillLevel, getSkillModifierProfile } from '../engine/skills.js'

export interface RaiderBonusRow {
  id: string
  source: string
  mechanic: string
  value: string
}

function formatAmount(value: number, fractionDigits = 2): string {
  return value
    .toFixed(fractionDigits)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*?)0+$/, '$1')
}

function formatPercent(value: number): string {
  return `${formatAmount(value, 2)}%`
}

function formatPercentPoints(value: number): string {
  return `${formatAmount(value * 100, 2)} percentage points`
}

export function useRaiderBonusRows(raiderRef: { value: Pick<RaiderStats, 'levelXp' | 'skills'> }) {
  const rows = computed<RaiderBonusRow[]>(() => {
    const levelBenefits = getRaiderLevelBenefitProfile(raiderRef.value.levelXp)
    const skillModifiers = getSkillModifierProfile(raiderRef.value.skills)
    const cardioLevel = getSkillLevel(raiderRef.value.skills, 'cardio')
    const hoardingLevel = getSkillLevel(raiderRef.value.skills, 'hoarding')
    const hidingLevel = getSkillLevel(raiderRef.value.skills, 'hiding_in_lockers')
    const signalHandlingLevel = getSkillLevel(raiderRef.value.skills, 'signal_handling')
    const extractionCoinLabel = levelBenefits.extractionCoinBonus === 1 ? 'coin' : 'coins'

    return [
      {
        id: 'raider_level_extraction_stipend',
        source: `Raider Level ${levelBenefits.level}`,
        mechanic: 'Successful extraction coin stipend',
        value: `+${levelBenefits.extractionCoinBonus} ${extractionCoinLabel} per extract`,
      },
      {
        id: 'raider_level_resilience',
        source: `Raider Level ${levelBenefits.level}`,
        mechanic: 'Failed robot damage before shields',
        value: `${formatPercent(levelBenefits.resilienceReductionPercent)} resilience trim`,
      },
      {
        id: 'cardio_extraction_chance',
        source: `Cardio Level ${cardioLevel}`,
        mechanic: 'Natural extraction chance',
        value: `+${formatPercentPoints(skillModifiers.extractionChanceBonus)}`,
      },
      {
        id: 'cardio_raid_safety',
        source: `Cardio Level ${cardioLevel}`,
        mechanic: 'Ambient RAIDING downed pressure',
        value: `${formatPercent((1 - skillModifiers.ambientRaidDeathChanceMultiplier) * 100)} reduction`,
      },
      {
        id: 'hoarding_loot_value',
        source: `Hoarding Level ${hoardingLevel}`,
        mechanic: 'Loot value rolls',
        value: `+${formatPercent((skillModifiers.lootValueMultiplier - 1) * 100)} value`,
      },
      {
        id: 'hoarding_bonus_consumables',
        source: `Hoarding Level ${hoardingLevel}`,
        mechanic: 'Bonus field meds and shield rechargers on loot',
        value: `+${formatPercentPoints(skillModifiers.lootBonusConsumableChanceBonus)}`,
      },
      {
        id: 'hiding_robot_damage',
        source: `Hiding in Lockers Level ${hidingLevel}`,
        mechanic: 'Failed robot encounter damage before shields',
        value: `${formatPercent((1 - skillModifiers.robotFailureDamageMultiplier) * 100)} reduction`,
      },
      {
        id: 'signal_handling_progression',
        source: `Signal Handling Level ${signalHandlingLevel}`,
        mechanic: 'Handler Signal use progression',
        value: 'No direct survival modifier for MVP',
      },
    ]
  })

  return { rows }
}
