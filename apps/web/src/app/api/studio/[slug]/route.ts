import { NextResponse } from 'next/server'
import { eq, and, sql } from 'drizzle-orm'
import { getDb, studios, memberships } from '@/lib/db'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  try {
    const db = getDb()

    const [studio] = await db.select().from(studios).where(eq(studios.slug, slug))
    if (!studio) {
      return NextResponse.json({ error: 'Studio not found' }, { status: 404 })
    }

    const [{ count: memberCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(memberships)
      .where(and(eq(memberships.studioId, studio.id), eq(memberships.status, 'active')))

    return NextResponse.json({
      studio: { ...studio, memberCount },
    })
  } catch (err) {
    console.error('[/api/studio/[slug]] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
