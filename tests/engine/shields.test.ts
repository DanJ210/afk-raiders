/**
 * Focused tests for the shield helper module.
 *
 * Verifies that shield recharge progresses deterministically over the expected
 * number of ticks and that instant rechargers bypass the timed queue.
 */

import { describe, it, expect } from 'vitest'
import { createInitialState } from '../../src/engine/initialState'
import { advanceShieldRecharge, startShieldRecharge } from '../../src/engine/shields'

describe('shield recharge helpers', () => {
  it('applies a timed shield recharge over five ticks', () => {
    const initial = createInitialState(0)
    const raidState = {
      ...initial.raid,
      shield: {
        ...initial.raid.shield!,
        charge: 5,
        durability: 80,
      },
    }
    const started = startShieldRecharge(raidState, {
      itemId: 'panic_capacitor',
      name: 'Panic Capacitor',
      chargeAmount: 35,
      applyTicks: 5,
    })

    expect(started.completedImmediately).toBe(false)
    expect(started.raid.activeShieldRecharge).not.toBeNull()

    let currentRaid = started.raid
    for (let i = 0; i < 5; i += 1) {
      const result = advanceShieldRecharge(currentRaid)
      currentRaid = result.raid
      if (i < 4) {
        expect(result.completed).toBe(false)
        expect(currentRaid.activeShieldRecharge).not.toBeNull()
      }
    }

    expect(currentRaid.shield?.charge).toBe(40)
    expect(currentRaid.activeShieldRecharge).toBeNull()
  })

  it('supports instant shield rechargers for future items', () => {
    const initial = createInitialState(0)
    const raidState = {
      ...initial.raid,
      shield: {
        ...initial.raid.shield!,
        charge: 5,
        durability: 80,
      },
    }
    const started = startShieldRecharge(raidState, {
      itemId: 'flash_cell',
      name: 'Flash Cell',
      chargeAmount: 35,
      applyTicks: 0,
    })

    expect(started.completedImmediately).toBe(true)
    expect(started.raid.activeShieldRecharge).toBeNull()
    expect(started.raid.shield?.charge).toBe(40)
  })
})
