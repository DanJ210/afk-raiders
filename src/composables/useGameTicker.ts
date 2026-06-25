/**
 * useGameTicker — tick loop, visibility pause/resume, and catch-up integration.
 *
 * Responsibilities:
 * - Drive the main game loop on a 30s cadence aligned to lastTickAt
 * - Pause ticking when tab is hidden
 * - Replay elapsed ticks on tab return (catch-up)
 * - Coordinate with persistence on each tick
 */

import { ref, watch, type Ref } from 'vue'
import { useDocumentVisibility } from '@vueuse/core'
import type { GameState, LogEvent } from '../engine/types.js'
import type { RNG } from '../engine/rng.js'
import { processTick } from '../engine/tick.js'
import { catchUp, TICK_INTERVAL_MS } from '../engine/catchUp.js'
import type { AwaySummary } from '../engine/catchUp.js'

export interface GameTickerReturn {
  awaySummary: ReturnType<typeof ref<AwaySummary | null>>
  pause: () => void
  resume: () => void
}

/**
 * Coordinate game ticking, pause/resume on visibility changes, and catch-up.
 * State and RNG are passed in as refs; this composable manages the tick loop.
 */
export function useGameTicker(
  stateRef: Ref<GameState>,
  lastTickAtRef: Ref<number>,
  rngRef: { current: RNG },
  persistCallback: (state: GameState, seed: number, lastTickAt: number) => void,
  publishEvents?: (events: LogEvent[]) => void,
): GameTickerReturn {
  const awaySummary = ref<AwaySummary | null>(null)
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  function clearScheduledTick() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  function scheduleNextTick() {
    clearScheduledTick()
    const elapsed = Math.max(0, Date.now() - lastTickAtRef.value)
    const delay = Math.max(0, TICK_INTERVAL_MS - elapsed)
    timeoutId = setTimeout(() => {
      tick()
      scheduleNextTick()
    }, delay)
  }

  function runCatchUp(fromTickAt: number, toNow: number) {
    const result = catchUp(stateRef.value as GameState, rngRef.current, fromTickAt, toNow)
    stateRef.value = result.state
    if (result.summary.ticksReplayed > 0) {
      awaySummary.value = result.summary
      const alignedTickAt = fromTickAt + (result.summary.ticksReplayed * TICK_INTERVAL_MS)
      lastTickAtRef.value = alignedTickAt
      publishEvents?.(result.events)
      persistCallback(stateRef.value, rngRef.current.getSeed(), alignedTickAt)
    }
  }

  function tick() {
    const tickNow = Date.now()
    const result = processTick(stateRef.value as GameState, rngRef.current, tickNow)
    stateRef.value = result.state
    lastTickAtRef.value = tickNow
    publishEvents?.(result.events)
    persistCallback(stateRef.value, rngRef.current.getSeed(), tickNow)
  }

  function pause() {
    clearScheduledTick()
  }

  function resume() {
    scheduleNextTick()
  }

  // Pause when tab hidden, catch up on return
  const visibility = useDocumentVisibility()

  watch(visibility, (vis) => {
    if (vis === 'hidden') {
      pause()
    } else {
      runCatchUp(lastTickAtRef.value, Date.now())
      resume()
    }
  })

  if (visibility.value !== 'hidden') {
    scheduleNextTick()
  }

  return {
    awaySummary,
    pause,
    resume,
  }
}
