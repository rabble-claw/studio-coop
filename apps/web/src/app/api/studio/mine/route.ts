import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getPool } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const pool = getPool()

  const { rows: membershipRows } = await pool.query(
    `SELECT s.id, s.name, s.slug, s.discipline, s.description, s.tier
     FROM memberships m
     JOIN studios s ON s.id = m.studio_id
     WHERE m.user_id = $1 AND m.status = 'active'
     LIMIT 1`,
    [session.id]
  )

  if (membershipRows.length === 0) {
    return NextResponse.json({ studio: null })
  }

  const s = membershipRows[0]
  const studioId = s.id
  const todayStr = new Date().toISOString().split('T')[0]

  const [memberResult, classResult, todayResult, feedResult] = await Promise.all([
    pool.query(
      `SELECT count(*)::int as count FROM memberships WHERE studio_id = $1 AND status = 'active'`,
      [studioId]
    ),
    pool.query(
      `SELECT count(*)::int as count FROM class_instances WHERE studio_id = $1 AND status = 'scheduled'`,
      [studioId]
    ),
    pool.query(
      `SELECT ci.id, ci.date::text, ci.start_time::text, ci.end_time::text, ci.max_capacity,
              COALESCE(ct.name, 'Class') as template_name,
              COALESCE(u.name, 'TBA') as teacher_name,
              (SELECT count(*)::int FROM bookings b WHERE b.class_instance_id = ci.id AND b.status IN ('booked', 'confirmed')) as booked_count
       FROM class_instances ci
       LEFT JOIN class_templates ct ON ct.id = ci.template_id
       LEFT JOIN users u ON u.id = ci.teacher_id
       WHERE ci.studio_id = $1 AND ci.date = $2 AND ci.status = 'scheduled'
       ORDER BY ci.start_time`,
      [studioId, todayStr]
    ),
    pool.query(
      `SELECT fp.id, fp.content, u.name as author,
              ct.name as class_name,
              (SELECT count(*)::int FROM feed_reactions fr WHERE fr.post_id = fp.id) as likes
       FROM feed_posts fp
       JOIN users u ON u.id = fp.user_id
       LEFT JOIN class_instances ci ON ci.id = fp.class_instance_id
       LEFT JOIN class_templates ct ON ct.id = ci.template_id
       WHERE ci.studio_id = $1
       ORDER BY fp.created_at DESC
       LIMIT 4`,
      [studioId]
    ),
  ])

  return NextResponse.json({
    studio: {
      id: studioId,
      name: s.name,
      slug: s.slug,
      discipline: s.discipline,
      description: s.description,
      tier: s.tier,
      memberCount: memberResult.rows[0].count,
      upcomingClasses: classResult.rows[0].count,
    },
    todayClasses: todayResult.rows,
    feedPosts: feedResult.rows,
  })
}
