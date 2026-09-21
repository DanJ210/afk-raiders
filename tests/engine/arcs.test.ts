import { describe, expect, it } from 'vitest'
import { advanceStoryArcs, createInitialStoryState, getActiveArcDisplay, normalizeStoryState, resolveArcAmbientEvent } from '../../src/engine/arcs'
import { createInitialState } from '../../src/engine/initialState'

describe('story arcs', () => {
  it('starts the first eligible arc in HUB', () => {
    const state = createInitialState(0)
    const result = advanceStoryArcs(state, 0, 1000)

    expect(result.state.story.activeArc?.id).toBe('missing_stamp')
    expect(result.events[0]?.id).toBe('arc_missing_stamp_start')
  })

  it('advances beats and completes an arc when requirements are met', () => {
    let state = createInitialState(0)
    state.story = createInitialStoryState()

    state = advanceStoryArcs(state, 0, 1000).state
    state = {
      ...state,
      stats: {
        ...state.stats,
        extracts: {
          ...state.stats.extracts,
          total: 1,
        },
      },
    }

    let result = advanceStoryArcs(state, 1, 2000)
    expect(result.state.story.activeArc?.beatIndex).toBe(1)
    expect(result.events.at(-1)?.id).toBe('arc_missing_stamp_backup_stamp_start')

    state = {
      ...result.state,
      stats: {
        ...result.state.stats,
        extracts: {
          ...result.state.stats.extracts,
          total: 3,
        },
      },
    }

    result = advanceStoryArcs(state, 2, 3000)
    expect(result.state.story.activeArc?.beatIndex).toBe(2)

    result = advanceStoryArcs(result.state, 3, 4000)
    expect(result.state.story.activeArc).toBeNull()
    expect(result.state.story.completedArcIds).toContain('missing_stamp')
    expect(result.events.at(-1)?.id).toBe('arc_missing_stamp_finished')
  })

  it('starts the nemesis arc once a unique nemesis exists', () => {
    const state = createInitialState(0)
    state.story.completedArcIds = ['missing_stamp', 'bunk_with_a_door', 'vending_machine_friendship', 'hoarding_intervention']
    state.stats.robotDownings = { anxietick: 2 }

    const result = advanceStoryArcs(state, 9, 9000)
    expect(result.state.story.activeArc?.id).toBe('nemesis_grudge')
    expect(result.events[0]?.text).toContain('Anxietick')
  })

  it('emits deterministic ambient arc lines while a beat is active', () => {
    const state = createInitialState(0)
    state.story.activeArc = {
      id: 'missing_stamp',
      beatIndex: 0,
      progress: {
        coins: 0,
        extractsTotal: 0,
        deathsTotal: 0,
        waterBottles: 0,
        nemesisDownings: 0,
      },
    }

    const event = resolveArcAmbientEvent(state, 7, 7000)
    expect(event?.commsPriority).toBe('ambient')
    expect(event?.text).toContain('stamp')
  })

  it('normalizes invalid saved story state safely', () => {
    const normalized = normalizeStoryState({
      activeArc: { id: 'missing_stamp', beatIndex: 99, progress: { coins: 10 } },
      completedArcIds: ['bunk_with_a_door', 'not_real_arc'],
    })

    expect(normalized.activeArc).toBeNull()
    expect(normalized.completedArcIds).toEqual(['bunk_with_a_door'])
  })

  it('returns a display model for the active beat', () => {
    const display = getActiveArcDisplay({
      activeArc: {
        id: 'missing_stamp',
        beatIndex: 0,
        progress: {
          coins: 0,
          extractsTotal: 0,
          deathsTotal: 0,
          waterBottles: 0,
          nemesisDownings: 0,
        },
      },
      completedArcIds: [],
    })

    expect(display?.arcName).toBe('The Missing Stamp')
    expect(display?.beatTitle).toBe('Form Trouble')
  })
})