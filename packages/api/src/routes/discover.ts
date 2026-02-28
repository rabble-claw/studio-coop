import { Hono } from 'hono'
import { createServiceClient } from '../lib/supabase'
import { notFound } from '../lib/errors'

const discover = new Hono()

// GET /filters — Available cities and disciplines for browse UI
discover.get('/filters', async (c) => {
  const supabase = createServiceClient()

  const { data: studios } = await supabase
    .from('studios')
    .select('discipline, settings')

  const citySet = new Set<string>()
  const disciplineSet = new Set<string>()

  for (const s of studios ?? []) {
    if (s.discipline) disciplineSet.add(s.discipline)
    const settings = (s.settings ?? {}) as Record<string, unknown>
    const city = settings.city as string | undefined
    if (city) citySet.add(city)
  }

  return c.json({
    cities: Array.from(citySet).sort(),
    disciplines: Array.from(disciplineSet).sort(),
  })
})

// GET /studios — Public studio directory listing
discover.get('/studios', async (c) => {
  const supabase = createServiceClient()

  const discipline = c.req.query('discipline')
  const city = c.req.query('city')
  const q = c.req.query('q')
  const page = parseInt(c.req.query('page') ?? '1', 10)
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 50)
  const offset = (page - 1) * limit

  let query = supabase
    .from('studios')
    .select('id, name, slug, discipline, description, logo_url, settings', { count: 'exact' })

  if (discipline) {
    query = query.eq('discipline', discipline)
  }
  if (city) {
    query = query.ilike('settings->>city', `%${city}%`)
  }
  if (q) {
    query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%,discipline.ilike.%${q}%`)
  }

  query = query.range(offset, offset + limit - 1)

  const { data: studios, count, error } = await query

  if (error) {
    console.error('discover studios error:', error)
    return c.json({ studios: [], total: 0, page, limit })
  }

  if (!studios || studios.length === 0) {
    return c.json({ studios: [], total: count ?? 0, page, limit })
  }

  // Batch-count active memberships for these studios
  const studioIds = studios.map((s) => s.id)

  const { data: memberCounts } = await supabase
    .from('memberships')
    .select('studio_id')
    .in('studio_id', studioIds)
    .eq('status', 'active')

  const memberCountMap: Record<string, number> = {}
  for (const m of memberCounts ?? []) {
    memberCountMap[m.studio_id] = (memberCountMap[m.studio_id] ?? 0) + 1
  }

  // Batch-count upcoming classes
  const today = new Date().toISOString().split('T')[0]
  const { data: classCounts } = await supabase
    .from('class_instances')
    .select('studio_id')
    .in('studio_id', studioIds)
    .eq('status', 'scheduled')
    .gte('date', today)

  const classCountMap: Record<string, number> = {}
  for (const ci of classCounts ?? []) {
    classCountMap[ci.studio_id] = (classCountMap[ci.studio_id] ?? 0) + 1
  }

  const result = studios.map((s) => {
    const settings = (s.settings ?? {}) as Record<string, unknown>
    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      discipline: s.discipline,
      description: s.description,
      logo_url: s.logo_url,
      city: (settings.city as string) ?? null,
      member_count: memberCountMap[s.id] ?? 0,
      upcoming_class_count: classCountMap[s.id] ?? 0,
    }
  })

  // Sort by member_count descending for social proof
  result.sort((a, b) => b.member_count - a.member_count)

  return c.json({ studios: result, total: count ?? 0, page, limit })
})

// GET /studios/:slug — Full public studio profile
discover.get('/studios/:slug', async (c) => {
  const slug = c.req.param('slug')
  const supabase = createServiceClient()

  const { data: studio } = await supabase
    .from('studios')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!studio) throw notFound('studio')

  // Upcoming classes (next 20)
  const today = new Date().toISOString().split('T')[0]
  const { data: classes } = await supabase
    .from('class_instances')
    .select('id, date, start_time, end_time, max_capacity, booked_count, status, teacher:users!class_instances_teacher_id_fkey(name), template:class_templates!class_instances_template_id_fkey(name, description)')
    .eq('studio_id', studio.id)
    .eq('status', 'scheduled')
    .gte('date', today)
    .order('date')
    .order('start_time')
    .limit(20)

  // Active membership plans
  const { data: plans } = await supabase
    .from('membership_plans')
    .select('id, name, description, type, price_cents, currency, interval, class_limit, validity_days, active, sort_order')
    .eq('studio_id', studio.id)
    .eq('active', true)
    .order('sort_order')

  // Member count
  const { count: memberCount } = await supabase
    .from('memberships')
    .select('*', { count: 'exact', head: true })
    .eq('studio_id', studio.id)
    .eq('status', 'active')

  const settings = (studio.settings ?? {}) as Record<string, unknown>

  return c.json({
    studio: {
      id: studio.id,
      name: studio.name,
      slug: studio.slug,
      discipline: studio.discipline,
      description: studio.description,
      logo_url: studio.logo_url,
      address: (settings.address as string) ?? null,
      phone: (settings.phone as string) ?? null,
      website: (settings.website as string) ?? null,
      email: (settings.email as string) ?? null,
      instagram: (settings.instagram as string) ?? null,
      facebook: (settings.facebook as string) ?? null,
      city: (settings.city as string) ?? null,
    },
    classes: classes ?? [],
    plans: plans ?? [],
    member_count: memberCount ?? 0,
  })
})

export default discover
