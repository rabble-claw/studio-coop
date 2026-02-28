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

async function getStudios(searchParams: { q?: string; discipline?: string; city?: string }) {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  let query = supabase
    .from('studios')
    .select('id, name, slug, discipline, description, logo_url, settings')

  if (searchParams.discipline) {
    query = query.eq('discipline', searchParams.discipline)
  }
  if (searchParams.city) {
    query = query.ilike('settings->>city', `%${searchParams.city}%`)
  }
  if (searchParams.q) {
    query = query.or(
      `name.ilike.%${searchParams.q}%,description.ilike.%${searchParams.q}%,discipline.ilike.%${searchParams.q}%`
    )
  }

  const { data: studios } = await query

  if (!studios || studios.length === 0) return []

  const studioIds = studios.map((s) => s.id)

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

  return studios
    .map((s: StudioRow) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      discipline: s.discipline,
      description: s.description,
      logo_url: s.logo_url,
      city: ((s.settings ?? {}) as Record<string, unknown>).city as string | null ?? null,
      member_count: memberCountMap[s.id] ?? 0,
      upcoming_class_count: classCountMap[s.id] ?? 0,
    }))
    .sort((a, b) => b.member_count - a.member_count)
}

async function getCities() {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: studios } = await supabase.from('studios').select('settings')
  const citySet = new Set<string>()
  for (const s of studios ?? []) {
    const settings = (s.settings ?? {}) as Record<string, unknown>
    const city = settings.city as string | undefined
    if (city) citySet.add(city)
  }
  return Array.from(citySet).sort()
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; discipline?: string; city?: string }>
}) {
  const params = await searchParams
  const [studios, cities] = await Promise.all([getStudios(params), getCities()])

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">SC</span>
          </div>
          <span className="font-bold text-lg">Studio Co-op</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Log in
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-12 pb-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-center mb-4">
          Find Your Studio
        </h1>
        <p className="text-lg text-muted-foreground text-center max-w-xl mx-auto mb-8">
          Browse indie fitness and movement studios. Find your community.
        </p>

        <StudioSearch
          currentSearch={params.q ?? ''}
          currentDiscipline={params.discipline ?? ''}
          currentCity={params.city ?? ''}
          cities={cities}
        />
      </section>

      {/* Results count */}
      {studios.length > 0 && (
        <div className="max-w-6xl mx-auto px-6 pb-4">
          <p className="text-sm text-muted-foreground">
            {studios.length} studio{studios.length !== 1 ? 's' : ''}
            {params.discipline ? ` · ${params.discipline}` : ''}
            {params.city ? ` · ${params.city}` : ''}
          </p>
        </div>
      )}

      {/* Studio grid */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        {studios.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">{'\u{1F3AA}'}</div>
            <p className="text-muted-foreground text-lg">
              {params.q || params.discipline || params.city
                ? 'No studios found matching your search.'
                : 'No studios available yet. Check back soon!'}
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {studios.map((studio) => {
              const meta = getDisciplineMeta(studio.discipline)
              return (
                <Link
                  key={studio.id}
                  href={`/${studio.slug}`}
                  className="group rounded-xl border bg-card overflow-hidden hover:border-primary/30 hover:shadow-md transition-all"
                >
                  {/* Colored discipline accent */}
                  <div className="h-1" style={{ backgroundColor: meta.color }} />
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      {studio.logo_url ? (
                        <img
                          src={studio.logo_url}
                          alt={studio.name}
                          className="w-12 h-12 rounded-xl object-cover"
                        />
                      ) : (
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                          style={{ backgroundColor: meta.bg }}
                        >
                          {meta.emoji}
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {studio.name}
                        </h3>
                        <p className="text-xs text-muted-foreground capitalize">
                          {studio.discipline}
                          {studio.city ? ` · ${studio.city}` : ''}
                        </p>
                      </div>
                    </div>
                    {studio.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {studio.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{studio.member_count} member{studio.member_count !== 1 ? 's' : ''}</span>
                      {studio.upcoming_class_count > 0 && (
                        <span>
                          {studio.upcoming_class_count} upcoming class{studio.upcoming_class_count !== 1 ? 'es' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
              <span className="text-white font-bold text-[10px]">SC</span>
            </div>
            <span>Studio Co-op</span>
          </div>
          <span>Community-first studio management. Made in Aotearoa.</span>
        </div>
      </footer>
    </div>
  )
}
