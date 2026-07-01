import type { ActivityLogEvent, LogCondition, RaidState } from './types.js'

/** Maximum log entries to keep in memory (avoids unbounded growth). */
export const MAX_LOG_SIZE = 200

export function appendLogEntries<T>(log: T[], entries: T[]): T[] {
  return [...log, ...entries].slice(-MAX_LOG_SIZE)
}

export function appendActivityLogEntries(log: ActivityLogEvent[], entries: ActivityLogEvent[]): ActivityLogEvent[] {
  return appendLogEntries(log, entries)
}

export function logConditionsForRaid(raid: RaidState): LogCondition[] | undefined {
  const conditions: LogCondition[] = []
  if (raid.extracting) conditions.push('EXTRACTING')
  if (raid.downed) conditions.push('DOWNED')
  return conditions.length > 0 ? conditions : undefined
}
