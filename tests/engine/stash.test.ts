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
import { HOME_STASH_ITEM_LIMIT, clampStashToLimit } from '../../src/engine/homeStash'
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

  it('enforces the stash item limit on extraction (quantities count toward it)', () => {
    const nearFullStash = [makeItem({ quantity: HOME_STASH_ITEM_LIMIT - 2 })]
    const state = makeState(
      'EXTRACTING',
      [makeItem({ quantity: 5 })], // only 2 fit
      nearFullStash,
    )
    const { state: next, events: emitted } = processTick(state, createRNG(FIXED_SEED), 0)

    expect(next.raid.phase).toBe('HUB')
    const total = next.homeStash.reduce((s, i) => s + i.quantity, 0)
    expect(total).toBe(HOME_STASH_ITEM_LIMIT)
    // The overflow loss is narrated in the comms log
    expect(emitted.some(e => e.id === 'stash_full_discard')).toBe(true)
  })

  it('clampStashToLimit trims over-limit saves', () => {
    const oversized = [
      makeItem({ quantity: HOME_STASH_ITEM_LIMIT }),
      makeItem({ itemId: 'extra', name: 'Extra', quantity: 50 }),
    ]
    const clamped = clampStashToLimit(oversized)
    const total = clamped.reduce((s, i) => s + i.quantity, 0)
    expect(total).toBe(HOME_STASH_ITEM_LIMIT)
    expect(clamped).toHaveLength(1)
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
