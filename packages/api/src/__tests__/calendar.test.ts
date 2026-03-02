import { describe, it, expect } from 'vitest'
import { generateICalFeed, generateICalEvent, type ICalFeedEvent } from '../lib/calendar'

const fixedDate = new Date('2026-03-01T12:00:00Z')

describe('generateICalFeed', () => {
  it('produces valid empty feed', () => {
    const ics = generateICalFeed({ calendarName: 'Test', events: [], now: fixedDate })
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).toContain('METHOD:PUBLISH')
    expect(ics).toContain('X-WR-CALNAME:Test')
    expect(ics).toContain('PRODID:-//Studio Co-op//Calendar Feed//EN')
    expect(ics).not.toContain('BEGIN:VEVENT')
  })

  it('produces single event feed', () => {
    const events: ICalFeedEvent[] = [{
      bookingId: 'b-1',
      summary: 'Yoga Flow',
      date: '2026-03-05',
      startTime: '09:30:00',
      durationMinutes: 60,
      timezone: 'Pacific/Auckland',
      location: 'Studio A',
      description: 'Class with Jane',
      organizerName: 'Flow Studio',
      organizerEmail: 'info@flow.co.nz',
    }]

    const ics = generateICalFeed({ calendarName: 'My Classes', events, now: fixedDate })
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('END:VEVENT')
    expect(ics).toContain('UID:booking-b-1@studiocoop')
    expect(ics).toContain('SUMMARY:Yoga Flow')
    expect(ics).toContain('DTSTART;TZID=Pacific/Auckland:20260305T093000')
    expect(ics).toContain('DTEND;TZID=Pacific/Auckland:20260305T103000')
    expect(ics).toContain('LOCATION:Studio A')
    expect(ics).toContain('DESCRIPTION:Class with Jane')
    expect(ics).toContain('ORGANIZER;CN=Flow Studio:mailto:info@flow.co.nz')
    expect(ics).toContain('STATUS:CONFIRMED')
  })

  it('handles multi-timezone events', () => {
    const events: ICalFeedEvent[] = [
      {
        bookingId: 'b-nz',
        summary: 'Auckland Class',
        date: '2026-03-05',
        startTime: '09:00:00',
        durationMinutes: 45,
        timezone: 'Pacific/Auckland',
      },
      {
        bookingId: 'b-us',
        summary: 'NYC Class',
        date: '2026-03-06',
        startTime: '18:00:00',
        durationMinutes: 90,
        timezone: 'America/New_York',
      },
    ]

    const ics = generateICalFeed({ calendarName: 'Multi TZ', events, now: fixedDate })
    expect(ics).toContain('DTSTART;TZID=Pacific/Auckland:20260305T090000')
    expect(ics).toContain('DTEND;TZID=Pacific/Auckland:20260305T094500')
    expect(ics).toContain('DTSTART;TZID=America/New_York:20260306T180000')
    expect(ics).toContain('DTEND;TZID=America/New_York:20260306T193000')
    // Two VEVENTs
    const veventCount = (ics.match(/BEGIN:VEVENT/g) ?? []).length
    expect(veventCount).toBe(2)
  })

  it('escapes special characters', () => {
    const events: ICalFeedEvent[] = [{
      bookingId: 'b-esc',
      summary: 'Stretch, Breathe; Relax',
      date: '2026-03-10',
      startTime: '10:00:00',
      durationMinutes: 30,
      timezone: 'Pacific/Auckland',
      description: 'Line1\nLine2',
    }]

    const ics = generateICalFeed({ calendarName: 'Test', events, now: fixedDate })
    expect(ics).toContain('SUMMARY:Stretch\\, Breathe\\; Relax')
    expect(ics).toContain('DESCRIPTION:Line1\\nLine2')
  })

  it('uses CRLF line endings', () => {
    const ics = generateICalFeed({ calendarName: 'Test', events: [], now: fixedDate })
    expect(ics).toContain('\r\n')
    // Should not have bare LF
    const withoutCRLF = ics.replace(/\r\n/g, '')
    expect(withoutCRLF).not.toContain('\n')
  })
})

describe('generateICalEvent', () => {
  it('produces single-event VCALENDAR', () => {
    const ics = generateICalEvent({
      uid: 'test-1',
      summary: 'Power Yoga',
      date: '2026-04-01',
      startTime: '14:00',
      durationMinutes: 75,
      timezone: 'America/Los_Angeles',
      now: fixedDate,
    })
    expect(ics).toContain('METHOD:REQUEST')
    expect(ics).toContain('UID:booking-test-1@studiocoop')
    expect(ics).toContain('DTSTART;TZID=America/Los_Angeles:20260401T140000')
    expect(ics).toContain('DTEND;TZID=America/Los_Angeles:20260401T151500')
  })
})
