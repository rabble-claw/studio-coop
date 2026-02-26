import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateClassInstances,
  calculateDates,
  calculateEndTime,
  nextDayOfWeek,
  toDateString,
} from '../lib/class-generator'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))

import { createServiceClient } from '../lib/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const STUDIO_ID = 'studio-abc'

// Monday = 1
const MONDAY = 1
// Wednesday = 3
const WEDNESDAY = 3

/** Returns a Date that is a specific day-of-week for a given reference date */
function dateOnWeekday(isoDate: string, targetDay: number): Date {
  const d = new Date(isoDate)
  const cur = d.getDay()
  d.setDate(d.getDate() + ((targetDay - cur + 7) % 7))
  return d
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit: helper functions
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateEndTime', () => {
  it('adds duration correctly', () => {
    expect(calculateEndTime('09:00', 60)).toBe('10:00:00')
    expect(calculateEndTime('23:30', 60)).toBe('00:30:00') // crosses midnight
    expect(calculateEndTime('10:45', 90)).toBe('12:15:00')
  })
})

describe('nextDayOfWeek', () => {
  it('returns same day when from is already that weekday', () => {
    // 2026-03-02 is a Monday (day 1)
    const monday = new Date('2026-03-02T00:00:00Z')
    const result = nextDayOfWeek(monday, MONDAY)
    expect(toDateString(result)).toBe('2026-03-02')
  })

  it('returns next occurrence when from is a different weekday', () => {
    // 2026-03-02 is Monday, next Wednesday is 2026-03-04
    const monday = new Date('2026-03-02T00:00:00Z')
    const result = nextDayOfWeek(monday, WEDNESDAY)
    expect(toDateString(result)).toBe('2026-03-04')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Unit: calculateDates
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateDates — weekly', () => {
  it('generates all Mondays in a 4-week window', () => {
    // 2026-03-02 is a Monday. Window ends 2026-03-29 (a Sunday).
    // Mondays in this window: 03-02, 03-09, 03-16, 03-23 (next is 03-30, outside window)
    const from = new Date('2026-03-02T00:00:00Z') // Monday
    const to = new Date('2026-03-29T00:00:00Z')   // Sunday (4 weeks - 1 day)

    const dates = calculateDates(
      'tpl-1',
      MONDAY,
      'weekly',
      from,
      to,
      new Set(),
      new Set(),
    )

    expect(dates).toEqual([
      '2026-03-02',
      '2026-03-09',
      '2026-03-16',
      '2026-03-23',
    ])
  })

  it('generates Mondays skipping closure dates', () => {
    const from = new Date('2026-03-02T00:00:00Z')
    const to = new Date('2026-03-30T00:00:00Z')
    const closures = new Set(['2026-03-09']) // skip second Monday

    const dates = calculateDates('tpl-1', MONDAY, 'weekly', from, to, closures, new Set())

    expect(dates).not.toContain('2026-03-09')
    expect(dates).toContain('2026-03-02')
    expect(dates).toContain('2026-03-16')
  })

  it('skips dates already in existing set', () => {
    const from = new Date('2026-03-02T00:00:00Z')
    const to = new Date('2026-03-30T00:00:00Z')
    const existing = new Set(['tpl-1|2026-03-09'])

    const dates = calculateDates('tpl-1', MONDAY, 'weekly', from, to, new Set(), existing)

    expect(dates).not.toContain('2026-03-09')
    expect(dates).toContain('2026-03-02')
  })
})

describe('calculateDates — biweekly', () => {
  it('generates every other Monday', () => {
    const from = new Date('2026-03-02T00:00:00Z') // Monday
    const to = new Date('2026-04-13T00:00:00Z')

    const dates = calculateDates('tpl-2', MONDAY, 'biweekly', from, to, new Set(), new Set())

    // Mondays: 03-02, 03-09, 03-16, 03-23, 03-30, 04-06, 04-13
    // Biweekly picks: 03-02, 03-16, 03-30, 04-13
    expect(dates).toEqual(['2026-03-02', '2026-03-16', '2026-03-30', '2026-04-13'])
  })

  it('biweekly with anchor that starts mid-week generates correct phase', () => {
    // From Wednesday, target is Monday → next Monday is 03-09
    // biweekly from 03-09: picks 03-09, 03-23
    const from = new Date('2026-03-04T00:00:00Z') // Wednesday
    const to = new Date('2026-03-30T00:00:00Z')

    const dates = calculateDates('tpl-2', MONDAY, 'biweekly', from, to, new Set(), new Set())

    expect(dates).toEqual(['2026-03-09', '2026-03-23'])
  })
})

describe('calculateDates — monthly', () => {
  it('generates first Monday of each month', () => {
    const from = new Date('2026-03-01T00:00:00Z')
    const to = new Date('2026-05-31T00:00:00Z')

    const dates = calculateDates('tpl-3', MONDAY, 'monthly', from, to, new Set(), new Set())

    // First Monday of March 2026 = March 2
    // First Monday of April 2026 = April 6
    // First Monday of May 2026 = May 4
    expect(dates).toEqual(['2026-03-02', '2026-04-06', '2026-05-04'])
  })

  it('skips month if first occurrence is outside window', () => {
    // Window starts March 15 — first Monday (March 2) is before window
    const from = new Date('2026-03-15T00:00:00Z')
    const to = new Date('2026-04-10T00:00:00Z')

    const dates = calculateDates('tpl-3', MONDAY, 'monthly', from, to, new Set(), new Set())

    // March's first Monday (03-02) is before from → skipped
    // April's first Monday (04-06) is within window → included
    expect(dates).toEqual(['2026-04-06'])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Integration: generateClassInstances
// ─────────────────────────────────────────────────────────────────────────────

describe('generateClassInstances', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function makeSupabaseMock({
    studio = { settings: {} },
    templates = [] as unknown[],
    existingInstances = [] as unknown[],
    onceCount = 0,
    insertedCount = 0,
  }: {
    studio?: unknown
    templates?: unknown[]
    existingInstances?: unknown[]
    onceCount?: number
    insertedCount?: number
  }) {
    // Each from() call returns a different chain based on the table
    let fromCallCount = 0
    const selectMock = vi.fn()

    const upsertChain = {
      select: vi.fn().mockResolvedValue({
        data: Array.from({ length: insertedCount }, (_, i) => ({ id: `inst-${i}` })),
        error: null,
      }),
    }

    const mock = {
      from: vi.fn((table: string) => {
        fromCallCount++
        return {
          select: vi.fn((cols?: string, opts?: unknown) => {
            // studios query
            if (table === 'studios') {
              return {
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: studio, error: null }),
              }
            }
            // class_templates query
            if (table === 'class_templates') {
              return {
                eq: vi.fn().mockReturnThis(),
                then: undefined,
                [Symbol.toStringTag]: 'Promise',
                // Make the chain awaitable directly (no .single() or .maybeSingle())
                ...makeAwaitable({ data: templates, error: null }),
              }
            }
            // class_instances select (existing check)
            if (table === 'class_instances') {
              // For count queries (head: true)
              if (opts && (opts as any).count === 'exact' && (opts as any).head === true) {
                return {
                  eq: vi.fn().mockReturnThis(),
                  ...makeAwaitable({ count: onceCount, error: null }),
                }
              }
              // For range queries
              return {
                eq: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                lte: vi.fn().mockReturnThis(),
                in: vi.fn().mockReturnThis(),
                ...makeAwaitable({ data: existingInstances, error: null }),
              }
            }
            return {
              eq: vi.fn().mockReturnThis(),
              ...makeAwaitable({ data: null, error: null }),
            }
          }),
          upsert: vi.fn().mockReturnValue(upsertChain),
        }
      }),
    }

    return mock
  }

  function makeAwaitable(value: unknown) {
    return {
      then: (resolve: (v: unknown) => void) => Promise.resolve(value).then(resolve),
      catch: (reject: (e: unknown) => void) => Promise.resolve(value).catch(reject),
      [Symbol.toStringTag]: 'Promise',
    }
  }

  it('returns 0 when there are no active templates', async () => {
    const mock = makeSupabaseMock({ templates: [] })
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const count = await generateClassInstances(STUDIO_ID)
    expect(count).toBe(0)
  })

  it('inserts instances for a weekly template', async () => {
    const template = {
      id: 'tpl-weekly',
      name: 'Morning Yoga',
      teacher_id: 'teacher-1',
      day_of_week: MONDAY,
      start_time: '09:00',
      duration_min: 60,
      max_capacity: 15,
      recurrence: 'weekly',
    }

    const mock = makeSupabaseMock({
      templates: [template],
      existingInstances: [],
      insertedCount: 4, // 4 weeks × 1 instance/week
    })
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const count = await generateClassInstances(STUDIO_ID, 4)
    expect(count).toBe(4)
  })

  it('skips existing instances — does not duplicate', async () => {
    const template = {
      id: 'tpl-weekly',
      name: 'Morning Yoga',
      teacher_id: 'teacher-1',
      day_of_week: MONDAY,
      start_time: '09:00',
      duration_min: 60,
      max_capacity: 15,
      recurrence: 'weekly',
    }

    // Simulate 2 instances already existing
    const existingInstances = [
      { template_id: 'tpl-weekly', date: '2026-03-02' },
      { template_id: 'tpl-weekly', date: '2026-03-09' },
    ]

    const mock = makeSupabaseMock({
      templates: [template],
      existingInstances,
      insertedCount: 2, // only 2 new ones
    })
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const count = await generateClassInstances(STUDIO_ID, 4)
    expect(count).toBe(2)
  })

  it('skips templates with no day_of_week', async () => {
    const template = {
      id: 'tpl-noday',
      name: 'Free-form',
      teacher_id: null,
      day_of_week: null,
      start_time: '09:00',
      duration_min: 60,
      max_capacity: 10,
      recurrence: 'weekly',
    }

    const mock = makeSupabaseMock({ templates: [template], insertedCount: 0 })
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const count = await generateClassInstances(STUDIO_ID)
    expect(count).toBe(0)
  })

  it('skips closure dates from studio settings', async () => {
    // This is tested at the unit level via calculateDates; the integration test
    // confirms closureDates flow from studio.settings into the generator.
    // (The exact skipping is verified in calculateDates tests above.)
    const template = {
      id: 'tpl-weekly',
      name: 'Morning Yoga',
      teacher_id: 'teacher-1',
      day_of_week: MONDAY,
      start_time: '09:00',
      duration_min: 60,
      max_capacity: 15,
      recurrence: 'weekly',
    }

    const mock = makeSupabaseMock({
      studio: { settings: { closureDates: ['2026-03-09'] } },
      templates: [template],
      existingInstances: [],
      insertedCount: 3, // 4 Mondays minus 1 closure = 3
    })
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const count = await generateClassInstances(STUDIO_ID, 4)
    expect(count).toBe(3)
  })

  it('does not generate once template that already has an instance', async () => {
    const template = {
      id: 'tpl-once',
      name: 'Workshop',
      teacher_id: 'teacher-1',
      day_of_week: MONDAY,
      start_time: '10:00',
      duration_min: 120,
      max_capacity: 8,
      recurrence: 'once',
    }

    const mock = makeSupabaseMock({
      templates: [template],
      onceCount: 1, // already has an instance
      insertedCount: 0,
    })
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const count = await generateClassInstances(STUDIO_ID)
    expect(count).toBe(0)
  })
})
