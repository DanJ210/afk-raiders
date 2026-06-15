import type { LogEvent } from './types.js'

/** Maximum log entries to keep in memory (avoids unbounded growth). */
export const MAX_LOG_SIZE = 200

export function appendLogEntries(log: LogEvent[], entries: LogEvent[]): LogEvent[] {
  return [...log, ...entries].slice(-MAX_LOG_SIZE)
}
