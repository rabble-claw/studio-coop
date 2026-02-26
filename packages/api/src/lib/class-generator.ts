// Class instance generator — produces scheduled class_instances from active templates.
// Called daily by cron or manually by studio owners.

import { createServiceClient } from './supabase'

/**
 * Generate class instances from all active templates for a studio.
 *
 * Logic:
 * 1. Fetch active templates for the studio
 * 2. For each template, calculate which dates need instances based on recurrence
 * 3. Skip dates that already have instances (UNIQUE on template_id + date)
 * 4. Skip studio closure dates
 * 5. Batch insert new instances
 *
 * @returns Number of new instances created
 */
export async function generateClassInstances(
  studioId: string,
  weeksAhead: number = 4,
): Promise<number> {
  const supabase = createServiceClient()

  // ── 1. Fetch studio settings (closure dates) ──────────────────────────────
  const { data: studio } = await supabase
    .from('studios')
    .select('settings')
    .eq('id', studioId)
    .single()

  const settings = (studio?.settings ?? {}) as Record<string, unknown>
  const closureDates = new Set<string>(
    Array.isArray(settings.closureDates) ? (settings.closureDates as string[]) : [],
  )

  // ── 2. Fetch active templates ─────────────────────────────────────────────
  const { data: templates } = await supabase
    .from('class_templates')
    .select('id, name, teacher_id, day_of_week, start_time, duration_min, max_capacity, recurrence')
    .eq('studio_id', studioId)
    .eq('active', true)

  if (!templates || templates.length === 0) return 0

  // ── 3. Calculate date window (UTC dates) ──────────────────────────────────
  const today = startOfDay(new Date())
  const endDate = new Date(today)
  endDate.setUTCDate(today.getUTCDate() + weeksAhead * 7)

  const fromStr = toDateString(today)
  const toStr = toDateString(endDate)

  // ── 4. Fetch existing instances in window (for dedup) ─────────────────────
  const { data: existingInstances } = await supabase
    .from('class_instances')
    .select('template_id, date')
    .eq('studio_id', studioId)
    .gte('date', fromStr)
    .lte('date', toStr)
    .in(
      'template_id',
      templates.map((t) => t.id),
    )

  const existingSet = new Set<string>(
    (existingInstances ?? []).map((i) => `${i.template_id}|${i.date}`),
  )

  // ── 5. Generate instances per template ────────────────────────────────────
  const newInstances: Array<{
    template_id: string
    studio_id: string
    teacher_id: string | null
    date: string
    start_time: string
    end_time: string
    status: 'scheduled'
    max_capacity: number | null
    feed_enabled: boolean
  }> = []

  for (const template of templates) {
    // Skip templates with no day_of_week
    if (template.day_of_week === null || template.day_of_week === undefined) continue

    let dates: string[]

    if (template.recurrence === 'once') {
      // Only generate if no instance exists at all for this template
      const { count } = await supabase
        .from('class_instances')
        .select('id', { count: 'exact', head: true })
        .eq('template_id', template.id)

      if ((count ?? 0) > 0) continue

      const occurrence = nextDayOfWeek(today, template.day_of_week)
      if (occurrence <= endDate) {
        const dateStr = toDateString(occurrence)
        dates = closureDates.has(dateStr) ? [] : [dateStr]
      } else {
        dates = []
      }
    } else {
      dates = calculateDates(
        template.id,
        template.day_of_week,
        template.recurrence,
        today,
        endDate,
        closureDates,
        existingSet,
      )
    }

    for (const dateStr of dates) {
      newInstances.push({
        template_id: template.id,
        studio_id: studioId,
        teacher_id: template.teacher_id ?? null,
        date: dateStr,
        start_time: template.start_time,
        end_time: calculateEndTime(template.start_time, template.duration_min),
        status: 'scheduled',
        max_capacity: template.max_capacity ?? null,
        feed_enabled: true,
      })
    }
  }

  if (newInstances.length === 0) return 0

  // ── 6. Batch insert (skip conflicts — UNIQUE on template_id + date) ────────
  const { data: inserted, error } = await supabase
    .from('class_instances')
    .upsert(newInstances, { onConflict: 'template_id,date', ignoreDuplicates: true })
    .select('id')

  if (error) throw error
  return inserted?.length ?? 0
}

// ─────────────────────────────────────────────────────────────────────────────
// Date helpers (exported for testing)
// All date arithmetic uses UTC methods to avoid DST/timezone issues.
// ─────────────────────────────────────────────────────────────────────────────

/** Returns an ISO date string "YYYY-MM-DD" for the UTC date. */
export function toDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}

/** Returns a new Date at UTC midnight for the UTC date of the input. */
export function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function calculateEndTime(startTime: string, durationMin: number): string {
  const [h, m] = startTime.split(':').map(Number)
  const totalMin = h * 60 + m + durationMin
  const endH = Math.floor(totalMin / 60) % 24
  const endM = totalMin % 60
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`
}

/**
 * Returns the next date on or after `from` (UTC) that falls on `targetDay` (0=Sun).
 */
export function nextDayOfWeek(from: Date, targetDay: number): Date {
  const date = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  const currentDay = date.getUTCDay()
  const daysUntil = (targetDay - currentDay + 7) % 7
  date.setUTCDate(date.getUTCDate() + daysUntil)
  return date
}

/**
 * Calculate which dates a template should generate within [from, to].
 */
export function calculateDates(
  templateId: string,
  dayOfWeek: number,
  recurrence: string,
  from: Date,
  to: Date,
  closureDates: Set<string>,
  existingSet: Set<string>,
): string[] {
  const dates: string[] = []
  const isNew = (dateStr: string) =>
    !closureDates.has(dateStr) && !existingSet.has(`${templateId}|${dateStr}`)

  switch (recurrence) {
    case 'weekly': {
      const cur = nextDayOfWeek(from, dayOfWeek)
      while (cur <= to) {
        const d = toDateString(cur)
        if (isNew(d)) dates.push(d)
        cur.setUTCDate(cur.getUTCDate() + 7)
      }
      break
    }

    case 'biweekly': {
      // Start from the first matching weekday on or after `from`.
      // Generate every other week from that first occurrence.
      const cur = nextDayOfWeek(from, dayOfWeek)
      let phase = 0
      while (cur <= to) {
        if (phase % 2 === 0) {
          const d = toDateString(cur)
          if (isNew(d)) dates.push(d)
        }
        cur.setUTCDate(cur.getUTCDate() + 7)
        phase++
      }
      break
    }

    case 'monthly': {
      // First occurrence of the target weekday in each calendar month within the window.
      const months = getMonthsInRange(from, to)
      for (const { year, month } of months) {
        const firstOfMonth = new Date(Date.UTC(year, month, 1))
        const occurrence = nextDayOfWeek(firstOfMonth, dayOfWeek)
        if (occurrence >= from && occurrence <= to) {
          const d = toDateString(occurrence)
          if (isNew(d)) dates.push(d)
        }
      }
      break
    }
  }

  return dates
}

function getMonthsInRange(
  from: Date,
  to: Date,
): Array<{ year: number; month: number }> {
  const result: Array<{ year: number; month: number }> = []
  const cur = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1))
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1))
  while (cur <= end) {
    result.push({ year: cur.getUTCFullYear(), month: cur.getUTCMonth() })
    cur.setUTCMonth(cur.getUTCMonth() + 1)
  }
  return result
}
