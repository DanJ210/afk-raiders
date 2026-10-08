import type { RaidState } from './types.js'
import { PHASE_DURATIONS } from './raidStateMachine.js'

/** Exposure follows elapsed raid time, not greed or Handler actions. */
export function raidExposure(raid: RaidState): number {
  if (raid.phase !== 'RAIDING') return 0
  return Math.min(1, Math.max(0, 1 - raid.phaseTicksRemaining / PHASE_DURATIONS.RAIDING))
}

export function raidLootValueMultiplier(raid: RaidState): number {
  return 1 + 0.5 * raidExposure(raid)
}

export function raidRiskMultiplier(raid: RaidState): number {
  return 1 + 0.5 * raidExposure(raid)
}

/** Bias toward valuable catalog items without inflating stored item prices. */
export function raidLootWeightMultiplier(raid: RaidState, value: number, maxValue: number): number {
  return 1 + 2 * raidExposure(raid) * (maxValue > 0 ? Math.min(1, Math.max(0, value / maxValue)) : 0)
}
