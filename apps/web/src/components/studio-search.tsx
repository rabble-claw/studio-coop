'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useCallback } from 'react'

const DISCIPLINE_META: Record<string, { emoji: string; color: string; bg: string }> = {
  pole:    { emoji: '\u{1FA70}', color: '#7c3aed', bg: '#f3e8ff' },
  aerial:  { emoji: '\u{1F3AA}', color: '#2563eb', bg: '#dbeafe' },
  yoga:    { emoji: '\u{1F9D8}', color: '#059669', bg: '#d1fae5' },
  dance:   { emoji: '\u{1F483}', color: '#db2777', bg: '#fce7f3' },
  bjj:     { emoji: '\u{1F94B}', color: '#ea580c', bg: '#ffedd5' },
  pilates: { emoji: '\u{1F9D8}\u200D\u2640\uFE0F', color: '#0891b2', bg: '#cffafe' },
  fitness: { emoji: '\u{1F3CB}\uFE0F', color: '#4f46e5', bg: '#e0e7ff' },
}

const DISCIPLINES = ['All', 'Pole', 'Aerial', 'Yoga', 'Dance', 'BJJ', 'Pilates', 'Fitness']

const COUNTRY_INFO: Record<string, { flag: string; name: string }> = {
  NZ: { flag: '\u{1F1F3}\u{1F1FF}', name: 'New Zealand' },
  US: { flag: '\u{1F1FA}\u{1F1F8}', name: 'United States' },
  AU: { flag: '\u{1F1E6}\u{1F1FA}', name: 'Australia' },
  GB: { flag: '\u{1F1EC}\u{1F1E7}', name: 'United Kingdom' },
  CA: { flag: '\u{1F1E8}\u{1F1E6}', name: 'Canada' },
}

type LocationGroup = {
  country_code: string
  regions: string[]
  cities: string[]
}

export function StudioSearch({
  currentSearch,
  currentDiscipline,
  currentCity,
  currentCountry,
  currentRegion,
  locations,
}: {
  currentSearch: string
  currentDiscipline: string
  currentCity: string
  currentCountry: string
  currentRegion: string
  locations: LocationGroup[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(currentSearch)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  const updateParams = useCallback(
    (updates: { q?: string; discipline?: string; city?: string; country?: string; region?: string; lat?: string; lng?: string; radius?: string }) => {
      const params = new URLSearchParams(searchParams.toString())

      if (updates.q !== undefined) {
        if (updates.q) params.set('q', updates.q)
        else params.delete('q')
      }
      if (updates.discipline !== undefined) {
        if (updates.discipline && updates.discipline !== 'All') params.set('discipline', updates.discipline.toLowerCase())
        else params.delete('discipline')
      }
      if (updates.city !== undefined) {
        if (updates.city && updates.city !== 'All') params.set('city', updates.city)
        else params.delete('city')
      }
      if (updates.country !== undefined) {
        if (updates.country && updates.country !== 'All') params.set('country', updates.country)
        else params.delete('country')
      }
      if (updates.region !== undefined) {
        if (updates.region && updates.region !== 'All') params.set('region', updates.region)
        else params.delete('region')
      }
      if (updates.lat !== undefined) {
        if (updates.lat) params.set('lat', updates.lat)
        else params.delete('lat')
      }
      if (updates.lng !== undefined) {
        if (updates.lng) params.set('lng', updates.lng)
        else params.delete('lng')
      }
      if (updates.radius !== undefined) {
        if (updates.radius) params.set('radius', updates.radius)
        else params.delete('radius')
      }

      const qs = params.toString()
      router.push(`/explore${qs ? `?${qs}` : ''}`)
    },
    [router, searchParams]
  )

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateParams({ q: search })
  }

  const handleNearMe = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.')
      return
    }
    setGeoLoading(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoLoading(false)
        updateParams({
          lat: position.coords.latitude.toFixed(6),
          lng: position.coords.longitude.toFixed(6),
          radius: '25',
          country: 'All',
          region: 'All',
          city: 'All',
        })
      },
      () => {
        setGeoLoading(false)
        setGeoError('Unable to get your location. Please check your browser permissions.')
      }
    )
  }

  const selectedLocation = locations.find((l) => l.country_code === currentCountry)

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearchSubmit} className="mx-auto max-w-xl">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search studios by name or discipline..."
            className="w-full rounded-2xl border border-border/70 bg-background/90 px-4 py-3.5 pr-12 text-foreground shadow-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
          </button>
        </div>
      </form>

      <div className="space-y-2 text-center">
        <button
          onClick={handleNearMe}
          disabled={geoLoading}
          className="inline-flex items-center gap-2 rounded-full border-2 border-primary/70 bg-primary/5 px-5 py-2.5 text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-primary hover:text-white disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
          {geoLoading ? 'Locating...' : 'Near Me'}
        </button>
        {geoError && (
          <p role="alert" className="text-sm text-red-600">{geoError}</p>
        )}
      </div>

      <div>
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          By Type
        </p>
        <div className="flex flex-wrap justify-center gap-2.5">
          {DISCIPLINES.map((d) => {
            const isActive = currentDiscipline
              ? d.toLowerCase() === currentDiscipline.toLowerCase()
              : d === 'All'
            const meta = DISCIPLINE_META[d.toLowerCase()]

            if (d === 'All') {
              return (
                <button
                  key={d}
                  onClick={() => updateParams({ discipline: 'All' })}
                  className={`rounded-full border-2 px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-background text-foreground hover:border-primary/30'
                  }`}
                >
                  All
                </button>
              )
            }

            return (
              <button
                key={d}
                onClick={() => updateParams({ discipline: d })}
                className="flex items-center gap-1.5 rounded-full border-2 border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:border-primary/30"
                style={{
                  borderColor: isActive ? (meta?.color ?? '#7c3aed') : undefined,
                  backgroundColor: isActive ? (meta?.bg ?? '#f3e8ff') : undefined,
                  color: isActive ? (meta?.color ?? '#7c3aed') : undefined,
                }}
              >
                <span>{meta?.emoji ?? ''}</span>
                {d}
              </button>
            )
          })}
        </div>
      </div>

      {locations.length > 0 && (
        <div>
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            By Location
          </p>

          {(currentCountry || currentRegion) && (
            <div className="mb-3 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <button
                onClick={() => updateParams({ country: 'All', region: 'All', city: 'All' })}
                className="underline transition-colors hover:text-foreground"
              >
                All
              </button>
              {currentCountry && (
                <>
                  <span>&gt;</span>
                  <button
                    onClick={() => updateParams({ region: 'All', city: 'All' })}
                    className={`transition-colors ${currentRegion ? 'underline hover:text-foreground' : 'font-medium text-foreground'}`}
                  >
                    {COUNTRY_INFO[currentCountry]?.flag ?? ''} {COUNTRY_INFO[currentCountry]?.name ?? currentCountry}
                  </button>
                </>
              )}
              {currentRegion && (
                <>
                  <span>&gt;</span>
                  <span className="font-medium text-foreground">{currentRegion}</span>
                </>
              )}
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-2">
            {!currentCountry && (
              <>
                <button
                  onClick={() => updateParams({ country: 'All', region: 'All', city: 'All' })}
                  className="rounded-full border-2 border-primary bg-primary px-4 py-2 text-sm font-medium text-white transition-colors"
                >
                  All Locations
                </button>
                {locations.map((loc) => {
                  const info = COUNTRY_INFO[loc.country_code]
                  return (
                    <button
                      key={loc.country_code}
                      onClick={() => updateParams({ country: loc.country_code, region: 'All', city: 'All' })}
                      className="flex items-center gap-1.5 rounded-full border-2 border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/30"
                    >
                      <span>{info?.flag ?? '\u{1F30D}'}</span>
                      {info?.name ?? loc.country_code}
                    </button>
                  )
                })}
              </>
            )}

            {currentCountry && !currentRegion && selectedLocation && selectedLocation.regions.length > 0 && (
              <>
                <button
                  onClick={() => updateParams({ country: 'All', region: 'All', city: 'All' })}
                  className="rounded-full border-2 border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/30"
                >
                  All Regions
                </button>
                {selectedLocation.regions.map((r) => (
                  <button
                    key={r}
                    onClick={() => updateParams({ region: r, city: 'All' })}
                    className="flex items-center gap-1.5 rounded-full border-2 border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/30"
                  >
                    <span>{'\u{1F4CD}'}</span>
                    {r}
                  </button>
                ))}
              </>
            )}

            {currentCountry && currentRegion && selectedLocation && selectedLocation.cities.length > 0 && (
              <>
                <button
                  onClick={() => updateParams({ city: 'All' })}
                  className={`rounded-full border-2 px-4 py-2 text-sm font-medium transition-colors ${
                    !currentCity
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-background text-foreground hover:border-primary/30'
                  }`}
                >
                  All Cities
                </button>
                {selectedLocation.cities.map((c) => {
                  const isActive = currentCity === c
                  return (
                    <button
                      key={c}
                      onClick={() => updateParams({ city: c })}
                      className={`flex items-center gap-1.5 rounded-full border-2 px-4 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border bg-background text-foreground hover:border-primary/30'
                      }`}
                    >
                      <span>{'\u{1F4CD}'}</span>
                      {c}
                    </button>
                  )
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
