'use client'

import { Badge } from '@/components/ui/badge'

interface StudioInfo {
  id: string
  name: string
  role: string
}

interface StudioSwitcherProps {
  studios: StudioInfo[]
  currentStudioId: string | null
  onSwitch: (studioId: string) => void
}

export function StudioSwitcher({ studios, currentStudioId, onSwitch }: StudioSwitcherProps) {
  if (studios.length <= 1) return null

  const current = studios.find((s) => s.id === currentStudioId) ?? studios[0]

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="studio-switcher" className="sr-only">
        Switch studio
      </label>
      <select
        id="studio-switcher"
        value={currentStudioId ?? ''}
        onChange={(e) => onSwitch(e.target.value)}
        className="text-sm font-medium border rounded-md px-2 py-1.5 bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[36px] max-w-[180px] truncate"
        aria-label="Switch studio"
      >
        {studios.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {current && (
        <Badge variant="secondary" className="text-[10px] capitalize">
          {current.role}
        </Badge>
      )}
    </div>
  )
}
