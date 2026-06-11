import { describe, it, expect } from 'vitest'
import { todayInTimezone } from '../lib/timezone'

describe('todayInTimezone', () => {
  it('returns the local calendar date for a timezone ahead of UTC', () => {
    // 2026-06-11T13:00Z is already 2026-06-12 01:00 in NZ (UTC+12, NZST)
    const at = new Date('2026-06-11T13:00:00Z')
    expect(todayInTimezone('Pacific/Auckland', at)).toBe('2026-06-12')
  })

  it('returns the local calendar date for a timezone behind UTC', () => {
    // 2026-06-12T02:00Z is still 2026-06-11 19:00 in Los Angeles (UTC-7, PDT)
    const at = new Date('2026-06-12T02:00:00Z')
    expect(todayInTimezone('America/Los_Angeles', at)).toBe('2026-06-11')
  })

  it('falls back to UTC date for an invalid timezone', () => {
    const at = new Date('2026-06-11T13:00:00Z')
    expect(todayInTimezone('Not/AZone', at)).toBe('2026-06-11')
  })
})
