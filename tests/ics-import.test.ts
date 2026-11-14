import { describe, expect, it } from 'vitest'
import { importStatus, parseIcs } from '@/features/settings/ics-import'

const ics = (events: string) =>
  `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events.trim().replace(/\n/g, '\r\n')}\r\nEND:VCALENDAR\r\n`

describe('parseIcs', () => {
  it('reads all-day events with an exclusive DTEND', () => {
    const text = ics(`
BEGIN:VEVENT
DTSTART;VALUE=DATE:20270130
DTEND;VALUE=DATE:20270207
SUMMARY:Winterferien 2027 (+Wochenende)
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20270129
DTEND;VALUE=DATE:20270130
SUMMARY:Zeugnisausgabe Halbjahr 2027
END:VEVENT`)
    expect(parseIcs(text)).toEqual([
      { name: 'Zeugnisausgabe Halbjahr 2027', start: '2027-01-29', end: '2027-01-29' },
      { name: 'Winterferien 2027 (+Wochenende)', start: '2027-01-30', end: '2027-02-06' },
    ])
  })

  it('unfolds lines, unescapes text and ignores alarms and cancelled events', () => {
    const text = ics(`
BEGIN:VEVENT
DTSTART;VALUE=DATE:20270507
SUMMARY:Studientag\\, Schule
  geschlossen
BEGIN:VALARM
SUMMARY:Erinnerung
END:VALARM
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20270508
STATUS:CANCELLED
SUMMARY:Abgesagt
END:VEVENT`)
    expect(parseIcs(text)).toEqual([
      { name: 'Studientag, Schule geschlossen', start: '2027-05-07', end: '2027-05-07' },
    ])
  })

  it('keeps the dates of timed events and skips broken ones', () => {
    const text = ics(`
BEGIN:VEVENT
DTSTART:20270610T080000Z
DTEND:20270611T120000Z
SUMMARY:Klassenfahrt
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:2027
SUMMARY:Kaputt
END:VEVENT`)
    expect(parseIcs(text)).toEqual([
      { name: 'Klassenfahrt', start: '2027-06-10', end: '2027-06-11' },
    ])
  })
})

describe('importStatus', () => {
  const calendar = {
    schoolHolidays: [{ name: 'Winterferien', start: '2027-02-01', end: '2027-02-06' }],
    publicHolidays: [{ name: 'Tag der Arbeit', start: '2027-05-01', end: '2027-05-01' }],
  }
  it('marks ranges whose weekdays are all school-free as known', () => {
    expect(importStatus({ name: 'W', start: '2027-01-30', end: '2027-02-07' }, calendar, [])).toBe(
      'known',
    )
  })
  it('marks a school day as new and an own day as added', () => {
    const day = { name: 'Studientag', start: '2027-05-07', end: '2027-05-07' }
    expect(importStatus(day, calendar, [])).toBe('new')
    expect(importStatus(day, calendar, [day])).toBe('added')
  })
})
