import { describe, expect, it } from 'vitest'
import { createInitialState } from '../../src/engine/initialState'
import { processTick } from '../../src/engine/tick'
import { createRNG } from '../../src/engine/rng'
import { getTotalItemValue } from '../../src/engine/homeStash'
import { getRaiderLevelBenefitProfile, xpRequiredForLevel } from '../../src/engine/raiderLevel'
import { catchUp, TICK_INTERVAL_MS } from '../../src/engine/catchUp'

function extractionStart() {
  const state = createInitialState(0)
  state.raid.phase = 'RAIDING'
  state.raid.zone = 'damp_battlegrounds'
  state.raid.dangerLevel = 'Medium'
  state.raid.phaseTicksRemaining = 20
  state.raid.extracting = { ticksRemaining: 1, totalTicks: 4 }
  state.raid.backpack = [
    { itemId: 'water_bottle', name: 'Water Bottle', value: 5, rarity: 1, quantity: 2 },
    { itemId: 'fizz_cell', name: 'Fizz Cell', value: 12, rarity: 1, quantity: 3, fromLoadoutQuantity: 2 },
  ]
  return state
}

describe('extraction receipt', () => {
  it('records actual loot quantities and value, excludes staged supplies, and does not mutate input', () => {
    const state = extractionStart()
    const before = structuredClone(state)
    const result = processTick(state, createRNG(42), 30_000)
    expect(result.state.lastExtraction).toEqual({
      timestamp: 30_000, extractionNumber: 1, zone: 'damp_battlegrounds', dangerLevel: 'Medium',
      lootItemCount: 3, lootValue: 22, stashValueChange: 22,
      overflowItemCount: 0, overflowCoins: 0, stipendCoins: 0,
    })
    expect(result.events.find(event => event.id === 'extraction_receipt')?.text).toContain('3 loot units worth 22')
    expect(state).toEqual(before)
  })

  it('accounts for overflow of older stash items and the actual stipend without double counting', () => {
    const state = extractionStart()
    state.homeStash = [{ itemId: 'old_junk', name: 'Old Junk', value: 1, rarity: 1, quantity: 120 }]
    state.raider.levelXp = xpRequiredForLevel(20)
    const result = processTick(state, createRNG(42), 30_000).state
    const stipend = getRaiderLevelBenefitProfile(state.raider.levelXp).extractionCoinBonus
    expect(result.lastExtraction).toMatchObject({
      lootItemCount: 3, lootValue: 22, stashValueChange: 19,
      overflowItemCount: 3, overflowCoins: 3, stipendCoins: stipend,
    })
    expect(result.coins - state.coins).toBe(3 + stipend)
    expect(getTotalItemValue(result.homeStash) - getTotalItemValue(state.homeStash)
      + result.coins - state.coins).toBe(22 + stipend)
  })

  it('records an empty haul and preserves the latest success through failed recovery', () => {
    const state = extractionStart()
    state.raid.backpack = []
    const extracted = processTick(state, createRNG(42), 30_000).state
    expect(extracted.lastExtraction).toMatchObject({ lootItemCount: 0, lootValue: 0, stashValueChange: 0 })
    const failed = {
      ...extracted,
      raid: { ...extracted.raid, phase: 'KNOCKED_OUT' as const, phaseTicksRemaining: 1 },
    }
    const recovered = processTick(failed, createRNG(42), 60_000).state
    expect(recovered.lastExtraction).toEqual(extracted.lastExtraction)
    expect(createInitialState(0).lastExtraction).toBeNull()
  })

  it('records the same receipt during offline catch-up as direct tick replay', () => {
    const state = extractionStart()
    const direct = processTick(state, createRNG(42), TICK_INTERVAL_MS).state
    const offline = catchUp(state, createRNG(42), 0, TICK_INTERVAL_MS).state
    expect(offline.lastExtraction).toEqual(direct.lastExtraction)
    expect(offline.lastExtraction?.lootValue).toBe(22)
  })

  it('records event-driven early extraction through the same receipt path', () => {
    const state = extractionStart()
    state.raid.extracting = { ticksRemaining: 4, totalTicks: 4 }
    const rng = createRNG(42)
    const weightedPick = rng.weightedPick.bind(rng)
    let selectedEarlyExtraction = false
    rng.weightedPick = <T extends { weight: number }>(items: readonly T[]): T => {
      const early = items.find(item => 'id' in item && item.id === 'extract_early_dustoff')
      if (!early) return weightedPick(items)
      selectedEarlyExtraction = true
      return early
    }
    const result = processTick(state, rng, 30_000)
    expect(selectedEarlyExtraction).toBe(true)
    expect(result.state.raid.phase).toBe('HUB')
    expect(result.state.lastExtraction).toMatchObject({ lootItemCount: 3, lootValue: 22, extractionNumber: 1 })
  })
})
