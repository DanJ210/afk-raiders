import { describe, expect, it } from 'vitest'
import { zoneName } from '../../src/utils/zones'

describe('zoneName', () => {
  it('returns the display name for a known zone id', () => {
    expect(zoneName('damp_battlegrounds')).toBe('Damp Battlegrounds')
  })

  it('returns null for unknown or missing zone ids', () => {
    expect(zoneName('missing_zone')).toBeNull()
    expect(zoneName(null)).toBeNull()
  })
})
