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

export function StudioSearch({
  currentSearch,
  currentDiscipline,
  currentCity,
  cities,
}: {
  currentSearch: string
  currentDiscipline: string
  currentCity: string
  cities: string[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(currentSearch)

  const updateParams = useCallback(
    (updates: { q?: string; discipline?: string; city?: string }) => {
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

      const qs = params.toString()
      router.push(`/explore${qs ? `?${qs}` : ''}`)
    },
    [router, searchParams]
  )

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateParams({ q: search })
  }

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

      {/* Discipline filter — visual pills with emoji */}
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

      {/* City filter */}
      {cities.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 text-center">
            By City
          </p>
          <div className="flex flex-wrap justify-center gap-2">
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
            {cities.map((c) => {
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
          </div>
        </div>
      )}
    </div>
  )
}
