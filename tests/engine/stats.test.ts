import { describe, expect, it } from 'vitest'
import { createInitialLifetimeStats, recordHealingItemUse, recordOutcome, recordRobotDefeat } from '../../src/engine/stats'

describe('lifetime stats helpers', () => {
  it('records extract/death totals and zone context', () => {
    const initial = createInitialLifetimeStats()
    const afterExtract = recordOutcome(initial, 'extracts', 'damp_battlegrounds', 'Medium')
    const afterDeath = recordOutcome(afterExtract, 'deaths', 'damp_battlegrounds', 'Medium')

    expect(afterExtract.extracts.total).toBe(1)
    expect(afterExtract.extracts.byZone.damp_battlegrounds).toBe(1)
    expect(afterExtract.extracts.byZoneAndDanger['damp_battlegrounds__Medium']).toBe(1)

    expect(afterDeath.deaths.total).toBe(1)
    expect(afterDeath.deaths.byZone.damp_battlegrounds).toBe(1)
    expect(afterDeath.deaths.byZoneAndDanger['damp_battlegrounds__Medium']).toBe(1)
  })

  it('records robot defeats by id', () => {
    const initial = createInitialLifetimeStats()
    const afterOne = recordRobotDefeat(initial, 'anxietick')
    const afterTwo = recordRobotDefeat(afterOne, 'anxietick')

    expect(afterTwo.robotDefeats.anxietick).toBe(2)
  })

  it('records healing item usage totals and by-item counts', () => {
    const initial = createInitialLifetimeStats()
    const afterOne = recordHealingItemUse(initial, 'bandage_blue')
    const afterTwo = recordHealingItemUse(afterOne, 'bandage_blue')
    const afterThree = recordHealingItemUse(afterTwo, 'bandage_purple')

    expect(afterThree.healingItemsUsed.total).toBe(3)
    expect(afterThree.healingItemsUsed.byItem.bandage_blue).toBe(2)
    expect(afterThree.healingItemsUsed.byItem.bandage_purple).toBe(1)
  })
})
