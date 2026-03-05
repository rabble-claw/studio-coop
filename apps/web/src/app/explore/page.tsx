import type { Metadata } from 'next'
import Link from 'next/link'
import { StudioSearch } from '@/components/studio-search'

export const metadata: Metadata = {
  title: 'Find Your Studio | Studio Co-op',
  description: 'Browse indie fitness and movement studios near you. Pole, aerial, yoga, dance, BJJ and more — find your community on Studio Co-op.',
  openGraph: {
    title: 'Find Your Studio | Studio Co-op',
    description: 'Browse indie fitness and movement studios near you. Find your community on Studio Co-op.',
  },
}

type StudioRow = {
  id: string
  name: string
  slug: string
  discipline: string
  description: string | null
  logo_url: string | null
  settings: Record<string, unknown> | null
  country_code: string | null
  region: string | null
  city: string | null
  latitude: number | null
  longitude: number | null
}

type ExploreStudioCard = {
  id: string
  name: string
  slug: string
  discipline: string
  description: string | null
  logo_url: string | null
  settings: Record<string, unknown> | null
  city: string | null
  country_code: string | null
  region: string | null
  member_count: number
  upcoming_class_count: number
}

function isLikelyPlaceholderStudio(studio: Pick<StudioRow, 'name' | 'slug' | 'description'>) {
  const name = studio.name.trim().toLowerCase()
  const slug = studio.slug.trim().toLowerCase()
  const description = (studio.description ?? '').trim().toLowerCase()

  const genericNamePattern = /\b(test|done|skip|sample|temp|dummy)\b/
  const longNumericSuffixPattern = /\b\d{8,}\b/
  const genericSlugPattern = /\b(test|seed|demo|tmp|temp)\b/

  if (genericNamePattern.test(name)) return true
  if (longNumericSuffixPattern.test(studio.name)) return true
  if (genericSlugPattern.test(slug) && !description) return true
  if (description.includes('test studio')) return true

  return false
}

const DISCIPLINE_META: Record<string, { emoji: string; color: string; bg: string }> = {
  pole:    { emoji: '\u{1FA70}', color: '#7c3aed', bg: '#f3e8ff' },
  aerial:  { emoji: '\u{1F3AA}', color: '#2563eb', bg: '#dbeafe' },
  yoga:    { emoji: '\u{1F9D8}', color: '#059669', bg: '#d1fae5' },
  dance:   { emoji: '\u{1F483}', color: '#db2777', bg: '#fce7f3' },
  bjj:     { emoji: '\u{1F94B}', color: '#ea580c', bg: '#ffedd5' },
  pilates: { emoji: '\u{1F9D8}\u200D\u2640\uFE0F', color: '#0891b2', bg: '#cffafe' },
  fitness: { emoji: '\u{1F3CB}\uFE0F', color: '#4f46e5', bg: '#e0e7ff' },
}

function getDisciplineMeta(discipline: string) {
  return DISCIPLINE_META[discipline.toLowerCase()] ?? { emoji: '\u{2B50}', color: '#7c3aed', bg: '#f3e8ff' }
}

function firstNonEmptyString(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value
  }
  return null
}

function isEmpireStudio(studio: Pick<StudioRow, 'name' | 'slug'>) {
  const name = studio.name.toLowerCase()
  const slug = studio.slug.toLowerCase()
  return name.includes('empire aerial arts') || slug.includes('empire')
}

function getStudioPhotoUrl(studio: Pick<StudioRow, 'name' | 'slug' | 'settings'>) {
  const settings = (studio.settings ?? {}) as Record<string, unknown>
  const configuredPhoto = firstNonEmptyString(
    settings.cover_image_url,
    settings.hero_image_url,
    settings.photo_url,
    settings.image_url,
    settings.banner_url,
    settings.studio_photo_url
  )
  if (configuredPhoto) return configuredPhoto
  if (isEmpireStudio(studio)) return '/empire/hero.jpg'
  return '/assets/studio-photo.png'
}

function getStudioLogoUrl(studio: Pick<StudioRow, 'name' | 'slug' | 'logo_url' | 'settings'>) {
  const settings = (studio.settings ?? {}) as Record<string, unknown>
  const configuredLogo = firstNonEmptyString(studio.logo_url, settings.logo_url)
  if (configuredLogo) return configuredLogo
  if (isEmpireStudio(studio)) return '/empire/logo.jpg'
  return null
}

function getFallbackStudios(searchParams: { q?: string; discipline?: string; city?: string; country?: string; region?: string }): ExploreStudioCard[] {
  const featured: ExploreStudioCard = {
    id: 'featured-empire-aerial-arts',
    name: 'Empire Aerial Arts',
    slug: 'empire-aerial-arts',
    discipline: 'Aerial',
    description: "Wellington's home for pole, aerial, and circus arts. Cuba Street vibes, all levels welcome.",
    logo_url: '/empire/logo.jpg',
    settings: { hero_image_url: '/empire/hero.jpg' },
    city: 'Wellington',
    country_code: 'NZ',
    region: 'Wellington',
    member_count: 0,
    upcoming_class_count: 10,
  }

  const q = (searchParams.q ?? '').trim().toLowerCase()
  const discipline = (searchParams.discipline ?? '').trim().toLowerCase()
  const city = (searchParams.city ?? '').trim().toLowerCase()
  const country = (searchParams.country ?? '').trim().toUpperCase()
  const region = (searchParams.region ?? '').trim().toLowerCase()

  if (discipline && featured.discipline.toLowerCase() !== discipline) return []
  if (city && !featured.city?.toLowerCase().includes(city)) return []
  if (country && featured.country_code !== country) return []
  if (region && featured.region?.toLowerCase() !== region) return []
  if (q) {
    const haystack = `${featured.name} ${featured.description ?? ''} ${featured.discipline}`.toLowerCase()
    if (!haystack.includes(q)) return []
  }

  return [featured]
}

async function getStudios(searchParams: { q?: string; discipline?: string; city?: string; country?: string; region?: string }) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    let query = supabase
      .from('studios')
      .select('id, name, slug, discipline, description, logo_url, settings, country_code, region, city, address, latitude, longitude')

    if (searchParams.discipline) {
      query = query.eq('discipline', searchParams.discipline)
    }
    if (searchParams.city) {
      query = query.ilike('city', `%${searchParams.city}%`)
    }
    if (searchParams.country) {
      query = query.eq('country_code', searchParams.country)
    }
    if (searchParams.region) {
      query = query.eq('region', searchParams.region)
    }
    if (searchParams.q) {
      query = query.or(
        `name.ilike.%${searchParams.q}%,description.ilike.%${searchParams.q}%,discipline.ilike.%${searchParams.q}%`
      )
    }

    const { data: studios } = await query

    if (!studios || studios.length === 0) return getFallbackStudios(searchParams)

    const publicStudios = studios.filter((s) =>
      !isLikelyPlaceholderStudio({
        name: s.name,
        slug: s.slug,
        description: s.description,
      })
    )

    if (publicStudios.length === 0) return getFallbackStudios(searchParams)

    const studioIds = publicStudios.map((s) => s.id)

    const { data: memberships } = await supabase
      .from('memberships')
      .select('studio_id')
      .in('studio_id', studioIds)
      .eq('status', 'active')

    const memberCountMap: Record<string, number> = {}
    for (const m of memberships ?? []) {
      memberCountMap[m.studio_id] = (memberCountMap[m.studio_id] ?? 0) + 1
    }

    const today = new Date().toISOString().split('T')[0]
    const { data: classInstances } = await supabase
      .from('class_instances')
      .select('studio_id')
      .in('studio_id', studioIds)
      .eq('status', 'scheduled')
      .gte('date', today)

    const classCountMap: Record<string, number> = {}
    for (const ci of classInstances ?? []) {
      classCountMap[ci.studio_id] = (classCountMap[ci.studio_id] ?? 0) + 1
    }

    return publicStudios
      .map((s: StudioRow): ExploreStudioCard => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        discipline: s.discipline,
        description: s.description,
        logo_url: s.logo_url,
        settings: s.settings,
        city: s.city ?? null,
        country_code: s.country_code ?? null,
        region: s.region ?? null,
        member_count: memberCountMap[s.id] ?? 0,
        upcoming_class_count: classCountMap[s.id] ?? 0,
      }))
      .sort((a, b) => b.member_count - a.member_count)
  } catch {
    console.error('Failed to fetch studios — Supabase may be unavailable')
    return getFallbackStudios(searchParams)
  }
}

type LocationGroup = {
  country_code: string
  regions: string[]
  cities: string[]
}

async function getLocations(): Promise<LocationGroup[]> {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: studios } = await supabase
      .from('studios')
      .select('name, slug, description, country_code, region, city')

    const countryMap = new Map<string, { regions: Set<string>; cities: Set<string> }>()

    for (const s of studios ?? []) {
      const name = (s as Record<string, unknown>).name as string | null
      const slug = (s as Record<string, unknown>).slug as string | null
      const description = (s as Record<string, unknown>).description as string | null
      if (!name || !slug) continue
      if (isLikelyPlaceholderStudio({ name, slug, description })) continue

      const cc = (s as Record<string, unknown>).country_code as string | null
      if (!cc) continue
      if (!countryMap.has(cc)) {
        countryMap.set(cc, { regions: new Set(), cities: new Set() })
      }
      const entry = countryMap.get(cc)!
      const region = (s as Record<string, unknown>).region as string | null
      const city = (s as Record<string, unknown>).city as string | null
      if (region) entry.regions.add(region)
      if (city) entry.cities.add(city)
    }

    return Array.from(countryMap.entries())
      .map(([country_code, { regions, cities }]) => ({
        country_code,
        regions: Array.from(regions).sort(),
        cities: Array.from(cities).sort(),
      }))
      .sort((a, b) => a.country_code.localeCompare(b.country_code))
  } catch {
    console.error('Failed to fetch locations — Supabase may be unavailable')
    return []
  }
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; discipline?: string; city?: string; country?: string; region?: string }>
}) {
  const params = await searchParams
  const [studios, locations] = await Promise.all([getStudios(params), getLocations()])
  const fallbackStudios = getFallbackStudios(params)
  const displayStudios = studios.length > 0 ? studios : fallbackStudios

  return (
    <div className="marketing-page relative isolate min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-[-9rem] h-[24rem] marketing-glow opacity-80" />
      <div className="pointer-events-none absolute right-[-9rem] top-28 h-72 w-72 rounded-full bg-[#2E7D6D]/15 blur-3xl" />

      <header className="sticky top-0 z-20 border-b border-white/50 bg-background/90 backdrop-blur">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-white">SC</span>
            </div>
            <span className="marketing-display text-lg font-semibold tracking-tight">Studio Co-op</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex">
              Home
            </Link>
            <Link href="/login" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Log in
            </Link>
          </div>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-8 pt-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center rounded-full border border-primary/20 bg-card/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Discover independent studios
          </p>
          <h1 className="marketing-display mt-5 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Find Your Studio
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Browse indie fitness and movement studios. Find your community.
          </p>
        </div>

        <div className="marketing-reveal mt-10 rounded-[1.75rem] border border-white/70 bg-card/75 p-5 shadow-[0_20px_60px_-40px_rgba(16,24,40,0.45)] sm:p-7">
          <StudioSearch
            currentSearch={params.q ?? ''}
            currentDiscipline={params.discipline ?? ''}
            currentCity={params.city ?? ''}
            currentCountry={params.country ?? ''}
            currentRegion={params.region ?? ''}
            locations={locations}
          />
        </div>
      </section>

      {displayStudios.length > 0 && (
        <div className="mx-auto max-w-6xl px-6 pb-5">
          <div className="rounded-full border border-border/70 bg-card/80 px-4 py-2 text-sm text-muted-foreground">
            {displayStudios.length} studio{displayStudios.length !== 1 ? 's' : ''}
            {params.discipline ? ` \u00B7 ${params.discipline}` : ''}
            {params.country ? ` \u00B7 ${params.country}` : ''}
            {params.region ? ` \u00B7 ${params.region}` : ''}
            {params.city ? ` \u00B7 ${params.city}` : ''}
          </div>
        </div>
      )}

      {displayStudios.length === 1 && !params.q && !params.discipline && !params.city && !params.country && !params.region && (
        <div className="mx-auto max-w-6xl px-6 pb-5">
          <div className="rounded-2xl border border-border/70 bg-card/80 px-4 py-3 text-sm text-muted-foreground">
            We&apos;re onboarding more studios now. For the moment, this is our featured partner studio.
          </div>
        </div>
      )}

      <section className="mx-auto max-w-6xl px-6 pb-24">
        {displayStudios.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/80 bg-card/65 px-6 py-20 text-center">
            <div className="text-4xl">{'\u{1F3AA}'}</div>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              {params.q || params.discipline || params.city || params.country || params.region
                ? 'No studios found matching your search.'
                : 'No studios available yet. Check back soon!'}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {displayStudios.map((studio) => {
              const meta = getDisciplineMeta(studio.discipline)
              const photoUrl = getStudioPhotoUrl(studio)
              const logoUrl = getStudioLogoUrl(studio)
              const initials = studio.name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((word) => word[0]?.toUpperCase() ?? '')
                .join('')

              return (
                <Link
                  key={studio.id}
                  href={`/${studio.slug}`}
                  className="group relative overflow-hidden rounded-2xl border border-white/70 bg-card/85 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
                >
                  <div className="h-1.5" style={{ backgroundColor: meta.color }} />
                  <div className="relative overflow-hidden border-b border-border/60">
                    <img
                      src={photoUrl}
                      alt={`${studio.name} studio`}
                      className="aspect-[16/9] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-black/0 to-transparent" />
                  </div>
                  <div className="p-5">
                    <div className="mb-3 flex items-center gap-3">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={studio.name}
                          className="h-12 w-12 rounded-xl object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-semibold text-foreground"
                          style={{ backgroundColor: meta.bg }}
                        >
                          {initials || 'SC'}
                        </div>
                      )}
                      <div>
                        <h3 className="marketing-display text-xl font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
                          {studio.name}
                        </h3>
                        <p className="text-xs capitalize text-muted-foreground">
                          {studio.discipline}
                          {studio.city ? ` \u00B7 ${studio.city}` : ''}
                          {studio.region ? `, ${studio.region}` : ''}
                          {studio.country_code ? ` (${studio.country_code})` : ''}
                        </p>
                      </div>
                    </div>
                    {studio.description && (
                      <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                        {studio.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-4">
                        <span>
                          {studio.member_count > 0
                            ? `${studio.member_count} member${studio.member_count !== 1 ? 's' : ''}`
                            : 'Open to new members'}
                        </span>
                        {studio.upcoming_class_count > 0 && (
                          <span>
                            {studio.upcoming_class_count} upcoming class{studio.upcoming_class_count !== 1 ? 'es' : ''}
                          </span>
                        )}
                      </div>
                      <span className="text-primary transition-transform group-hover:translate-x-1">Explore</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
              <span className="text-[10px] font-bold text-white">SC</span>
            </div>
            <span>Studio Co-op</span>
          </div>
          <span>Community-first studio management. Made in Aotearoa.</span>
        </div>
      </footer>
    </div>
  )
}
