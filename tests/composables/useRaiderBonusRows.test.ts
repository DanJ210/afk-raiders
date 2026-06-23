import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { createInitialState } from '../../src/engine/initialState'
import { skillDefinitionById } from '../../src/engine/skills'
import { xpRequiredForLevel } from '../../src/engine/raiderLevel'
import { useRaiderBonusRows } from '../../src/composables/useRaiderBonusRows'

describe('useRaiderBonusRows', () => {
  it('describes Raider Level and skill bonuses with their affected mechanics', () => {
    const initial = createInitialState(0)
    const raider = ref({
      ...initial.raider,
      levelXp: xpRequiredForLevel(10),
      skills: {
        ...initial.raider.skills,
        cardio: {
          ...initial.raider.skills.cardio,
          level: 2,
          xp: skillDefinitionById('cardio').xpThresholds[1],
          discovered: true,
        },
        hoarding: {
          ...initial.raider.skills.hoarding,
          level: 3,
          xp: skillDefinitionById('hoarding').xpThresholds[2],
          discovered: true,
        },
        hiding_in_lockers: {
          ...initial.raider.skills.hiding_in_lockers,
          level: 4,
          xp: skillDefinitionById('hiding_in_lockers').xpThresholds[3],
          discovered: true,
        },
        signal_handling: {
          ...initial.raider.skills.signal_handling,
          level: 1,
          xp: skillDefinitionById('signal_handling').xpThresholds[0],
          discovered: true,
        },
      },
    })

    const viewModel = useRaiderBonusRows(raider)
    const rows = Object.fromEntries(viewModel.rows.value.map(row => [row.id, row]))

    expect(rows.raider_level_extraction_stipend).toMatchObject({
      source: 'Raider Level 10',
      mechanic: 'Successful extraction coin stipend',
      value: '+1 coin per extract',
    })
    expect(rows.raider_level_resilience).toMatchObject({
      mechanic: 'Failed robot damage before shields',
      value: '0.2% resilience trim',
    })
    expect(rows.cardio_extraction_chance).toMatchObject({
      source: 'Cardio Level 2',
      mechanic: 'Natural extraction chance',
      value: '+0.3 percentage points',
    })
    expect(rows.cardio_raid_safety).toMatchObject({
      mechanic: 'Ambient RAIDING downed pressure',
      value: '6% reduction',
    })
    expect(rows.hoarding_loot_value).toMatchObject({
      source: 'Hoarding Level 3',
      mechanic: 'Loot value rolls',
      value: '+3% value',
    })
    expect(rows.hoarding_bonus_consumables).toMatchObject({
      mechanic: 'Bonus field meds and shield rechargers on loot',
      value: '+1.5 percentage points',
    })
    expect(rows.hiding_robot_damage).toMatchObject({
      source: 'Hiding in Lockers Level 4',
      mechanic: 'Failed robot encounter damage before shields',
      value: '10% reduction',
    })
    expect(rows.signal_handling_progression).toMatchObject({
      source: 'Signal Handling Level 1',
      mechanic: 'Handler Signal use progression',
      value: 'No direct survival modifier for MVP',
    })
  })
})
