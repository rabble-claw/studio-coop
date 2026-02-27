import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDb, studios, memberships } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

const ALLOWED_DISCIPLINES = [
  'pole', 'bjj', 'yoga', 'crossfit', 'cycling', 'pilates', 'dance', 'aerial', 'general',
  'boxing', 'barre', 'fitness', 'wellness', 'martial_arts', 'other',
]

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const { name, slug, discipline, description, city, country, timezone } = body

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Studio name is required' }, { status: 400 })
  }

  if (!slug || typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
    return NextResponse.json({ error: 'Slug must be lowercase alphanumeric with hyphens' }, { status: 400 })
  }

  if (!discipline || !ALLOWED_DISCIPLINES.includes(discipline)) {
    return NextResponse.json({ error: 'Invalid discipline' }, { status: 400 })
  }

  const db = getDb()

  const [existing] = await db.select({ id: studios.id }).from(studios).where(eq(studios.slug, slug))
  if (existing) {
    return NextResponse.json({ error: 'This URL slug is already taken' }, { status: 409 })
  }

  const studioId = randomUUID()
  const membershipId = randomUUID()

  const pool = (await import('@/lib/db')).getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO studios (id, name, slug, discipline, description, timezone, tier, settings)
       VALUES ($1, $2, $3, $4, $5, $6, 'free', $7)`,
      [
        studioId,
        name.trim(),
        slug,
        discipline,
        description || null,
        timezone || 'UTC',
        JSON.stringify({
          city: city || null,
          country: country || null,
        }),
      ]
    )
    await client.query(
      `INSERT INTO memberships (id, user_id, studio_id, role, status)
       VALUES ($1, $2, $3, 'owner', 'active')`,
      [membershipId, session.id, studioId]
    )
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  return NextResponse.json({
    id: studioId,
    name: name.trim(),
    slug,
    discipline,
  })
}
