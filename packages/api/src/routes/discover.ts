import { Hono } from 'hono'
import { createServiceClient } from '../lib/supabase'
import { notFound } from '../lib/errors'

// Haversine distance in km between two lat/lng points
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

// Batch-count active memberships for a set of studios
async function batchMemberCounts(supabase: ReturnType<typeof createServiceClient>, studioIds: string[]): Promise<Record<string, number>> {
  const { data } = await supabase.from('memberships').select('studio_id').in('studio_id', studioIds).eq('status', 'active')
  const map: Record<string, number> = {}
  for (const m of data ?? []) map[m.studio_id] = (map[m.studio_id] ?? 0) + 1
  return map
}

// Batch-count upcoming scheduled classes for a set of studios
async function batchClassCounts(supabase: ReturnType<typeof createServiceClient>, studioIds: string[]): Promise<Record<string, number>> {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase.from('class_instances').select('studio_id').in('studio_id', studioIds).eq('status', 'scheduled').gte('date', today)
  const map: Record<string, number> = {}
  for (const ci of data ?? []) map[ci.studio_id] = (map[ci.studio_id] ?? 0) + 1
  return map
}

const discover = new Hono()

// GET /filters — Available cities, disciplines, and locations for browse UI
discover.get('/filters', async (c) => {
  const supabase = createServiceClient()

  const { data: studios } = await supabase
    .from('studios')
    .select('discipline, country_code, region, city')

  const citySet = new Set<string>()
  const disciplineSet = new Set<string>()
  const locationMap = new Map<string, { regions: Set<string>; cities: Set<string> }>()

  for (const s of studios ?? []) {
    if (s.discipline) disciplineSet.add(s.discipline)
    if (s.city) citySet.add(s.city)

    if (s.country_code) {
      if (!locationMap.has(s.country_code)) {
        locationMap.set(s.country_code, { regions: new Set(), cities: new Set() })
      }
      const loc = locationMap.get(s.country_code)!
      if (s.region) loc.regions.add(s.region)
      if (s.city) loc.cities.add(s.city)
    }
  }

  const locations = Array.from(locationMap.entries())
    .map(([country_code, { regions, cities }]) => ({
      country_code,
      regions: Array.from(regions).sort(),
      cities: Array.from(cities).sort(),
    }))
    .sort((a, b) => a.country_code.localeCompare(b.country_code))

  return c.json({
    cities: Array.from(citySet).sort(),
    disciplines: Array.from(disciplineSet).sort(),
    locations,
  })
})

// GET /studios — Public studio directory listing
discover.get('/studios', async (c) => {
  const supabase = createServiceClient()

  const discipline = c.req.query('discipline')
  const city = c.req.query('city')
  const country = c.req.query('country')
  const region = c.req.query('region')
  const q = c.req.query('q')
  const lat = c.req.query('lat') ? parseFloat(c.req.query('lat')!) : undefined
  const lng = c.req.query('lng') ? parseFloat(c.req.query('lng')!) : undefined
  const radius = parseFloat(c.req.query('radius') ?? '50')
  const sort = c.req.query('sort')
  const page = parseInt(c.req.query('page') ?? '1', 10)
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 50)
  const offset = (page - 1) * limit

  let query = supabase
    .from('studios')
    .select('id, name, slug, discipline, description, logo_url, country_code, region, city, address, latitude, longitude', { count: 'exact' })

  if (discipline) {
    query = query.eq('discipline', discipline)
  }
  if (city) {
    query = query.ilike('city', `%${city}%`)
  }
  if (country) {
    query = query.eq('country_code', country)
  }
  if (region) {
    query = query.eq('region', region)
  }
  if (q) {
    query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%,discipline.ilike.%${q}%`)
  }

  // When doing near-me search, fetch all matching studios (no pagination at DB level)
  // so we can filter by radius and sort by distance in TypeScript
  const isNearMe = lat !== undefined && lng !== undefined
  if (!isNearMe) {
    query = query.range(offset, offset + limit - 1)
  }

  const { data: studios, count, error } = await query

  if (error) {
    console.error('discover studios error:', error)
    return c.json({ studios: [], total: 0, page, limit })
  }

  if (!studios || studios.length === 0) {
    return c.json({ studios: [], total: count ?? 0, page, limit })
  }

  // Batch-count active memberships and upcoming classes
  const studioIds = studios.map((s) => s.id)
  const [memberCountMap, classCountMap] = await Promise.all([
    batchMemberCounts(supabase, studioIds),
    batchClassCounts(supabase, studioIds),
  ])

  let result = studios.map((s) => {
    const distance_km = isNearMe && s.latitude != null && s.longitude != null
      ? Math.round(haversineDistance(lat!, lng!, s.latitude, s.longitude) * 10) / 10
      : undefined

    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      discipline: s.discipline,
      description: s.description,
      logo_url: s.logo_url,
      country_code: s.country_code ?? null,
      region: s.region ?? null,
      city: s.city ?? null,
      member_count: memberCountMap[s.id] ?? 0,
      upcoming_class_count: classCountMap[s.id] ?? 0,
      ...(distance_km !== undefined ? { distance_km } : {}),
    }
  })

  // Near-me: filter by radius and sort by distance
  if (isNearMe) {
    result = result.filter((s) => s.distance_km !== undefined && s.distance_km <= radius)

    if (sort === 'distance') {
      result.sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity))
    } else {
      // Default: sort by member_count descending
      result.sort((a, b) => b.member_count - a.member_count)
    }

    // Apply pagination in TypeScript for near-me queries
    const total = result.length
    result = result.slice(offset, offset + limit)
    return c.json({ studios: result, total, page, limit })
  }

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
      country_code: studio.country_code ?? null,
      region: studio.region ?? null,
      city: studio.city ?? null,
      address: studio.address ?? null,
      latitude: studio.latitude ?? null,
      longitude: studio.longitude ?? null,
      phone: (settings.phone as string) ?? null,
      website: (settings.website as string) ?? null,
      email: (settings.email as string) ?? null,
      instagram: (settings.instagram as string) ?? null,
      facebook: (settings.facebook as string) ?? null,
    },
    classes: classes ?? [],
    plans: plans ?? [],
    member_count: memberCount ?? 0,
  })
})

export default discover
