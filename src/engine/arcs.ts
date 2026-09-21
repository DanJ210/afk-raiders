/**
 * Story arcs — multi-raid chapter state driven by existing game outcomes.
 *
 * Arcs are deterministic and data-driven. They do not affect simulation math;
 * they only emit comms and persist chapter progress.
 */

import arcsData from '../content/arcs/arcs.json'
import { CommsPriority, type GameState, type LogEvent, type Phase } from './types.js'
import { getNemesisRobot } from './narrator.js'

interface ArcRequirement {
  coins?: number
  extractsTotal?: number
  deathsTotal?: number
  waterBottles?: number
  nemesisDownings?: number
  hasNemesisRobot?: boolean
}

interface ArcBeatDefinition {
  id: string
  title: string
  startText: string
  completedText?: string
  completeWhen: ArcRequirement
  ambientTexts?: Partial<Record<'HUB' | 'RAIDING', string[]>>
}

interface ArcDefinition {
  id: string
  name: string
  summary: string
  startWhen?: ArcRequirement
  beats: ArcBeatDefinition[]
  completedText: string
}

interface ArcsContent {
  arcs: ArcDefinition[]
}

export interface StoryArcProgress {
  coins: number
  extractsTotal: number
  deathsTotal: number
  waterBottles: number
  nemesisDownings: number
}

export interface ActiveStoryArc {
  id: string
  beatIndex: number
  progress: StoryArcProgress
}

export interface StoryState {
  activeArc: ActiveStoryArc | null
  completedArcIds: string[]
}

export interface ActiveArcDisplay {
  arcId: string
  arcName: string
  beatId: string
  beatTitle: string
}

const arcDefinitions = (arcsData as ArcsContent).arcs

export function createInitialStoryState(): StoryState {
  return {
    activeArc: null,
    completedArcIds: [],
  }
}

export function getStoryArcDefinitions(): ArcDefinition[] {
  return arcDefinitions
}

export function findStoryArcDefinition(arcId: string | null | undefined): ArcDefinition | null {
  if (!arcId) return null
  return arcDefinitions.find(arc => arc.id === arcId) ?? null
}

export function getActiveArcDisplay(story: StoryState): ActiveArcDisplay | null {
  const active = story.activeArc
  if (!active) return null
  const definition = findStoryArcDefinition(active.id)
  const beat = definition?.beats[active.beatIndex]
  if (!definition || !beat) return null
  return {
    arcId: definition.id,
    arcName: definition.name,
    beatId: beat.id,
    beatTitle: beat.title,
  }
}

function waterBottleCount(state: GameState): number {
  return state.homeStash
    .filter(item => item.itemId.startsWith('water_bottle'))
    .reduce((sum, item) => sum + item.quantity, 0)
}

function currentArcProgress(state: GameState): StoryArcProgress {
  const nemesis = getNemesisRobot(state.stats)
  const nemesisDownings = nemesis ? (state.stats.robotDownings[nemesis.id] ?? 0) : 0
  return {
    coins: state.coins,
    extractsTotal: state.stats.extracts.total,
    deathsTotal: state.stats.deaths.total,
    waterBottles: waterBottleCount(state),
    nemesisDownings,
  }
}

function fillArcSlots(text: string, state: GameState): string {
  const nemesis = getNemesisRobot(state.stats)
  return text.replace(/\{(\w+)\}/g, (match, slot: string) => {
    if (slot === 'raider_name') return state.raider.name
    if (slot === 'nemesis_robot_name') return nemesis?.name ?? 'that one robot'
    return match
  })
}

function makeArcEvent(id: string, text: string, phase: Phase, tick: number, now: number): LogEvent {
  return {
    id,
    tick,
    timestamp: now,
    text,
    phase,
    commsPriority: CommsPriority.Priority,
  }
}

function requirementMet(requirement: ArcRequirement | undefined, state: GameState, progress: StoryArcProgress): boolean {
  if (!requirement) return true
  if (requirement.coins !== undefined && progress.coins < requirement.coins) return false
  if (requirement.extractsTotal !== undefined && progress.extractsTotal < requirement.extractsTotal) return false
  if (requirement.deathsTotal !== undefined && progress.deathsTotal < requirement.deathsTotal) return false
  if (requirement.waterBottles !== undefined && progress.waterBottles < requirement.waterBottles) return false
  if (requirement.nemesisDownings !== undefined && progress.nemesisDownings < requirement.nemesisDownings) return false
  if (requirement.hasNemesisRobot !== undefined) {
    const hasNemesis = getNemesisRobot(state.stats) !== null
    if (requirement.hasNemesisRobot !== hasNemesis) return false
  }
  return true
}

function nextEligibleArc(state: GameState): ArcDefinition | null {
  const progress = currentArcProgress(state)
  return arcDefinitions.find(arc => (
    !state.story.completedArcIds.includes(arc.id)
    && requirementMet(arc.startWhen, state, progress)
  )) ?? null
}

export function normalizeStoryState(value: unknown): StoryState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return createInitialStoryState()
  }

  const record = value as Record<string, unknown>
  const completedArcIds = Array.isArray(record.completedArcIds)
    ? record.completedArcIds.filter((entry): entry is string => typeof entry === 'string' && findStoryArcDefinition(entry) !== null)
    : []

  const activeValue = record.activeArc
  if (typeof activeValue !== 'object' || activeValue === null || Array.isArray(activeValue)) {
    return { activeArc: null, completedArcIds }
  }

  const activeRecord = activeValue as Record<string, unknown>
  const id = typeof activeRecord.id === 'string' ? activeRecord.id : null
  const definition = findStoryArcDefinition(id)
  const beatIndex = typeof activeRecord.beatIndex === 'number' && Number.isFinite(activeRecord.beatIndex)
    ? Math.max(0, Math.floor(activeRecord.beatIndex))
    : 0
  const progressRecord = typeof activeRecord.progress === 'object' && activeRecord.progress !== null && !Array.isArray(activeRecord.progress)
    ? activeRecord.progress as Record<string, unknown>
    : {}

  if (!definition || beatIndex >= definition.beats.length || completedArcIds.includes(definition.id)) {
    return { activeArc: null, completedArcIds }
  }

  return {
    activeArc: {
      id: definition.id,
      beatIndex,
      progress: {
        coins: typeof progressRecord.coins === 'number' && Number.isFinite(progressRecord.coins) ? Math.max(0, Math.floor(progressRecord.coins)) : 0,
        extractsTotal: typeof progressRecord.extractsTotal === 'number' && Number.isFinite(progressRecord.extractsTotal) ? Math.max(0, Math.floor(progressRecord.extractsTotal)) : 0,
        deathsTotal: typeof progressRecord.deathsTotal === 'number' && Number.isFinite(progressRecord.deathsTotal) ? Math.max(0, Math.floor(progressRecord.deathsTotal)) : 0,
        waterBottles: typeof progressRecord.waterBottles === 'number' && Number.isFinite(progressRecord.waterBottles) ? Math.max(0, Math.floor(progressRecord.waterBottles)) : 0,
        nemesisDownings: typeof progressRecord.nemesisDownings === 'number' && Number.isFinite(progressRecord.nemesisDownings) ? Math.max(0, Math.floor(progressRecord.nemesisDownings)) : 0,
      },
    },
    completedArcIds,
  }
}

export function advanceStoryArcs(state: GameState, tick: number, now: number): { state: GameState; events: LogEvent[] } {
  const events: LogEvent[] = []
  const progress = currentArcProgress(state)

  if (state.raid.phase !== 'HUB') {
    return {
      state: state.story.activeArc
        ? {
            ...state,
            story: {
              ...state.story,
              activeArc: {
                ...state.story.activeArc,
                progress,
              },
            },
          }
        : state,
      events,
    }
  }

  if (!state.story.activeArc) {
    const nextArc = nextEligibleArc(state)
    if (!nextArc) {
      return { state: { ...state, story: { ...state.story, activeArc: null } }, events }
    }

    return {
      state: {
        ...state,
        story: {
          ...state.story,
          activeArc: {
            id: nextArc.id,
            beatIndex: 0,
            progress,
          },
        },
      },
      events: [makeArcEvent(`arc_${nextArc.id}_start`, fillArcSlots(nextArc.beats[0].startText, state), state.raid.phase, tick, now)],
    }
  }

  const definition = findStoryArcDefinition(state.story.activeArc.id)
  if (!definition) {
    return {
      state: {
        ...state,
        story: {
          ...state.story,
          activeArc: null,
        },
      },
      events,
    }
  }

  const beat = definition.beats[state.story.activeArc.beatIndex]
  const nextState: GameState = {
    ...state,
    story: {
      ...state.story,
      activeArc: {
        ...state.story.activeArc,
        progress,
      },
    },
  }

  if (!beat || !requirementMet(beat.completeWhen, state, progress)) {
    return { state: nextState, events }
  }

  if (beat.completedText) {
    events.push(makeArcEvent(`arc_${definition.id}_${beat.id}_complete`, fillArcSlots(beat.completedText, state), state.raid.phase, tick, now))
  }

  const nextBeat = definition.beats[state.story.activeArc.beatIndex + 1]
  if (nextBeat) {
    return {
      state: {
        ...nextState,
        story: {
          ...nextState.story,
          activeArc: {
            id: definition.id,
            beatIndex: state.story.activeArc.beatIndex + 1,
            progress,
          },
        },
      },
      events: [
        ...events,
        makeArcEvent(`arc_${definition.id}_${nextBeat.id}_start`, fillArcSlots(nextBeat.startText, state), state.raid.phase, tick, now),
      ],
    }
  }

  return {
    state: {
      ...nextState,
      story: {
        activeArc: null,
        completedArcIds: [...nextState.story.completedArcIds, definition.id],
      },
    },
    events: [
      ...events,
      makeArcEvent(`arc_${definition.id}_finished`, fillArcSlots(definition.completedText, state), state.raid.phase, tick, now),
    ],
  }
}

export function resolveArcAmbientEvent(state: GameState, tick: number, now: number): LogEvent | null {
  if (!state.story.activeArc) return null
  if (state.raid.phase !== 'HUB' && state.raid.phase !== 'RAIDING') return null
  if (tick % 7 !== 0) return null

  const definition = findStoryArcDefinition(state.story.activeArc.id)
  const beat = definition?.beats[state.story.activeArc.beatIndex]
  const lines = beat?.ambientTexts?.[state.raid.phase]
  if (!beat || !lines || lines.length === 0) return null

  const line = lines[Math.floor(tick / 7) % lines.length]
  return {
    id: `arc_${definition.id}_${beat.id}_${state.raid.phase.toLowerCase()}_${tick}`,
    tick,
    timestamp: now,
    text: fillArcSlots(line, state),
    phase: state.raid.phase,
    commsPriority: CommsPriority.Ambient,
  }
}
