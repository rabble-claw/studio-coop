import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { createServiceClient } from '../lib/supabase'
import { generateICalFeed, type ICalFeedEvent } from '../lib/calendar'
import { notFound, badRequest } from '../lib/errors'

const calendarFeed = new Hono()

// ─────────────────────────────────────────────────────────────────────────────
// Public feed: GET /api/cal/:token
// No auth — the token itself is the credential.
// ─────────────────────────────────────────────────────────────────────────────

calendarFeed.get('/cal/:token', async (c) => {
  const token = c.req.param('token')

  if (!token || !/^[0-9a-f]{64}$/.test(token)) {
    throw notFound('Calendar feed')
  }

  const supabase = createServiceClient()

  // Look up active token
  const { data: calToken, error: tokenError } = await supabase
    .from('calendar_tokens')
    .select('id, user_id, label')
    .eq('token', token)
    .is('revoked_at', null)
    .maybeSingle()

  if (tokenError) throw new Error(tokenError.message)
  if (!calToken) throw notFound('Calendar feed')

  // Update last_used_at (fire-and-forget, don't block response)
  supabase
    .from('calendar_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', calToken.id)
    .then(() => {})

  // Fetch user's upcoming bookings (7 days ago to capture recent)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const cutoff = sevenDaysAgo.toISOString().split('T')[0]

  const { data: bookings, error: bookingError } = await supabase
    .from('bookings')
    .select(`
      id, status,
      class_instance:class_instances(
        id, date, start_time,
        template:class_templates(name, duration_min, description),
        teacher:users!class_instances_teacher_id_fkey(name),
        studio:studios(id, name, slug, timezone, email)
      )
    `)
    .eq('user_id', calToken.user_id)
    .in('status', ['booked', 'confirmed'])
    .gte('created_at', cutoff)

  if (bookingError) throw new Error(bookingError.message)

  // Build iCal events
  const events: ICalFeedEvent[] = []
  for (const b of bookings ?? []) {
    const ci = Array.isArray(b.class_instance) ? b.class_instance[0] : b.class_instance
    if (!ci) continue

    const template = Array.isArray(ci.template) ? ci.template[0] : ci.template
    const teacher = Array.isArray(ci.teacher) ? ci.teacher[0] : ci.teacher
    const studio = Array.isArray(ci.studio) ? ci.studio[0] : ci.studio

    if (!template || !studio || ci.date < cutoff) continue

    const evt: ICalFeedEvent = {
      bookingId: b.id,
      summary: template.name ?? 'Class',
      date: ci.date,
      startTime: ci.start_time,
      durationMinutes: template.duration_min ?? 60,
      timezone: studio.timezone ?? 'Pacific/Auckland',
    }
    if (studio.name) evt.location = studio.name
    if (teacher?.name) evt.description = `Class with ${teacher.name}`
    else if (template.description) evt.description = template.description
    if (studio.name) evt.organizerName = studio.name
    if (studio.email) evt.organizerEmail = studio.email
    events.push(evt)
  }

  const ics = generateICalFeed({
    calendarName: calToken.label ?? 'Studio Co-op Classes',
    events,
  })

  c.header('Content-Type', 'text/calendar; charset=utf-8')
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate')
  c.header('Content-Disposition', 'inline; filename="classes.ics"')
  return c.body(ics)
})

// ─────────────────────────────────────────────────────────────────────────────
// Token management (JWT required)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/my/calendar-token — Generate new token
calendarFeed.post('/my/calendar-token', authMiddleware, async (c) => {
  const user = c.get('user' as never) as { id: string }
  const supabase = createServiceClient()
  const body = await c.req.json().catch(() => ({}))
  const label = (body as { label?: string }).label || 'My Calendar'

  // Check token count (max 5 active)
  const { count, error: countError } = await supabase
    .from('calendar_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('revoked_at', null)

  if (countError) throw new Error(countError.message)
  if ((count ?? 0) >= 5) {
    throw badRequest('Maximum of 5 active calendar tokens allowed. Revoke an existing token first.')
  }

  // Generate 32 random bytes → 64 hex chars
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const token = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')

  const { data: newToken, error: insertError } = await supabase
    .from('calendar_tokens')
    .insert({ user_id: user.id, token, label })
    .select('id, label, created_at')
    .single()

  if (insertError) throw new Error(insertError.message)

  // Build the feed URL
  const baseUrl = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'https://api.studio.coop'
  const feedUrl = `${baseUrl}/api/cal/${token}`

  return c.json({
    id: newToken.id,
    label: newToken.label,
    feedUrl,
    createdAt: newToken.created_at,
  }, 201)
})

// GET /api/my/calendar-token — List active tokens
calendarFeed.get('/my/calendar-token', authMiddleware, async (c) => {
  const user = c.get('user' as never) as { id: string }
  const supabase = createServiceClient()

  const { data: tokens, error } = await supabase
    .from('calendar_tokens')
    .select('id, label, created_at, last_used_at')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return c.json({ tokens: tokens ?? [] })
})

// DELETE /api/my/calendar-token/:tokenId — Revoke token
calendarFeed.delete('/my/calendar-token/:tokenId', authMiddleware, async (c) => {
  const user = c.get('user' as never) as { id: string }
  const tokenId = c.req.param('tokenId')
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('calendar_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId)
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw notFound('Calendar token')

  return c.json({ ok: true })
})

export default calendarFeed
