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
    <div className="space-y-5">
      {/* Search input */}
      <form onSubmit={handleSearchSubmit} className="max-w-xl mx-auto">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search studios by name or discipline..."
            className="w-full rounded-xl border bg-card px-4 py-3 pr-12 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <button
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
          </button>
        </div>
      </form>

      {/* Near Me button */}
      <div className="flex justify-center">
        <button
          onClick={handleNearMe}
          disabled={geoLoading}
          className="rounded-full px-5 py-2.5 text-sm font-medium border-2 border-primary bg-primary/5 text-primary hover:bg-primary hover:text-white transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
          {geoLoading ? 'Locating...' : 'Near Me'}
        </button>
        {geoError && (
          <p role="alert" className="text-sm text-red-600 mt-1">{geoError}</p>
        )}
      </div>

      {/* Discipline filter -- visual pills with emoji */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 text-center">
          By Type
        </p>
        <div className="flex flex-wrap justify-center gap-2">
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
                  className={`rounded-full px-4 py-2 text-sm font-medium border-2 transition-colors ${
                    isActive
                      ? 'bg-primary text-white border-primary'
                      : 'bg-card text-foreground border-border hover:border-primary/30'
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
                className="rounded-full px-4 py-2 text-sm font-medium border-2 transition-colors flex items-center gap-1.5"
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

      {/* Location filter */}
      {locations.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 text-center">
            By Location
          </p>

          {/* Breadcrumb navigation */}
          {(currentCountry || currentRegion) && (
            <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground mb-3">
              <button
                onClick={() => updateParams({ country: 'All', region: 'All', city: 'All' })}
                className="hover:text-foreground transition-colors underline"
              >
                All
              </button>
              {currentCountry && (
                <>
                  <span>&gt;</span>
                  <button
                    onClick={() => updateParams({ region: 'All', city: 'All' })}
                    className={`transition-colors ${currentRegion ? 'hover:text-foreground underline' : 'text-foreground font-medium'}`}
                  >
                    {COUNTRY_INFO[currentCountry]?.flag ?? ''} {COUNTRY_INFO[currentCountry]?.name ?? currentCountry}
                  </button>
                </>
              )}
              {currentRegion && (
                <>
                  <span>&gt;</span>
                  <span className="text-foreground font-medium">{currentRegion}</span>
                </>
              )}
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-2">
            {/* When no country is selected, show country pills */}
            {!currentCountry && (
              <>
                <button
                  onClick={() => updateParams({ country: 'All', region: 'All', city: 'All' })}
                  className="rounded-full px-4 py-2 text-sm font-medium border-2 transition-colors bg-primary text-white border-primary"
                >
                  All Locations
                </button>
                {locations.map((loc) => {
                  const info = COUNTRY_INFO[loc.country_code]
                  return (
                    <button
                      key={loc.country_code}
                      onClick={() => updateParams({ country: loc.country_code, region: 'All', city: 'All' })}
                      className="rounded-full px-4 py-2 text-sm font-medium border-2 transition-colors flex items-center gap-1.5 bg-card text-foreground border-border hover:border-primary/30"
                    >
                      <span>{info?.flag ?? '\u{1F30D}'}</span>
                      {info?.name ?? loc.country_code}
                    </button>
                  )
                })}
              </>
            )}

            {/* When a country is selected but no region, show regions for that country */}
            {currentCountry && !currentRegion && selectedLocation && selectedLocation.regions.length > 0 && (
              <>
                <button
                  onClick={() => updateParams({ country: 'All', region: 'All', city: 'All' })}
                  className="rounded-full px-4 py-2 text-sm font-medium border-2 transition-colors bg-card text-foreground border-border hover:border-primary/30"
                >
                  All Regions
                </button>
                {selectedLocation.regions.map((r) => (
                  <button
                    key={r}
                    onClick={() => updateParams({ region: r, city: 'All' })}
                    className="rounded-full px-4 py-2 text-sm font-medium border-2 transition-colors flex items-center gap-1.5 bg-card text-foreground border-border hover:border-primary/30"
                  >
                    <span>{'\u{1F4CD}'}</span>
                    {r}
                  </button>
                ))}
              </>
            )}

            {/* When country is selected and region is selected, show cities */}
            {currentCountry && currentRegion && selectedLocation && selectedLocation.cities.length > 0 && (
              <>
                <button
                  onClick={() => updateParams({ city: 'All' })}
                  className={`rounded-full px-4 py-2 text-sm font-medium border-2 transition-colors ${
                    !currentCity
                      ? 'bg-primary text-white border-primary'
                      : 'bg-card text-foreground border-border hover:border-primary/30'
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
                      className={`rounded-full px-4 py-2 text-sm font-medium border-2 transition-colors flex items-center gap-1.5 ${
                        isActive
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'bg-card text-foreground border-border hover:border-primary/30'
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
