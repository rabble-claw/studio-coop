import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import schedule from '../routes/schedule'
import { errorHandler } from '../middleware/error-handler'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../lib/class-generator', () => ({ generateClassInstances: vi.fn() }))
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'user-123', email: 'admin@example.com' })
    await next()
  }),
}))
vi.mock('../middleware/studio-access', () => ({
  requireAdmin: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'admin')
    await next()
  }),
  requireOwner: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'owner')
    await next()
  }),
  requireMember: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'member')
    await next()
  }),
}))

import { createServiceClient } from '../lib/supabase'

const STUDIO_ID = 'studio-abc'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/studios', schedule)
  app.route('/', schedule)
  return app
}

const createdTemplate = { id: 'tpl-oneoff' }
const createdInstance = {
  id: 'inst-oneoff',
  template_id: 'tpl-oneoff',
  studio_id: STUDIO_ID,
  teacher_id: 'teacher-1',
  date: '2026-04-05',
  start_time: '10:00',
  end_time: '11:30:00',
  status: 'scheduled',
  max_capacity: 8,
  notes: 'Special workshop',
  feed_enabled: true,
}

describe('POST /api/studios/:studioId/classes (one-off)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  function makeSupabaseMock({
    templateInsertError = null,
    instanceInsertError = null,
  }: {
    templateInsertError?: unknown
    instanceInsertError?: unknown
  } = {}) {
    const tplInsertSingle = vi.fn().mockResolvedValue({ data: createdTemplate, error: templateInsertError })
    const tplInsertSelect = vi.fn().mockReturnValue({ single: tplInsertSingle })
    const tplInsert = vi.fn().mockReturnValue({ select: tplInsertSelect })

    const instInsertSingle = vi.fn().mockResolvedValue({ data: createdInstance, error: instanceInsertError })
    const instInsertSelect = vi.fn().mockReturnValue({ single: instInsertSingle })
    const instInsert = vi.fn().mockReturnValue({ select: instInsertSelect })

    let fromCallCount = 0
    return {
      from: vi.fn((table: string) => {
        fromCallCount++
        if (table === 'class_templates') return { insert: tplInsert }
        if (table === 'class_instances') return { insert: instInsert }
        return {}
      }),
    }
  }

  it('creates a one-off class with all required fields', async () => {
    const mock = makeSupabaseMock()
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/classes`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Advanced Workshop',
        description: 'Special session',
        teacher_id: 'teacher-1',
        date: '2026-04-05',
        start_time: '10:00',
        duration_min: 90,
        capacity: 8,
        notes: 'Special workshop',
      }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe('inst-oneoff')
    expect(body.status).toBe('scheduled')
  })

  it('creates template with recurrence=once and active=false', async () => {
    const mock = makeSupabaseMock()
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    await app.request(`/api/studios/${STUDIO_ID}/classes`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'One-off',
        date: '2026-04-05',
        start_time: '09:00',
        duration_min: 60,
      }),
    })

    // Verify template was inserted with recurrence='once', active=false
    const tplInsert = mock.from.mock.results[0].value.insert
    expect(tplInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        recurrence: 'once',
        active: false,
        studio_id: STUDIO_ID,
      }),
    )
  })

  it('rejects missing required fields', async () => {
    const mock = makeSupabaseMock()
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()

    // Missing name
    const res1 = await app.request(`/api/studios/${STUDIO_ID}/classes`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '2026-04-05', start_time: '10:00', duration_min: 60 }),
    })
    expect(res1.status).toBe(400)

    // Missing date
    const res2 = await app.request(`/api/studios/${STUDIO_ID}/classes`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', start_time: '10:00', duration_min: 60 }),
    })
    expect(res2.status).toBe(400)
  })

  it('sets all fields correctly on the created instance', async () => {
    const mock = makeSupabaseMock()
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    await app.request(`/api/studios/${STUDIO_ID}/classes`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Workshop',
        date: '2026-04-05',
        start_time: '10:00',
        duration_min: 90,
      }),
    })

    // Verify instance was inserted with correct end_time (10:00 + 90min = 11:30)
    const instInsert = mock.from.mock.results[1].value.insert
    expect(instInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        date: '2026-04-05',
        start_time: '10:00',
        end_time: '11:30:00',
        status: 'scheduled',
        studio_id: STUDIO_ID,
        template_id: 'tpl-oneoff',
      }),
    )
  })
})
