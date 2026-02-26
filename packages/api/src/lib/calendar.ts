// iCal (.ics) generation for booking confirmations, cancellations, and updates.
// Produces RFC 5545-compliant content without external dependencies.

export interface CalendarEventParams {
  /** Stable UID — use bookingId so updates/cancels reference the same event */
  uid: string
  /** Class name */
  summary: string
  /** ISO date string: YYYY-MM-DD */
  date: string
  /** HH:MM:SS or HH:MM — local time in the studio's timezone */
  startTime: string
  /** Duration in minutes */
  durationMinutes: number
  /** IANA timezone name, e.g. 'America/New_York' */
  timezone: string
  /** Physical or virtual location */
  location?: string
  /** Class description / teacher info */
  description?: string
  /** Studio display name */
  organizerName?: string
  /** Studio contact email */
  organizerEmail?: string
  /** 'REQUEST' (confirm/update) | 'CANCEL' (cancellation) */
  method?: 'REQUEST' | 'CANCEL'
  /** ISO timestamp when this version was produced — drives SEQUENCE/DTSTAMP */
  now?: Date
}

/**
 * Format a Date as a UTC iCal datetime string: YYYYMMDDTHHmmssZ
 */
function toICalUTC(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

/**
 * Format a local datetime (no timezone conversion) as YYYYMMDDTHHmmss.
 * Used with TZID= parameter when we want wall-clock time in the studio tz.
 */
function toICalLocal(dateStr: string, timeStr: string): string {
  // dateStr: YYYY-MM-DD, timeStr: HH:MM or HH:MM:SS
  const datePart = dateStr.replace(/-/g, '')
  const [h = '00', m = '00', s = '00'] = timeStr.split(':')
  return `${datePart}T${h.padStart(2, '0')}${m.padStart(2, '0')}${s.padStart(2, '0')}`
}

/**
 * Fold long lines per RFC 5545 §3.1 (max 75 octets, continued lines start with space).
 */
function foldLine(line: string): string {
  if (line.length <= 75) return line
  const chunks: string[] = []
  chunks.push(line.slice(0, 75))
  let i = 75
  while (i < line.length) {
    chunks.push(' ' + line.slice(i, i + 74))
    i += 74
  }
  return chunks.join('\r\n')
}

/**
 * Escape special characters in iCal text values.
 */
function escapeText(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

/**
 * Generate iCal content for a booking.
 *
 * Returns a string suitable for sending as `Content-Type: text/calendar`.
 *
 * Usage:
 *   const ics = generateICalEvent({ uid: bookingId, summary: 'Yoga Flow', ... })
 *   // Attach as booking-<id>.ics or embed in email
 */
export function generateICalEvent(params: CalendarEventParams): string {
  const {
    uid,
    summary,
    date,
    startTime,
    durationMinutes,
    timezone,
    location,
    description,
    organizerName,
    organizerEmail,
    method = 'REQUEST',
    now = new Date(),
  } = params

  const dtStamp = toICalUTC(now)
  const localStart = toICalLocal(date, startTime)

  // Compute end time by adding duration to start
  const [startH, startM] = startTime.split(':').map(Number)
  const endMinutes = (startH ?? 0) * 60 + (startM ?? 0) + durationMinutes
  const endH = Math.floor(endMinutes / 60) % 24
  const endM = endMinutes % 60
  const endTimeStr = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}:00`
  const localEnd = toICalLocal(date, endTimeStr)

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Studio Co-op//Booking Engine//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    foldLine(`UID:booking-${uid}@studiocoop`),
    `DTSTAMP:${dtStamp}`,
    foldLine(`DTSTART;TZID=${timezone}:${localStart}`),
    foldLine(`DTEND;TZID=${timezone}:${localEnd}`),
    foldLine(`SUMMARY:${escapeText(summary)}`),
  ]

  if (location) {
    lines.push(foldLine(`LOCATION:${escapeText(location)}`))
  }

  if (description) {
    lines.push(foldLine(`DESCRIPTION:${escapeText(description)}`))
  }

  if (organizerEmail) {
    const cn = organizerName ? `CN=${escapeText(organizerName)}:` : ''
    lines.push(foldLine(`ORGANIZER;${cn}mailto:${organizerEmail}`))
  }

  if (method === 'CANCEL') {
    lines.push('STATUS:CANCELLED')
  } else {
    lines.push('STATUS:CONFIRMED')
  }

  lines.push('END:VEVENT', 'END:VCALENDAR')

  // Join with CRLF per RFC 5545
  return lines.join('\r\n') + '\r\n'
}

/**
 * Build CalendarEventParams from a class_instance row and studio settings.
 * Convenience wrapper so routes don't inline this logic.
 */
export interface ClassInfo {
  id: string
  name: string
  date: string          // YYYY-MM-DD
  start_time: string    // HH:MM:SS
  duration_min: number
  location?: string | null
  teacher_name?: string | null
  studio_name?: string | null
  studio_email?: string | null
  timezone: string
}

export function buildBookingCalEvent(
  bookingId: string,
  cls: ClassInfo,
  method: 'REQUEST' | 'CANCEL' = 'REQUEST',
): string {
  const description = cls.teacher_name
    ? `Class with ${cls.teacher_name}`
    : undefined

  return generateICalEvent({
    uid: bookingId,
    summary: cls.name,
    date: cls.date,
    startTime: cls.start_time,
    durationMinutes: cls.duration_min,
    timezone: cls.timezone,
    location: cls.location ?? undefined,
    description,
    organizerName: cls.studio_name ?? undefined,
    organizerEmail: cls.studio_email ?? undefined,
    method,
  })
}
