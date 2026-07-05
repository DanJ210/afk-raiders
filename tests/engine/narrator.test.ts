import { describe, expect, it } from 'vitest'
import { createInitialState } from '../../src/engine/initialState'
import { createRNG } from '../../src/engine/rng'
import { getNemesisRobot, getNemesisRobotId, narrateOutcomeCallbacks } from '../../src/engine/narrator'

describe('narrator callbacks', () => {
  it('derives a unique nemesis robot from robot downings', () => {
    const state = createInitialState(0)
    state.stats.robotDownings = { anxietick: 2, tank_overcompensation: 1 }

    expect(getNemesisRobotId(state.stats)).toBe('anxietick')
    expect(getNemesisRobot(state.stats)?.name).toBeTruthy()
  })

  it('returns null when the nemesis lead is tied', () => {
    const state = createInitialState(0)
    state.stats.robotDownings = { anxietick: 2, tank_overcompensation: 2 }

    expect(getNemesisRobotId(state.stats)).toBeNull()
  })

  it('emits milestone callbacks for first extract, water bottles, and new nemesis', () => {
    const previous = createInitialState(0)
    const next = createInitialState(0)
    next.raider.name = 'Mira "Wet Socks" Malone'
    next.raider.extractCount = 1
    next.stats.extracts.total = 1
    next.stats.extracts.byZone.damp_battlegrounds = 1
    next.homeStash = [{ itemId: 'water_bottle_cracked', name: 'Cracked Water Bottle', value: 1, rarity: 1, quantity: 10 }]
    next.stats.robotDownings = { anxietick: 2 }

    const events = narrateOutcomeCallbacks(previous, next, {
      kind: 'extract',
      zone: 'damp_battlegrounds',
      dangerLevel: 'Low',
    }, createRNG(1), 1, 1000)

    expect(events.length).toBeGreaterThanOrEqual(3)
    expect(events.some(event => event.text.includes('Mira "Wet Socks" Malone'))).toBe(true)
    expect(events.some(event => event.text.includes('water'))).toBe(true)
    expect(events.some(event => event.text.includes('Anxietick') || event.text.includes('pattern') || event.text.includes('rivalry'))).toBe(true)
  })

  it('emits death-zone reputation and death milestone callbacks', () => {
    const previous = createInitialState(0)
    previous.raider.deathCount = 4
    previous.stats.deaths.total = 4
    previous.stats.deaths.byZone.damp_battlegrounds = 2

    const next = createInitialState(0)
    next.raider.name = 'Dev "Receipt" Holt'
    next.raider.deathCount = 5
    next.stats.deaths.total = 5
    next.stats.deaths.byZone.damp_battlegrounds = 3

    const events = narrateOutcomeCallbacks(previous, next, {
      kind: 'death',
      zone: 'damp_battlegrounds',
      dangerLevel: 'Medium',
    }, createRNG(2), 9, 2000)

    expect(events.some(event => event.text.includes('Five deaths') || event.text.includes('five deaths'))).toBe(true)
    expect(events.some(event => event.text.includes('Damp Battlegrounds'))).toBe(true)
  })
})