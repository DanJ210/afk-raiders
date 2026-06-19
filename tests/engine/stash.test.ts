/**
 * Home stash + extraction behavior tests:
 * - Successful extraction transfers the backpack into homeStash (which never empties)
 * - Duplicate items stack quantities (×N) instead of duplicating entries
 * - Death clears the in-raid backpack but leaves the stash untouched
 * - Forced HUB transitions reset the in-raid backpack
 * - Extraction events content is loaded and can force phase outcomes
 */

import { describe, it, expect } from 'vitest'
import { createRNG } from '../../src/engine/rng'
import { processTick } from '../../src/engine/tick'
import { createInitialState } from '../../src/engine/initialState'
import { tickPhase } from '../../src/engine/raidStateMachine'
import { events } from '../../src/engine/eventResolver'
import { HOME_STASH_ITEM_LIMIT, sellItemFromHomeStash, sellStashOverflow } from '../../src/engine/homeStash'
import type { BackpackItem, GameState, Phase } from '../../src/engine/types'

const FIXED_SEED = 42

function makeItem(overrides: Partial<BackpackItem> = {}): BackpackItem {
  return {
    itemId: 'water_bottle_basic',
    name: 'Water Bottle',
    value: 2,
    rarity: 1,
    quantity: 1,
    ...overrides,
  }
}

function makeState(phase: Phase, backpack: BackpackItem[], homeStash: BackpackItem[] = []): GameState {
  const state = createInitialState(0)
  return {
    ...state,
    homeStash,
    raid: {
      ...state.raid,
      phase,
      phaseTicksRemaining: 1, // transition on next tick
      backpack,
      backpackValue: backpack.reduce((s, i) => s + i.value * i.quantity, 0),
    },
  }
}

describe('home stash', () => {
  it('transfers the backpack to homeStash on successful extraction', () => {
    const state = makeState('EXTRACTING', [makeItem({ quantity: 2 })])
    const { state: next } = processTick(state, createRNG(FIXED_SEED), 0)

    expect(next.raid.phase).toBe('HUB')
    expect(next.raid.backpack).toHaveLength(0)
    expect(next.raid.backpackValue).toBe(0)
    expect(next.homeStash).toHaveLength(1)
    expect(next.homeStash[0].itemId).toBe('water_bottle_basic')
    expect(next.homeStash[0].quantity).toBe(2)
    expect(next.raider.extractCount).toBe(1)
  })

  it('stacks duplicate items in the stash with summed quantities', () => {
    const state = makeState(
      'EXTRACTING',
      [makeItem({ quantity: 2 }), makeItem({ itemId: 'shiny_thing', name: 'Shiny Thing', value: 10, rarity: 3 })],
      [makeItem({ quantity: 1 })],
    )
    const { state: next } = processTick(state, createRNG(FIXED_SEED), 0)

    expect(next.homeStash).toHaveLength(2)
    const water = next.homeStash.find(i => i.itemId === 'water_bottle_basic')
    expect(water?.quantity).toBe(3)
    const shiny = next.homeStash.find(i => i.itemId === 'shiny_thing')
    expect(shiny?.quantity).toBe(1)
  })

  it('clears the backpack on death but never empties the stash', () => {
    const stash = [makeItem({ quantity: 5 })]
    const state = makeState('DOWNED', [makeItem({ itemId: 'doomed_loot', name: 'Doomed Loot' })], stash)
    const { state: next } = processTick(state, createRNG(FIXED_SEED), 0)

    expect(next.raid.phase).toBe('HUB')
    expect(next.raid.backpack).toHaveLength(0)
    expect(next.homeStash).toEqual(stash)
    expect(next.raider.deathCount).toBe(1)
  })

  it('auto-sells the lowest-value items when the stash overflows on extraction', () => {
    // Stash nearly full of valuable items; incoming cheap loot overflows it
    const nearFullStash = [
      makeItem({ itemId: 'pricey', name: 'Pricey Thing', value: 10, quantity: HOME_STASH_ITEM_LIMIT - 2 }),
    ]
    const state = makeState(
      'EXTRACTING',
      [makeItem({ value: 1, quantity: 5 })], // 3 of these must be sold
      nearFullStash,
    )
    const { state: next, events: emitted } = processTick(state, createRNG(FIXED_SEED), 0)

    expect(next.raid.phase).toBe('HUB')
    const total = next.homeStash.reduce((s, i) => s + i.quantity, 0)
    expect(total).toBe(HOME_STASH_ITEM_LIMIT)
    // The cheap incoming items were the ones sold (lowest value first)
    const pricey = next.homeStash.find(i => i.itemId === 'pricey')
    expect(pricey?.quantity).toBe(HOME_STASH_ITEM_LIMIT - 2)
    const cheap = next.homeStash.find(i => i.itemId === 'water_bottle_basic')
    expect(cheap?.quantity).toBe(2)
    // Sale proceeds credited to the coin stash and narrated in the comms log
    expect(next.coins).toBe(3)
    expect(emitted.some(e => e.id === 'stash_overflow_sale')).toBe(true)
  })

  it('sells cheap stash items to make room for incoming valuable loot', () => {
    const fullOfCheap = [
      makeItem({ value: 1, quantity: HOME_STASH_ITEM_LIMIT }),
    ]
    const state = makeState(
      'EXTRACTING',
      [makeItem({ itemId: 'hans', name: 'Hans Gruber (alive)', value: 1000, rarity: 5, quantity: 2 })],
      fullOfCheap,
    )
    const { state: next } = processTick(state, createRNG(FIXED_SEED), 0)

    const total = next.homeStash.reduce((s, i) => s + i.quantity, 0)
    expect(total).toBe(HOME_STASH_ITEM_LIMIT)
    // The valuable incoming loot is kept; 2 cheap items were sold for coins
    expect(next.homeStash.find(i => i.itemId === 'hans')?.quantity).toBe(2)
    expect(next.homeStash.find(i => i.itemId === 'water_bottle_basic')?.quantity).toBe(HOME_STASH_ITEM_LIMIT - 2)
    expect(next.coins).toBe(2)
  })

  it('sellStashOverflow converts over-limit saves into coins, lowest value first', () => {
    const oversized = [
      makeItem({ itemId: 'gold', name: 'Gold', value: 10, quantity: HOME_STASH_ITEM_LIMIT }),
      makeItem({ itemId: 'junk', name: 'Junk', value: 1, quantity: 30 }),
      makeItem({ itemId: 'mid', name: 'Mid', value: 5, quantity: 20 }),
    ]
    const result = sellStashOverflow(oversized)

    const total = result.homeStash.reduce((s, i) => s + i.quantity, 0)
    expect(total).toBe(HOME_STASH_ITEM_LIMIT)
    expect(result.soldItemCount).toBe(50)
    // All 30 junk (1c each) sold first, then 20 mid (5c each)
    expect(result.coinsGained).toBe(30 * 1 + 20 * 5)
    expect(result.homeStash.find(i => i.itemId === 'junk')).toBeUndefined()
    expect(result.homeStash.find(i => i.itemId === 'mid')).toBeUndefined()
    expect(result.homeStash.find(i => i.itemId === 'gold')?.quantity).toBe(HOME_STASH_ITEM_LIMIT)
  })

  it('sells a selected stash item into coins without affecting other entries', () => {
    const stash = [
      makeItem({ itemId: 'water', name: 'Water Bottle', value: 2, quantity: 3 }),
      makeItem({ itemId: 'artifact', name: 'Artifact', value: 15, rarity: 4, quantity: 2 }),
    ]

    const result = sellItemFromHomeStash(stash, 'artifact')

    expect(result.coinsGained).toBe(30)
    expect(result.soldItemCount).toBe(2)
    expect(result.homeStash).toEqual([makeItem({ itemId: 'water', name: 'Water Bottle', value: 2, quantity: 3 })])
  })

  it('supports selling part of a stash stack', () => {
    const stash = [makeItem({ itemId: 'water', name: 'Water Bottle', value: 2, quantity: 4 })]

    const result = sellItemFromHomeStash(stash, 'water', 1)

    expect(result.coinsGained).toBe(2)
    expect(result.soldItemCount).toBe(1)
    expect(result.homeStash).toEqual([makeItem({ itemId: 'water', name: 'Water Bottle', value: 2, quantity: 3 })])
  })
})

describe('forced phase transitions', () => {
  it('resets the in-raid backpack when forced back to HUB', () => {
    const state = makeState('EXTRACTING', [makeItem()])
    const { raid } = tickPhase({ ...state.raid, phaseTicksRemaining: 4 }, 'HUB')

    expect(raid.phase).toBe('HUB')
    expect(raid.backpack).toHaveLength(0)
    expect(raid.backpackValue).toBe(0)
    expect(raid.greedLevel).toBe(0)
  })

  it('keeps the backpack when forced from EXTRACTING back to RAIDING', () => {
    const state = makeState('EXTRACTING', [makeItem()])
    const { raid } = tickPhase({ ...state.raid, phaseTicksRemaining: 4 }, 'RAIDING')

    expect(raid.phase).toBe('RAIDING')
    expect(raid.backpack).toHaveLength(1)
  })
})

describe('extraction events content', () => {
  it('loads extraction events into the event pool', () => {
    const extractionEvents = events.filter(e => e.id.startsWith('extract_'))
    expect(extractionEvents.length).toBeGreaterThanOrEqual(5)
  })

  it('includes both unsuccessful and extra-successful forced outcomes', () => {
    const forced = events
      .filter(e => e.requires?.phase === 'EXTRACTING' && e.effects?.forcePhase)
      .map(e => e.effects!.forcePhase)
    expect(forced).toContain('HUB')      // early successful extraction
    expect(forced).toContain('RAIDING')  // failed extraction
    expect(forced).toContain('DOWNED')   // died at the LZ
  })
})
