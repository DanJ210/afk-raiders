/**
 * useGameTicker — tick loop, visibility pause/resume, and catch-up integration.
 *
 * Responsibilities:
 * - Drive the main game loop via useIntervalFn (30s cadence)
 * - Pause ticking when tab is hidden
 * - Replay elapsed ticks on tab return (catch-up)
 * - Coordinate with persistence on each tick
 */

import { ref, watch } from 'vue'
import { useIntervalFn, useDocumentVisibility } from '@vueuse/core'
import type { GameState } from '../engine/types.js'
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
  stateRef: ReturnType<typeof ref<GameState>>,
  lastTickAtRef: ReturnType<typeof ref<number>>,
  rngRef: { current: RNG },
  persistCallback: (state: GameState, seed: number, lastTickAt: number) => void,
): GameTickerReturn {
  const awaySummary = ref<AwaySummary | null>(null)

  function tick() {
    const tickNow = Date.now()
    const result = processTick(stateRef.value as GameState, rngRef.current, tickNow)
    stateRef.value = result.state
    lastTickAtRef.value = tickNow
    persistCallback(stateRef.value, rngRef.current.getSeed(), tickNow)
  }

  const { pause, resume } = useIntervalFn(tick, TICK_INTERVAL_MS)

  // Pause when tab hidden, catch up on return
  const visibility = useDocumentVisibility()
  let hiddenAt: number | null = null

  watch(visibility, (vis) => {
    if (vis === 'hidden') {
      pause()
      hiddenAt = Date.now()
    } else {
      if (hiddenAt !== null) {
        const result = catchUp(stateRef.value as GameState, rngRef.current, hiddenAt, Date.now())
        stateRef.value = result.state
        if (result.summary.ticksReplayed > 0) {
          awaySummary.value = result.summary
        }
        lastTickAtRef.value = Date.now()
        persistCallback(stateRef.value, rngRef.current.getSeed(), lastTickAtRef.value)
        hiddenAt = null
      }
      resume()
    }
  })

  return {
    awaySummary,
    pause,
    resume,
  }
}
