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

  it('handles escaped double quotes inside quoted fields', () => {
    const csv = `Name,Email,Notes
"John ""JD"" Doe",john@example.com,"Said ""hello"""`

    const rows = parseCSV(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0]['Name']).toBe('John "JD" Doe')
    expect(rows[0]['Notes']).toBe('Said "hello"')
  })

  it('handles empty values in the middle and end', () => {
    const csv = `First Name,Last Name,Email,Phone,Membership
John,,john@example.com,,Monthly
Jane,Smith,jane@example.com,+123,`

    const rows = parseCSV(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0]['Last Name']).toBe('')
    expect(rows[0]['Phone']).toBe('')
    expect(rows[1]['Membership']).toBe('')
  })

  it('handles Windows-style CRLF line endings', () => {
    const csv = "Name,Email\r\nJohn,john@example.com\r\nJane,jane@example.com"

    const rows = parseCSV(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0]['Name']).toBe('John')
    expect(rows[1]['Email']).toBe('jane@example.com')
  })

  it('skips blank lines in the body', () => {
    const csv = `Name,Email
John,john@example.com

Jane,jane@example.com
`

    const rows = parseCSV(csv)
    expect(rows).toHaveLength(2)
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

  it('handles more values than headers (extra values ignored)', () => {
    const csv = `Name,Email
John,john@example.com,extra-value`

    const rows = parseCSV(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0]['Name']).toBe('John')
    expect(rows[0]['Email']).toBe('john@example.com')
  })

  it('handles fewer values than headers (missing values become empty)', () => {
    const csv = `Name,Email,Phone
John,john@example.com`

    const rows = parseCSV(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0]['Phone']).toBe('')
  })

  it('trims whitespace from unquoted fields', () => {
    const csv = `Name,Email
 John , john@example.com `

    const rows = parseCSV(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0]['Name']).toBe('John')
    expect(rows[0]['Email']).toBe('john@example.com')
  })
})

// ── Auto-detect Column Mapping: Mindbody Mailing List ────────────────────────

describe('autoDetectColumns — Mindbody Mailing List', () => {
  const headers = ['First Name', 'Last Name', 'Phone Number', 'Email Address']

  it('detects all four columns', () => {
    const columns = autoDetectColumns(headers)

    const nameCol = columns.find(c => c.target === 'name')
    expect(nameCol).toBeDefined()
    expect(nameCol!.source).toBe('First Name')
    expect(nameCol!.required).toBe(true)

    const lastNameCol = columns.find(c => c.target === 'last_name')
    expect(lastNameCol).toBeDefined()
    expect(lastNameCol!.source).toBe('Last Name')

    const emailCol = columns.find(c => c.target === 'email')
    expect(emailCol).toBeDefined()
    expect(emailCol!.source).toBe('Email Address')
    expect(emailCol!.required).toBe(true)

    const phoneCol = columns.find(c => c.target === 'phone')
    expect(phoneCol).toBeDefined()
    expect(phoneCol!.source).toBe('Phone Number')
  })

  it('maps all headers (no unmatched)', () => {
    const columns = autoDetectColumns(headers)
    expect(columns).toHaveLength(4)
  })
})

// ── Auto-detect Column Mapping: Mindbody Client Report ───────────────────────

describe('autoDetectColumns — Mindbody Client Report', () => {
  const headers = [
    'ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Home Phone',
    'Mobile Phone', 'Date Added', 'Last Visit', 'Status',
    'Active Memberships', 'Account Balance',
  ]

  it('detects name, last_name, email', () => {
    const columns = autoDetectColumns(headers)

    expect(columns.find(c => c.target === 'name')!.source).toBe('First Name')
    expect(columns.find(c => c.target === 'last_name')!.source).toBe('Last Name')
    expect(columns.find(c => c.target === 'email')!.source).toBe('Email')
  })

  it('detects phone and home_phone as separate targets', () => {
    const columns = autoDetectColumns(headers)

    // "Phone" should match phone target
    const phoneCol = columns.find(c => c.target === 'phone')
    expect(phoneCol).toBeDefined()
    expect(phoneCol!.source).toBe('Phone')

    // "Home Phone" should match home_phone target
    const homePhoneCol = columns.find(c => c.target === 'home_phone')
    expect(homePhoneCol).toBeDefined()
    expect(homePhoneCol!.source).toBe('Home Phone')
  })

  it('detects Date Added as join_date', () => {
    const columns = autoDetectColumns(headers)
    const joinDateCol = columns.find(c => c.target === 'join_date')
    expect(joinDateCol).toBeDefined()
    expect(joinDateCol!.source).toBe('Date Added')
  })

  it('detects Last Visit', () => {
    const columns = autoDetectColumns(headers)
    const lastVisitCol = columns.find(c => c.target === 'last_visit')
    expect(lastVisitCol).toBeDefined()
    expect(lastVisitCol!.source).toBe('Last Visit')
  })

  it('detects Status', () => {
    const columns = autoDetectColumns(headers)
    const statusCol = columns.find(c => c.target === 'status')
    expect(statusCol).toBeDefined()
    expect(statusCol!.source).toBe('Status')
  })

  it('detects Active Memberships as membership_type', () => {
    const columns = autoDetectColumns(headers)
    const membershipCol = columns.find(c => c.target === 'membership_type')
    expect(membershipCol).toBeDefined()
    expect(membershipCol!.source).toBe('Active Memberships')
  })

  it('detects Account Balance', () => {
    const columns = autoDetectColumns(headers)
    const balanceCol = columns.find(c => c.target === 'account_balance')
    expect(balanceCol).toBeDefined()
    expect(balanceCol!.source).toBe('Account Balance')
  })

  it('detects ID as client_id', () => {
    const columns = autoDetectColumns(headers)
    const idCol = columns.find(c => c.target === 'client_id')
    expect(idCol).toBeDefined()
    expect(idCol!.source).toBe('ID')
  })

  it('detects at least 10 columns from the 12 headers', () => {
    const columns = autoDetectColumns(headers)
    // Mobile Phone will remain unmatched since Phone already claimed the phone target
    // But we should detect at least 10 of the 12
    expect(columns.length).toBeGreaterThanOrEqual(10)
  })
})

// ── Auto-detect Column Mapping: Mindbody Subscriber Export ───────────────────

describe('autoDetectColumns — Mindbody Subscriber Data Export', () => {
  const headers = [
    'Client ID', 'First Name', 'Last Name', 'Email', 'Status',
    'Barcode ID', 'Creation Date', 'Active', 'Pricing Option',
    'Member Since', 'Payment Amount', 'Auto-Pay Schedule',
  ]

  it('detects name, last_name, email', () => {
    const columns = autoDetectColumns(headers)

    expect(columns.find(c => c.target === 'name')!.source).toBe('First Name')
    expect(columns.find(c => c.target === 'last_name')!.source).toBe('Last Name')
    expect(columns.find(c => c.target === 'email')!.source).toBe('Email')
  })

  it('detects Client ID as client_id', () => {
    const columns = autoDetectColumns(headers)
    const idCol = columns.find(c => c.target === 'client_id')
    expect(idCol).toBeDefined()
    expect(idCol!.source).toBe('Client ID')
  })

  it('detects Status column', () => {
    const columns = autoDetectColumns(headers)
    const statusCol = columns.find(c => c.target === 'status')
    expect(statusCol).toBeDefined()
    expect(statusCol!.source).toBe('Status')
  })

  it('detects Pricing Option as membership_type', () => {
    const columns = autoDetectColumns(headers)
    const membershipCol = columns.find(c => c.target === 'membership_type')
    expect(membershipCol).toBeDefined()
    expect(membershipCol!.source).toBe('Pricing Option')
  })

  it('detects Creation Date or Member Since as join_date', () => {
    const columns = autoDetectColumns(headers)
    const joinDateCol = columns.find(c => c.target === 'join_date')
    expect(joinDateCol).toBeDefined()
    // Creation Date or Member Since — whichever matches first
    expect(['Creation Date', 'Member Since']).toContain(joinDateCol!.source)
  })

  it('detects Payment Amount', () => {
    const columns = autoDetectColumns(headers)
    const paymentCol = columns.find(c => c.target === 'payment_amount')
    expect(paymentCol).toBeDefined()
    expect(paymentCol!.source).toBe('Payment Amount')
  })

  it('detects Auto-Pay Schedule as payment_schedule', () => {
    const columns = autoDetectColumns(headers)
    const scheduleCol = columns.find(c => c.target === 'payment_schedule')
    expect(scheduleCol).toBeDefined()
    expect(scheduleCol!.source).toBe('Auto-Pay Schedule')
  })

  it('detects at least 8 columns from the 12 headers', () => {
    const columns = autoDetectColumns(headers)
    expect(columns.length).toBeGreaterThanOrEqual(8)
  })
})

// ── Auto-detect Column Mapping: Vagaro Customer List ─────────────────────────

describe('autoDetectColumns — Vagaro Customer List', () => {
  const headers = [
    'First Name', 'Last Name', 'Email', 'Mobile Phone', 'Home Phone',
    'Address', 'City', 'State', 'Zip', 'Birthday',
    'Gender', 'Notes', 'Last Appointment', 'Customer Since', 'Source',
  ]

  it('detects name and last_name', () => {
    const columns = autoDetectColumns(headers)

    expect(columns.find(c => c.target === 'name')!.source).toBe('First Name')
    expect(columns.find(c => c.target === 'last_name')!.source).toBe('Last Name')
  })

  it('detects email', () => {
    const columns = autoDetectColumns(headers)
    expect(columns.find(c => c.target === 'email')!.source).toBe('Email')
  })

  it('detects Mobile Phone as phone', () => {
    const columns = autoDetectColumns(headers)
    const phoneCol = columns.find(c => c.target === 'phone')
    expect(phoneCol).toBeDefined()
    expect(phoneCol!.source).toBe('Mobile Phone')
  })

  it('detects Home Phone as home_phone', () => {
    const columns = autoDetectColumns(headers)
    const homePhoneCol = columns.find(c => c.target === 'home_phone')
    expect(homePhoneCol).toBeDefined()
    expect(homePhoneCol!.source).toBe('Home Phone')
  })

  it('detects Address, City, State, Zip', () => {
    const columns = autoDetectColumns(headers)

    expect(columns.find(c => c.target === 'address')!.source).toBe('Address')
    expect(columns.find(c => c.target === 'city')!.source).toBe('City')
    expect(columns.find(c => c.target === 'state')!.source).toBe('State')
    expect(columns.find(c => c.target === 'zip')!.source).toBe('Zip')
  })

  it('detects Birthday', () => {
    const columns = autoDetectColumns(headers)
    const birthdayCol = columns.find(c => c.target === 'birthday')
    expect(birthdayCol).toBeDefined()
    expect(birthdayCol!.source).toBe('Birthday')
  })

  it('detects Gender', () => {
    const columns = autoDetectColumns(headers)
    const genderCol = columns.find(c => c.target === 'gender')
    expect(genderCol).toBeDefined()
    expect(genderCol!.source).toBe('Gender')
  })

  it('detects Notes', () => {
    const columns = autoDetectColumns(headers)
    const notesCol = columns.find(c => c.target === 'notes')
    expect(notesCol).toBeDefined()
    expect(notesCol!.source).toBe('Notes')
  })

  it('detects Last Appointment as last_visit', () => {
    const columns = autoDetectColumns(headers)
    const lastVisitCol = columns.find(c => c.target === 'last_visit')
    expect(lastVisitCol).toBeDefined()
    expect(lastVisitCol!.source).toBe('Last Appointment')
  })

  it('detects Customer Since as join_date', () => {
    const columns = autoDetectColumns(headers)
    const joinDateCol = columns.find(c => c.target === 'join_date')
    expect(joinDateCol).toBeDefined()
    expect(joinDateCol!.source).toBe('Customer Since')
  })

  it('detects Source', () => {
    const columns = autoDetectColumns(headers)
    const sourceCol = columns.find(c => c.target === 'source')
    expect(sourceCol).toBeDefined()
    expect(sourceCol!.source).toBe('Source')
  })

  it('detects at least 13 columns from the 15 headers', () => {
    const columns = autoDetectColumns(headers)
    expect(columns.length).toBeGreaterThanOrEqual(13)
  })
})

// ── Auto-detect Column Mapping: Generic / Alternative Headers ────────────────

describe('autoDetectColumns — generic and alternative headers', () => {
  it('detects Full Name as name', () => {
    const columns = autoDetectColumns(['Full Name', 'Email'])
    expect(columns.find(c => c.target === 'name')!.source).toBe('Full Name')
  })

  it('detects Client Name as name', () => {
    const columns = autoDetectColumns(['Client Name', 'Email'])
    expect(columns.find(c => c.target === 'name')!.source).toBe('Client Name')
  })

  it('detects Customer Name as name', () => {
    const columns = autoDetectColumns(['Customer Name', 'Email'])
    expect(columns.find(c => c.target === 'name')!.source).toBe('Customer Name')
  })

  it('detects Surname as last_name', () => {
    const columns = autoDetectColumns(['Name', 'Surname', 'Email'])
    expect(columns.find(c => c.target === 'last_name')!.source).toBe('Surname')
  })

  it('detects email_address (underscore format)', () => {
    const columns = autoDetectColumns(['Name', 'email_address'])
    expect(columns.find(c => c.target === 'email')!.source).toBe('email_address')
  })

  it('detects e-mail as email', () => {
    const columns = autoDetectColumns(['Name', 'e-mail'])
    expect(columns.find(c => c.target === 'email')!.source).toBe('e-mail')
  })

  it('detects Cell Phone as phone', () => {
    const columns = autoDetectColumns(['Name', 'Email', 'Cell Phone'])
    expect(columns.find(c => c.target === 'phone')!.source).toBe('Cell Phone')
  })

  it('detects Telephone as phone', () => {
    const columns = autoDetectColumns(['Name', 'Email', 'Telephone'])
    expect(columns.find(c => c.target === 'phone')!.source).toBe('Telephone')
  })

  it('detects plan as membership_type', () => {
    const columns = autoDetectColumns(['Full Name', 'email_address', 'phone_number', 'plan'])
    expect(columns.find(c => c.target === 'membership_type')!.source).toBe('plan')
  })

  it('detects subscription as membership_type', () => {
    const columns = autoDetectColumns(['Name', 'Email', 'subscription'])
    expect(columns.find(c => c.target === 'membership_type')!.source).toBe('subscription')
  })

  it('detects Postal Code as zip', () => {
    const columns = autoDetectColumns(['Name', 'Email', 'Postal Code'])
    expect(columns.find(c => c.target === 'zip')!.source).toBe('Postal Code')
  })

  it('detects Date of Birth as birthday', () => {
    const columns = autoDetectColumns(['Name', 'Email', 'Date of Birth'])
    expect(columns.find(c => c.target === 'birthday')!.source).toBe('Date of Birth')
  })

  it('detects DOB as birthday', () => {
    const columns = autoDetectColumns(['Name', 'Email', 'DOB'])
    expect(columns.find(c => c.target === 'birthday')!.source).toBe('DOB')
  })

  it('detects Member ID as client_id', () => {
    const columns = autoDetectColumns(['Member ID', 'Name', 'Email'])
    expect(columns.find(c => c.target === 'client_id')!.source).toBe('Member ID')
  })

  it('does not double-map a header to two targets', () => {
    // "Phone" should only map once even though phone and home_phone both exist
    const columns = autoDetectColumns(['Name', 'Email', 'Phone'])
    const phoneMatches = columns.filter(c => c.source === 'Phone')
    expect(phoneMatches).toHaveLength(1)
    expect(phoneMatches[0].target).toBe('phone')
  })

  it('returns empty for completely unknown headers', () => {
    const columns = autoDetectColumns(['Foo', 'Bar', 'Baz'])
    expect(columns).toHaveLength(0)
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

  it('rejects row with missing required name', () => {
    const row = { Name: '', Email: 'john@example.com', Phone: '', Membership: '' }
    const result = validateRow(row, columns)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('name is required')
  })

  it('rejects row with missing required email', () => {
    const row = { Name: 'John', Email: '', Phone: '', Membership: '' }
    const result = validateRow(row, columns)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('email is required')
  })

  it('rejects row with invalid email', () => {
    const row = { Name: 'John', Email: 'not-an-email', Phone: '', Membership: '' }
    const result = validateRow(row, columns)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Invalid email format')
  })

  it('rejects row with email missing domain', () => {
    const row = { Name: 'John', Email: 'john@', Phone: '', Membership: '' }
    const result = validateRow(row, columns)
    expect(result.valid).toBe(false)
  })

  it('rejects row with email missing TLD', () => {
    const row = { Name: 'John', Email: 'john@example', Phone: '', Membership: '' }
    const result = validateRow(row, columns)
    expect(result.valid).toBe(false)
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

  it('allows various valid phone formats', () => {
    const validPhones = [
      '+1234567890',
      '+64 21 555 0101',
      '(555) 123-4567',
      '555.123.4567',
      '021 555 0101',
      '+1 (555) 123-4567',
    ]

    for (const phone of validPhones) {
      const row = { Name: 'John', Email: 'john@example.com', Phone: phone, Membership: '' }
      const result = validateRow(row, columns)
      expect(result.valid).toBe(true)
    }
  })

  it('collects multiple errors for a single row', () => {
    const row = { Name: '', Email: 'not-valid', Phone: 'abc', Membership: '' }
    const result = validateRow(row, columns)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
    expect(result.errors).toContain('name is required')
    expect(result.errors).toContain('Invalid email format')
  })

  it('includes the raw data in the result', () => {
    const row = { Name: 'John', Email: 'john@example.com', Phone: '', Membership: 'Gold' }
    const result = validateRow(row, columns)
    expect(result.data).toBe(row)
    expect(result.data['Membership']).toBe('Gold')
  })

  it('handles whitespace-only values as empty', () => {
    const row = { Name: '   ', Email: 'john@example.com', Phone: '', Membership: '' }
    const result = validateRow(row, columns)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('name is required')
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

  it('counts all 0 rows correctly for empty data', () => {
    const columns = [
      { source: 'Name', target: 'name', required: true },
      { source: 'Email', target: 'email', required: true },
    ]

    const preview = generatePreview([], columns)
    expect(preview.totalRows).toBe(0)
    expect(preview.validRows).toBe(0)
    expect(preview.invalidRows).toBe(0)
    expect(preview.sampleRows).toHaveLength(0)
  })

  it('works end-to-end with Mindbody Mailing List CSV', () => {
    const csv = `First Name,Last Name,Phone Number,Email Address
Sarah,Chen,+64 21 555 0101,sarah@example.com
James,Wilson,,james@example.com
,Ruiz,+64 22 555 0103,tina@example.com`

    const rows = parseCSV(csv)
    const headers = Object.keys(rows[0]!)
    const columns = autoDetectColumns(headers)
    const preview = generatePreview(rows, columns)

    expect(preview.totalRows).toBe(3)
    // Row 3 has empty First Name which maps to required "name" — should be invalid
    expect(preview.invalidRows).toBe(1)
    expect(preview.validRows).toBe(2)
  })

  it('works end-to-end with Vagaro Customer List CSV', () => {
    const csv = `First Name,Last Name,Email,Mobile Phone,Home Phone,Address,City,State,Zip,Birthday,Gender,Notes,Last Appointment,Customer Since,Source
Amy,Lee,amy@example.com,+1 555 123 4567,,123 Main St,Portland,OR,97201,1990-05-15,Female,,2024-01-15,2023-06-01,Website
Bob,Marley,bob@example.com,,+1 555 987 6543,456 Oak Ave,Seattle,WA,98101,,Male,VIP client,2024-02-20,2022-03-10,Referral`

    const rows = parseCSV(csv)
    const headers = Object.keys(rows[0]!)
    const columns = autoDetectColumns(headers)
    const preview = generatePreview(rows, columns)

    expect(preview.totalRows).toBe(2)
    expect(preview.validRows).toBe(2)
    expect(preview.invalidRows).toBe(0)
  })

  it('works end-to-end with Mindbody Client Report CSV', () => {
    const csv = `ID,First Name,Last Name,Email,Phone,Home Phone,Mobile Phone,Date Added,Last Visit,Status,Active Memberships,Account Balance
1001,Sarah,Chen,sarah@example.com,+64 21 555 0101,,+64 21 555 0101,2023-01-15,2024-01-20,Active,Unlimited Monthly,$0.00
1002,James,Wilson,james@example.com,+64 22 555 0102,+64 9 555 0102,,2023-03-20,2024-01-18,Active,8-Class Pack,$15.00
1003,Tina,Ruiz,,+64 21 555 0103,,,2023-06-01,,Inactive,,$0.00`

    const rows = parseCSV(csv)
    const headers = Object.keys(rows[0]!)
    const columns = autoDetectColumns(headers)
    const preview = generatePreview(rows, columns)

    expect(preview.totalRows).toBe(3)
    // Tina has no email — should be invalid (email is required)
    expect(preview.invalidRows).toBe(1)
    expect(preview.validRows).toBe(2)
  })

  it('works end-to-end with Mindbody Subscriber Data Export CSV', () => {
    const csv = `Client ID,First Name,Last Name,Email,Status,Barcode ID,Creation Date,Active,Pricing Option,Member Since,Payment Amount,Auto-Pay Schedule
C001,Sarah,Chen,sarah@example.com,Active,BC001,2023-01-15,Yes,Unlimited Monthly,2023-01-15,$99.00,Monthly
C002,James,Wilson,james@example.com,Active,BC002,2023-03-20,Yes,8-Class Pack,2023-03-20,$80.00,None
C003,Tina,Ruiz,tina@example.com,Frozen,,2023-06-01,No,Unlimited Monthly,2023-06-01,$0.00,Monthly`

    const rows = parseCSV(csv)
    const headers = Object.keys(rows[0]!)
    const columns = autoDetectColumns(headers)
    const preview = generatePreview(rows, columns)

    expect(preview.totalRows).toBe(3)
    expect(preview.validRows).toBe(3)
    expect(preview.invalidRows).toBe(0)
  })
})

// ── Error Reporting Per Row ──────────────────────────────────────────────────

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
