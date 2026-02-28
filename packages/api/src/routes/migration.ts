// Mindbody migration tool — CSV import for studios
//
// Mounted at /api/studios in index.ts so paths here are:
//   POST /:studioId/migrate/upload     — upload CSV, return auto-detected preview
//   POST /:studioId/migrate/preview    — preview with custom column mapping
//   POST /:studioId/migrate/execute    — execute import
//   GET  /:studioId/migrate/status     — get import status

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireAdmin } from '../middleware/studio-access'
import { createServiceClient } from '../lib/supabase'
import { badRequest } from '../lib/errors'
import {
  parseCSV,
  autoDetectColumns,
  generatePreview,
  type MigrationColumn,
} from '../lib/migration'

const migration = new Hono()

// ─────────────────────────────────────────────────────────────────────────────
// POST /:studioId/migrate/upload — upload CSV, return auto-detected preview
// ─────────────────────────────────────────────────────────────────────────────

migration.post('/:studioId/migrate/upload', authMiddleware, requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const csv = body.csv as string | undefined

  if (!csv?.trim()) {
    throw badRequest('CSV content is required')
  }

  const rows = parseCSV(csv)
  if (rows.length === 0) {
    throw badRequest('CSV must contain at least one data row')
  }

  const headers = Object.keys(rows[0])
  const columns = autoDetectColumns(headers)
  const preview = generatePreview(rows, columns)

  return c.json({ preview })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /:studioId/migrate/preview — preview with custom column mapping
// ─────────────────────────────────────────────────────────────────────────────

migration.post('/:studioId/migrate/preview', authMiddleware, requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const csv = body.csv as string | undefined
  const columns = body.columns as MigrationColumn[] | undefined

  if (!csv?.trim()) {
    throw badRequest('CSV content is required')
  }

  if (!columns || !Array.isArray(columns)) {
    throw badRequest('columns array is required')
  }

  const rows = parseCSV(csv)
  if (rows.length === 0) {
    throw badRequest('CSV must contain at least one data row')
  }

  const preview = generatePreview(rows, columns)
  return c.json({ preview })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /:studioId/migrate/execute — execute import
// ─────────────────────────────────────────────────────────────────────────────

migration.post('/:studioId/migrate/execute', authMiddleware, requireAdmin, async (c) => {
  const studioId = c.get('studioId' as never) as string
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const csv = body.csv as string | undefined
  const columns = body.columns as MigrationColumn[] | undefined

  if (!csv?.trim()) {
    throw badRequest('CSV content is required')
  }

  if (!columns || !Array.isArray(columns)) {
    throw badRequest('columns array is required')
  }

  const rows = parseCSV(csv)
  const emailCol = columns.find((col) => col.target === 'email')
  const nameCol = columns.find((col) => col.target === 'name')
  const lastNameCol = columns.find((col) => col.target === 'last_name')
  const phoneCol = columns.find((col) => col.target === 'phone')
  const membershipCol = columns.find((col) => col.target === 'membership_type')

  if (!emailCol) {
    throw badRequest('Email column mapping is required')
  }

  let created = 0
  let skipped = 0
  let failed = 0
  const errors: { row: number; email: string; error: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const email = (row[emailCol.source] ?? '').trim().toLowerCase()

    if (!email) {
      failed++
      errors.push({ row: i + 1, email: '', error: 'Missing email' })
      continue
    }

    let name = nameCol ? (row[nameCol.source] ?? '').trim() : ''
    if (lastNameCol) {
      const lastName = (row[lastNameCol.source] ?? '').trim()
      if (lastName) name = name ? `${name} ${lastName}` : lastName
    }

    try {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      let userId: string

      if (existingUser) {
        userId = existingUser.id
      } else {
        // Create user record
        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert({
            email,
            name: name || email.split('@')[0],
            phone: phoneCol ? (row[phoneCol.source] ?? '').trim() || null : null,
          })
          .select('id')
          .single()

        if (userError || !newUser) {
          failed++
          errors.push({ row: i + 1, email, error: 'Failed to create user' })
          continue
        }
        userId = newUser.id
      }

      // Check if already a member of this studio
      const { data: existingMembership } = await supabase
        .from('memberships')
        .select('id')
        .eq('user_id', userId)
        .eq('studio_id', studioId)
        .maybeSingle()

      if (existingMembership) {
        skipped++
        continue
      }

      // Create membership
      await supabase
        .from('memberships')
        .insert({
          user_id: userId,
          studio_id: studioId,
          role: 'member',
          status: 'active',
          joined_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      created++
    } catch (err) {
      failed++
      errors.push({ row: i + 1, email, error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  return c.json({
    result: {
      totalProcessed: rows.length,
      created,
      skipped,
      failed,
      errors: errors.slice(0, 50), // Limit error reporting
    },
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/migrate/status — get import status
// ─────────────────────────────────────────────────────────────────────────────

migration.get('/:studioId/migrate/status', authMiddleware, requireAdmin, async (c) => {
  // For now, migrations are synchronous. This endpoint returns a static status.
  // In the future, long-running migrations could be tracked in a jobs table.
  return c.json({
    status: 'idle',
    lastImport: null,
  })
})

export default migration
