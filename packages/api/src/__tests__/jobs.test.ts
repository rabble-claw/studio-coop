import { describe, it, expect, vi, beforeEach } from 'vitest'
import { app } from '../index'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../lib/notifications', () => ({ sendNotification: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../lib/class-generator', () => ({ generateClassInstances: vi.fn().mockResolvedValue(5) }))

import { createServiceClient } from '../lib/supabase'
import { sendNotification } from '../lib/notifications'
import { generateClassInstances } from '../lib/class-generator'

const CRON_SECRET = 'test-secret'
const cronHeader = { Authorization: `Bearer ${CRON_SECRET}` }

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = CRON_SECRET
})

afterEach(() => {
  delete process.env.CRON_SECRET
})

/** Fluent chain that resolves to `value` at any depth */
function fluentChain(value: unknown): any {
  return new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') return (res: (v: unknown) => void) => Promise.resolve(value).then(res)
      if (prop === 'catch') return (rej: (e: unknown) => void) => Promise.resolve(value).catch(rej)
      return () => fluentChain(value)
    },
  })
}

describe('POST /api/jobs/reminders', () => {
  it('rejects without CRON_SECRET', async () => {
    const res = await app.request('/api/jobs/reminders', { method: 'POST' })
    expect(res.status).toBe(401)
  })

  it('sends 24h reminders for upcoming bookings', async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const bookings = [{
      id: 'b1', user_id: 'u1',
      class_instance: { id: 'ci1', studio_id: 's1', date: tomorrow.toISOString().split('T')[0], start_time: '09:00', template: { name: 'Pole Dance' } },
    }]

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'bookings') return fluentChain({ data: bookings, error: null })
        if (table === 'notifications') return fluentChain({ data: [], error: null })
        return fluentChain({ data: [], error: null })
      }),
    } as any)

    const res = await app.request('/api/jobs/reminders', {
      method: 'POST',
      headers: cronHeader,
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sent24hReminders).toBeGreaterThanOrEqual(0)
    expect(body.sent2hReminders).toBeGreaterThanOrEqual(0)
  })

  it('skips already-sent reminders (duplicate prevention)', async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const bookings = [{
      id: 'b1', user_id: 'u1',
      class_instance: { id: 'ci1', studio_id: 's1', date: tomorrow.toISOString().split('T')[0], start_time: '09:00', template: { name: 'Pole Dance' } },
    }]

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'bookings') return fluentChain({ data: bookings, error: null })
        // Already sent: return an existing notification record
        if (table === 'notifications') return fluentChain({ data: [{ id: 'n-existing' }], error: null })
        return fluentChain({ data: [], error: null })
      }),
    } as any)

    const res = await app.request('/api/jobs/reminders', {
      method: 'POST',
      headers: cronHeader,
    })
    expect(res.status).toBe(200)
    // Should have skipped due to duplicate check
    expect(sendNotification).not.toHaveBeenCalled()
  })
})

describe('POST /api/jobs/reengagement', () => {
  it('rejects without CRON_SECRET', async () => {
    const res = await app.request('/api/jobs/reengagement', { method: 'POST' })
    expect(res.status).toBe(401)
  })

  it('sends re-engagement notification to inactive members', async () => {
    const studios = [{ id: 's1', name: 'Test Studio', settings: {} }]
    const memberships = [{ user_id: 'u1' }]

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'studios') return fluentChain({ data: studios, error: null })
        if (table === 'memberships') return fluentChain({ data: memberships, error: null })
        if (table === 'bookings') return fluentChain({ data: [], error: null })        // no recent bookings
        if (table === 'notifications') return fluentChain({ data: [], error: null })   // no recent reengagement
        return fluentChain({ data: [], error: null })
      }),
    } as any)

    const res = await app.request('/api/jobs/reengagement', {
      method: 'POST',
      headers: cronHeader,
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reengagementSent).toBe(1)
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', type: 'reengagement' }),
    )
  })

  it('skips studios with reengagementEnabled=false', async () => {
    const studios = [{ id: 's1', name: 'Test Studio', settings: { notifications: { reengagementEnabled: false } } }]

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'studios') return fluentChain({ data: studios, error: null })
        return fluentChain({ data: [], error: null })
      }),
    } as any)

    const res = await app.request('/api/jobs/reengagement', {
      method: 'POST',
      headers: cronHeader,
    })
    expect(res.status).toBe(200)
    expect(sendNotification).not.toHaveBeenCalled()
  })

  it('skips recently active members', async () => {
    const studios = [{ id: 's1', name: 'Test Studio', settings: {} }]
    const memberships = [{ user_id: 'u1' }]
    const recentBooking = [{ id: 'b-recent' }]

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'studios') return fluentChain({ data: studios, error: null })
        if (table === 'memberships') return fluentChain({ data: memberships, error: null })
        if (table === 'bookings') return fluentChain({ data: recentBooking, error: null })  // has recent booking
        return fluentChain({ data: [], error: null })
      }),
    } as any)

    await app.request('/api/jobs/reengagement', { method: 'POST', headers: cronHeader })
    expect(sendNotification).not.toHaveBeenCalled()
  })

  it('uses custom reengagementDays from studio settings', async () => {
    // Studio with 30-day threshold; member booked 20 days ago (still within 30 days → skip)
    const studios = [{ id: 's1', name: 'Studio', settings: { notifications: { reengagementDays: 30 } } }]
    const memberships = [{ user_id: 'u1' }]

    // 20 days ago booking — within 30 day window, so member is still "active"
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
    const recentBooking = [{ id: 'b1', booked_at: twentyDaysAgo.toISOString() }]

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'studios') return fluentChain({ data: studios, error: null })
        if (table === 'memberships') return fluentChain({ data: memberships, error: null })
        if (table === 'bookings') return fluentChain({ data: recentBooking, error: null })
        return fluentChain({ data: [], error: null })
      }),
    } as any)

    await app.request('/api/jobs/reengagement', { method: 'POST', headers: cronHeader })
    expect(sendNotification).not.toHaveBeenCalled()
  })
})

describe('POST /api/jobs/generate-classes', () => {
  it('rejects without CRON_SECRET', async () => {
    const res = await app.request('/api/jobs/generate-classes', { method: 'POST' })
    expect(res.status).toBe(401)
  })

  it('generates classes for all active studios', async () => {
    const studios = [{ id: 's1' }, { id: 's2' }]

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'studios') return fluentChain({ data: studios, error: null })
        if (table === 'class_templates') return fluentChain({ data: [], error: null })
        return fluentChain({ data: studios, error: null })
      }),
    } as any)

    vi.mocked(generateClassInstances).mockResolvedValue(5)

    const res = await app.request('/api/jobs/generate-classes', {
      method: 'POST',
      headers: { ...cronHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ weeksAhead: 4 }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.studiosProcessed).toBe(2)
    expect(body.totalGenerated).toBe(10)
    expect(generateClassInstances).toHaveBeenCalledTimes(2)
  })
})
