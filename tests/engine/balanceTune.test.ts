import { describe, it } from 'vitest'
import { createInitialState } from '../../src/engine/initialState'
import { processTick } from '../../src/engine/tick'
import { createRNG } from '../../src/engine/rng'
import type { GameState } from '../../src/engine/types'

function createRaidStart(): GameState {
  const state = createInitialState(0)
  return {
    ...state,
    raid: {
      ...state.raid,
      zone: 'damp_battlegrounds',
      timeOfDay: 'Day',
      phase: 'RAIDING',
      phaseTicksRemaining: 120,
    },
  }
}

describe('original baseline', () => {
  it('shows original metrics', () => {
    const outcomes: Array<{ outcome: string; ticks: number }> = []
    for (let seed = 1; seed <= 200; seed++) {
      const rng = createRNG(seed)
      let state = createRaidStart()
      let raidingTicks = 0
      for (let tick = 0; tick < 240; tick++) {
        if (state.raid.phase === 'RAIDING') raidingTicks++
        state = processTick(state, rng, tick * 15000).state
        if (state.raider.extractCount > 0) { outcomes.push({ outcome: 'EXTRACTED', ticks: raidingTicks }); break }
        if (state.raider.deathCount > 0) { outcomes.push({ outcome: 'DOWNED', ticks: raidingTicks }); break }
      }
    }
    const extracts = outcomes.filter(o => o.outcome === 'EXTRACTED').length
    const rate = extracts / 200
    const avgTicks = outcomes.reduce((s, o) => s + o.ticks, 0) / outcomes.length
    const extractTicks = outcomes.filter(o => o.outcome === 'EXTRACTED').map(o => o.ticks)
    const downedTicks = outcomes.filter(o => o.outcome === 'DOWNED').map(o => o.ticks)
    const avgExtractTicks = extractTicks.length > 0 ? extractTicks.reduce((a,b)=>a+b,0)/extractTicks.length : 0
    const avgDownedTicks = downedTicks.length > 0 ? downedTicks.reduce((a,b)=>a+b,0)/downedTicks.length : 0
    console.log(`ORIGINAL: Rate: ${rate.toFixed(3)}, Avg ticks: ${avgTicks.toFixed(2)}, Extract ticks: ${avgExtractTicks.toFixed(1)}, Downed ticks: ${avgDownedTicks.toFixed(1)}, Deaths: ${downedTicks.length}`)
  })
})
