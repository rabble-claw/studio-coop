'use client'

interface SpotPickerProps {
  maxCapacity: number
  takenSpots: number[]
  selectedSpot: number | null
  onSelectSpot: (spot: number | null) => void
}

export function SpotPicker({ maxCapacity, takenSpots, selectedSpot, onSelectSpot }: SpotPickerProps) {
  const takenSet = new Set(takenSpots)

  // Responsive columns: 5 for small grids, scale up for larger capacities
  const cols = maxCapacity <= 10 ? 'grid-cols-5' : maxCapacity <= 20 ? 'grid-cols-5 sm:grid-cols-10' : 'grid-cols-5 sm:grid-cols-8 md:grid-cols-10'

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Select your spot</label>
      <div className={`grid ${cols} gap-2`}>
        {Array.from({ length: maxCapacity }, (_, i) => {
          const spotNum = i + 1
          const isTaken = takenSet.has(spotNum)
          const isSelected = selectedSpot === spotNum

          return (
            <button
              key={spotNum}
              type="button"
              disabled={isTaken}
              onClick={() => onSelectSpot(isSelected ? null : spotNum)}
              className={[
                'w-10 h-10 rounded-lg text-sm font-medium transition-all flex items-center justify-center',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                isTaken
                  ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                  : isSelected
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'border border-border hover:border-primary/50 hover:bg-muted/40 cursor-pointer',
              ].join(' ')}
              aria-label={`Spot ${spotNum}${isTaken ? ' (taken)' : isSelected ? ' (selected)' : ''}`}
            >
              {spotNum}
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded border border-border" />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-primary" />
          Selected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-muted opacity-50" />
          Taken
        </span>
      </div>
    </div>
  )
}
