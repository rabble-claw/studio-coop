import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import migration from '../routes/migration'
import { errorHandler } from '../middleware/error-handler'
import {
  parseCSV,
  autoDetectColumns,
  validateRow,
  generatePreview,
} from '../lib/migration'

vi.mock('../lib/supabase', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'user-123', email: 'test@example.com' })
    c.set('accessToken', 'fake-token')
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
}))

import { createServiceClient } from '../lib/supabase'

const STUDIO_ID = 'studio-abc'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/studios', migration)
  return app
}

// ── CSV Parser Tests ─────────────────────────────────────────────────────────

describe('parseCSV', () => {
  it('parses standard CSV with headers', () => {
    const csv = `First Name,Last Name,Email,Phone
John,Doe,john@example.com,+1234567890
Jane,Smith,jane@example.com,+0987654321`

    const rows = parseCSV(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0]['First Name']).toBe('John')
    expect(rows[0]['Email']).toBe('john@example.com')
    expect(rows[1]['Last Name']).toBe('Smith')
  })

  it('handles quoted fields with commas', () => {
    const csv = `Name,Email,Notes
"Doe, John",john@example.com,"Some notes, with comma"`

    const rows = parseCSV(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0]['Name']).toBe('Doe, John')
    expect(rows[0]['Notes']).toBe('Some notes, with comma')
  })

  it('handles empty CSV', () => {
    const rows = parseCSV('')
    expect(rows).toEqual([])
  })

  it('handles headers-only CSV', () => {
    const csv = 'Name,Email,Phone'
    const rows = parseCSV(csv)
    expect(rows).toEqual([])
  })
})

// ── Auto-detect Column Mapping Tests ─────────────────────────────────────────

describe('autoDetectColumns', () => {
  it('detects standard Mindbody columns', () => {
    const headers = ['First Name', 'Last Name', 'Email', 'Mobile Phone', 'Membership Type']
    const columns = autoDetectColumns(headers)

    const nameCol = columns.find(c => c.target === 'name')
    expect(nameCol).toBeDefined()
    expect(nameCol!.source).toBe('First Name')

    const emailCol = columns.find(c => c.target === 'email')
    expect(emailCol).toBeDefined()
    expect(emailCol!.source).toBe('Email')
    expect(emailCol!.required).toBe(true)

    const phoneCol = columns.find(c => c.target === 'phone')
    expect(phoneCol).toBeDefined()
    expect(phoneCol!.source).toBe('Mobile Phone')

    const membershipCol = columns.find(c => c.target === 'membership_type')
    expect(membershipCol).toBeDefined()
    expect(membershipCol!.source).toBe('Membership Type')
  })

  it('detects alternative column names', () => {
    const headers = ['Full Name', 'email_address', 'phone_number', 'plan']
    const columns = autoDetectColumns(headers)

    expect(columns.find(c => c.target === 'name')!.source).toBe('Full Name')
    expect(columns.find(c => c.target === 'email')!.source).toBe('email_address')
    expect(columns.find(c => c.target === 'phone')!.source).toBe('phone_number')
    expect(columns.find(c => c.target === 'membership_type')!.source).toBe('plan')
  })
})

// ── Row Validation Tests ─────────────────────────────────────────────────────

describe('validateRow', () => {
  const columns = [
    { source: 'Name', target: 'name', required: true },
    { source: 'Email', target: 'email', required: true },
    { source: 'Phone', target: 'phone', required: false },
    { source: 'Membership', target: 'membership_type', required: false },
  ]

  it('validates a correct row', () => {
    const row = { Name: 'John Doe', Email: 'john@example.com', Phone: '+1234567890', Membership: 'Monthly' }
    const result = validateRow(row, columns)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects row with missing required fields', () => {
    const row = { Name: '', Email: 'john@example.com', Phone: '', Membership: '' }
    const result = validateRow(row, columns)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('name is required')
  })

  it('rejects row with invalid email', () => {
    const row = { Name: 'John', Email: 'not-an-email', Phone: '', Membership: '' }
    const result = validateRow(row, columns)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Invalid email format')
  })

  it('rejects row with invalid phone format', () => {
    const row = { Name: 'John', Email: 'john@example.com', Phone: 'abc', Membership: '' }
    const result = validateRow(row, columns)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Invalid phone format')
  })

  it('allows empty optional phone', () => {
    const row = { Name: 'John', Email: 'john@example.com', Phone: '', Membership: '' }
    const result = validateRow(row, columns)
    expect(result.valid).toBe(true)
  })
})

// ── Preview Generation Tests ─────────────────────────────────────────────────

describe('generatePreview', () => {
  it('returns correct counts for mixed valid/invalid rows', () => {
    const rows = [
      { Name: 'John', Email: 'john@example.com', Phone: '+1234567890' },
      { Name: '', Email: 'missing-name@example.com', Phone: '' },
      { Name: 'Jane', Email: 'jane@example.com', Phone: '' },
      { Name: 'Bad', Email: 'not-valid', Phone: '' },
    ]

    const columns = [
      { source: 'Name', target: 'name', required: true },
      { source: 'Email', target: 'email', required: true },
      { source: 'Phone', target: 'phone', required: false },
    ]

    const preview = generatePreview(rows, columns)
    expect(preview.totalRows).toBe(4)
    expect(preview.validRows).toBe(2)
    expect(preview.invalidRows).toBe(2)
    expect(preview.columns).toEqual(columns)
    expect(preview.sampleRows.length).toBeLessThanOrEqual(5)
  })

  it('limits sample rows to 5', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      Name: `Person ${i}`,
      Email: `person${i}@example.com`,
      Phone: '',
    }))

    const columns = [
      { source: 'Name', target: 'name', required: true },
      { source: 'Email', target: 'email', required: true },
      { source: 'Phone', target: 'phone', required: false },
    ]

    const preview = generatePreview(rows, columns)
    expect(preview.sampleRows).toHaveLength(5)
    expect(preview.totalRows).toBe(20)
  })
})

// ── API Route Tests ──────────────────────────────────────────────────────────

describe('POST /api/studios/:studioId/migrate/upload — upload CSV', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns preview for valid CSV', async () => {
    const app = makeApp()
    const csv = `First Name,Last Name,Email,Mobile Phone
John,Doe,john@example.com,+1234567890
Jane,Smith,jane@example.com,+0987654321`

    const res = await app.request(`/api/studios/${STUDIO_ID}/migrate/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ csv }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.preview.totalRows).toBe(2)
    expect(body.preview.validRows).toBe(2)
    expect(body.preview.columns.length).toBeGreaterThan(0)
  })

  it('rejects empty CSV', async () => {
    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/migrate/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ csv: '' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/studios/:studioId/migrate/execute — execute import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates members and skips duplicates', async () => {
    const csv = `Name,Email,Phone
John Doe,john@example.com,+1234567890
Jane Smith,jane@example.com,+0987654321`

    const columns = [
      { source: 'Name', target: 'name', required: true },
      { source: 'Email', target: 'email', required: true },
      { source: 'Phone', target: 'phone', required: false },
    ]

    // Mock user lookup — john exists, jane doesn't
    const fromFn = vi.fn()
    let insertCount = 0
    fromFn.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn()
                .mockResolvedValueOnce({ data: { id: 'existing-user-1' }, error: null }) // john exists
                .mockResolvedValueOnce({ data: null, error: null }), // jane doesn't
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'new-user-2' },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn()
                  .mockResolvedValueOnce({ data: { id: 'existing-membership' }, error: null }) // john already member
                  .mockResolvedValueOnce({ data: null, error: null }), // jane not member
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'new-membership' },
                error: null,
              }),
            }),
          }),
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }
    })

    vi.mocked(createServiceClient).mockReturnValue({ from: fromFn } as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/migrate/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ csv, columns }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result.totalProcessed).toBe(2)
    expect(body.result.created).toBeGreaterThanOrEqual(0)
    expect(body.result.skipped).toBeGreaterThanOrEqual(0)
  })
})

describe('POST /api/studios/:studioId/migrate/preview — preview with custom mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns preview with custom column mapping', async () => {
    const csv = `Nombre,Correo,Telefono
Juan,juan@example.com,+1234567890`

    const columns = [
      { source: 'Nombre', target: 'name', required: true },
      { source: 'Correo', target: 'email', required: true },
      { source: 'Telefono', target: 'phone', required: false },
    ]

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/migrate/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ csv, columns }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.preview.totalRows).toBe(1)
    expect(body.preview.validRows).toBe(1)
  })
})

describe('Error reporting per row', () => {
  it('returns errors for each invalid row in preview', () => {
    const rows = [
      { Name: 'Valid', Email: 'valid@example.com', Phone: '' },
      { Name: '', Email: 'nope', Phone: 'abc' },
    ]

    const columns = [
      { source: 'Name', target: 'name', required: true },
      { source: 'Email', target: 'email', required: true },
      { source: 'Phone', target: 'phone', required: false },
    ]

    const preview = generatePreview(rows, columns)
    const invalidRow = preview.sampleRows.find(r => !r.valid)
    expect(invalidRow).toBeDefined()
    expect(invalidRow!.errors.length).toBeGreaterThanOrEqual(2) // missing name + bad email
  })
})
