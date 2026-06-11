// Date helpers for studio-local time handling.

/** Returns the calendar date (YYYY-MM-DD) "today" in the given IANA timezone. */
export function todayInTimezone(timezone: string, at: Date = new Date()): string {
  try {
    // en-CA formats as YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(at)
  } catch {
    return at.toISOString().split('T')[0]
  }
}
