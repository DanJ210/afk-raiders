import { describe, expect, it } from 'vitest'
import { createInitialState } from '../../src/engine/initialState'
import { tickPhase, PHASE_DURATIONS } from '../../src/engine/raidStateMachine'
import { createRNG } from '../../src/engine/rng'

describe('raidStateMachine', () => {
  it('uses a 30 minute raiding timer at 30 second tick cadence', () => {
    expect(PHASE_DURATIONS.RAIDING).toBe(60)
  })

  it('assigns zone and danger level when HUB naturally expires into DEPLOYING', () => {
    const initial = createInitialState(0)
    const result = tickPhase(
      { ...initial.raid, phaseTicksRemaining: 1 },
      undefined,
      createRNG(1),
    )

    expect(result.transition?.from).toBe('HUB')
    expect(result.transition?.to).toBe('DEPLOYING')
    expect(result.raid.phase).toBe('DEPLOYING')
    expect(result.raid.phaseTicksRemaining).toBe(PHASE_DURATIONS.DEPLOYING)
    expect(result.raid.zone).not.toBeNull()
    expect(result.raid.dangerLevel).not.toBeNull()
    expect(result.raid.zoneCondition).not.toBeNull()
    expect(result.raid.zoneCondition?.id).toBeTruthy()
    expect(result.raid.zoneCondition?.name).toBeTruthy()
    expect(result.raid.zoneCondition?.description).toBeTruthy()
  })

  it('assigns zone and danger level when Ready Up forces HUB into DEPLOYING', () => {
    const initial = createInitialState(0)
    const result = tickPhase(initial.raid, 'DEPLOYING', createRNG(1))

    expect(result.transition?.from).toBe('HUB')
    expect(result.transition?.to).toBe('DEPLOYING')
    expect(result.raid.phase).toBe('DEPLOYING')
    expect(result.raid.phaseTicksRemaining).toBe(PHASE_DURATIONS.DEPLOYING)
    expect(result.raid.zone).not.toBeNull()
    expect(result.raid.dangerLevel).not.toBeNull()
    expect(result.raid.zoneCondition).not.toBeNull()
    expect(result.raid.zoneCondition?.id).toBeTruthy()
  })

  it('preserves selected zone condition when DEPLOYING naturally transitions into RAIDING', () => {
    const initial = createInitialState(0)
    const deploying = tickPhase(initial.raid, 'DEPLOYING', createRNG(1)).raid
    const selectedConditionId = deploying.zoneCondition?.id

    const result = tickPhase({
      ...deploying,
      phase: 'DEPLOYING',
      phaseTicksRemaining: 1,
    })

    expect(result.transition?.from).toBe('DEPLOYING')
    expect(result.transition?.to).toBe('RAIDING')
    expect(result.raid.phase).toBe('RAIDING')
    expect(result.raid.zoneCondition).not.toBeNull()
    expect(result.raid.zoneCondition?.id).toBe(selectedConditionId)
  })

  it('clears healing items on natural RAIDING timeout into DOWNED', () => {
    const initial = createInitialState(0)
    const result = tickPhase({
      ...initial.raid,
      phase: 'RAIDING',
      phaseTicksRemaining: 1,
      healingItems: [
        {
          itemId: 'bandage_blue',
          name: 'Blue Bandage',
          healAmount: 25,
          moodGain: 3,
          rarity: 3,
          quantity: 2,
        },
      ],
    })

    expect(result.transition?.from).toBe('RAIDING')
    expect(result.transition?.to).toBe('DOWNED')
    expect(result.raid.phase).toBe('DOWNED')
    expect(result.raid.healingItems).toEqual([])
  })

  it('fully repairs and refills the current shield when returning to HUB', () => {
    const initial = createInitialState(0)
    const result = tickPhase({
      ...initial.raid,
      phase: 'EXTRACTING',
      phaseTicksRemaining: 1,
      shield: {
        shieldId: 'salvaged_plate_wall',
        name: 'Salvaged Plate Wall',
        maxCharge: 70,
        charge: 12,
        mitigation: 0.55,
        durability: 34.5,
      },
      activeShieldRecharge: {
        itemId: 'panic_capacitor',
        name: 'Panic Capacitor',
        totalCharge: 40,
        chargeRemaining: 16,
        totalTicks: 5,
        ticksRemaining: 2,
      },
      zone: 'damp_battlegrounds',
      dangerLevel: 'Medium',
      zoneCondition: {
        id: 'heavy_fog',
        name: 'Heavy Fog',
        description: 'Visibility reduced to guess and pray.',
      },
    })

    expect(result.transition?.to).toBe('HUB')
    expect(result.raid.phase).toBe('HUB')
    expect(result.raid.activeShieldRecharge).toBeNull()
    expect(result.raid.shield).toEqual({
      shieldId: 'salvaged_plate_wall',
      name: 'Salvaged Plate Wall',
      maxCharge: 70,
      charge: 70,
      mitigation: 0.55,
      durability: 100,
    })
    expect(result.raid.zone).toBeNull()
    expect(result.raid.dangerLevel).toBeNull()
    expect(result.raid.zoneCondition).toBeNull()
  })

  it('clears zone condition when forced back to HUB', () => {
    const initial = createInitialState(0)
    const raid = {
      ...initial.raid,
      phase: 'RAIDING' as const,
      zone: 'damp_battlegrounds',
      dangerLevel: 'High' as const,
      zoneCondition: {
        id: 'robot_surge',
        name: 'Robot Surge',
        description: 'Robot activity spikes dramatically.',
      },
      backpackValue: 120,
      greedLevel: 35,
      forceExtract: true,
    }

    const result = tickPhase(raid, 'HUB')

    expect(result.transition?.from).toBe('RAIDING')
    expect(result.transition?.to).toBe('HUB')
    expect(result.raid.phase).toBe('HUB')
    expect(result.raid.zone).toBeNull()
    expect(result.raid.dangerLevel).toBeNull()
    expect(result.raid.zoneCondition).toBeNull()
  })
})