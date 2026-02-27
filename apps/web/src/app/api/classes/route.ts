import { NextResponse } from 'next/server'
import { eq, and, gte, inArray, sql } from 'drizzle-orm'
import { getDb, studios, users, memberships, classInstances, classTemplates, bookings } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = getDb()
    const todayStr = new Date().toISOString().split('T')[0]

    const [membership] = await db
      .select({ studioId: memberships.studioId, role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.userId, session.id), eq(memberships.status, 'active')))

    if (!membership) {
      return NextResponse.json({ studio: null, classes: [] })
    }

    const [studioRows, memberCountRows, upcomingCountRows, classRows] = await Promise.all([
      db.select().from(studios).where(eq(studios.id, membership.studioId)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(memberships)
        .where(and(eq(memberships.studioId, membership.studioId), eq(memberships.status, 'active'))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(classInstances)
        .where(and(eq(classInstances.studioId, membership.studioId), gte(classInstances.date, todayStr))),
      db
        .select({
          id: classInstances.id,
          date: classInstances.date,
          startTime: classInstances.startTime,
          endTime: classInstances.endTime,
          status: classInstances.status,
          maxCapacity: classInstances.maxCapacity,
          templateName: classTemplates.name,
          teacherName: users.name,
        })
        .from(classInstances)
        .leftJoin(classTemplates, eq(classInstances.templateId, classTemplates.id))
        .leftJoin(users, eq(classInstances.teacherId, users.id))
        .where(and(eq(classInstances.studioId, membership.studioId), gte(classInstances.date, todayStr)))
        .orderBy(classInstances.date, classInstances.startTime),
    ])

    const studio = studioRows[0]
    if (!studio) return NextResponse.json({ studio: null, classes: [] })

    const classIds = classRows.map((c) => c.id)
    let bookingCounts: Record<string, number> = {}
    if (classIds.length > 0) {
      const counts = await db
        .select({
          classInstanceId: bookings.classInstanceId,
          count: sql<number>`count(*)::int`,
        })
        .from(bookings)
        .where(
          and(
            inArray(bookings.classInstanceId, classIds),
            inArray(bookings.status, ['booked', 'confirmed'])
          )
        )
        .groupBy(bookings.classInstanceId)
      bookingCounts = Object.fromEntries(counts.map((c) => [c.classInstanceId, c.count]))
    }

    const classes = classRows.map((c) => ({
      ...c,
      bookedCount: bookingCounts[c.id] ?? 0,
    }))

    return NextResponse.json({
      studio: {
        id: studio.id,
        name: studio.name,
        slug: studio.slug,
        discipline: studio.discipline,
        description: studio.description,
        tier: studio.tier,
        memberCount: memberCountRows[0]?.count ?? 0,
        upcomingClasses: upcomingCountRows[0]?.count ?? 0,
      },
      classes,
    })
  } catch (err) {
    console.error('[/api/classes] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
