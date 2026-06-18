import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useNow } from '@vueuse/core'
import { TICK_INTERVAL_MS } from '../engine/catchUp'
import type { Phase } from '../engine/types'

interface UseRaidTimerOptions {
  phase: MaybeRefOrGetter<Phase>
  phaseTicksRemaining: MaybeRefOrGetter<number>
  lastTickAt: MaybeRefOrGetter<number>
  visiblePhases?: readonly Phase[]
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function useRaidTimer(options: UseRaidTimerOptions) {
  const now = useNow({ interval: 1000 })
  const visiblePhases = options.visiblePhases ?? ['RAIDING']

  const showRaidTimer = computed(() => visiblePhases.includes(toValue(options.phase)))

  const raidTimerMs = computed(() => {
    if (!showRaidTimer.value) return 0

    const phaseRemainingMs = toValue(options.phaseTicksRemaining) * TICK_INTERVAL_MS
    const elapsedSinceLastTick = Math.max(0, now.value.getTime() - toValue(options.lastTickAt))
    return Math.max(0, phaseRemainingMs - elapsedSinceLastTick)
  })

  const raidTimerText = computed(() => formatDuration(raidTimerMs.value))

  return {
    showRaidTimer,
    raidTimerMs,
    raidTimerText,
  }
}
