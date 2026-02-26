import { NextResponse } from 'next/server'
import { eq, and, sql } from 'drizzle-orm'
import { getDb, studios, memberships } from '@/lib/db'
import { demoStudio, demoMembers } from '@/lib/demo-data'

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
    console.error('[/api/studio/[slug]] DB error:', err)
    // Fallback to demo data if slug matches
    if (slug === demoStudio.slug) {
      return NextResponse.json({
        studio: { ...demoStudio, memberCount: demoMembers.length },
        demo: true,
      })
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
