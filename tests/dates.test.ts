import { describe, expect, it } from 'vitest'
import {
  addDays,
  daysBetween,
  eachDay,
  formatDayFull,
  formatDayRange,
  formatDayRelative,
  formatDayShort,
  formatSavedCompact,
  formatSavedFull,
  formatSavedRelative,
  isIsoDay,
  isoWeekday,
  isSavedStamp,
  savedStampNow,
  today,
} from '@/lib/dates'

describe('iso days', () => {
  it('validates calendar days', () => {
    expect(isIsoDay('2027-02-28')).toBe(true)
    expect(isIsoDay('2027-02-30')).toBe(false)
    expect(isIsoDay('27-02-01')).toBe(false)
  })

  it('adds days across the daylight-saving switch', () => {
    expect(addDays('2027-03-27', 1)).toBe('2027-03-28')
    expect(addDays('2027-03-28', 1)).toBe('2027-03-29')
    expect(addDays('2027-10-31', 1)).toBe('2027-11-01')
    expect(daysBetween('2027-03-27', '2027-03-29')).toBe(2)
  })

  it('lists days inclusively across New Year', () => {
    expect(eachDay('2027-12-30', '2028-01-02')).toEqual([
      '2027-12-30',
      '2027-12-31',
      '2028-01-01',
      '2028-01-02',
    ])
  })

  it('knows ISO weekdays', () => {
    expect(isoWeekday('2027-05-06')).toBe(4)
    expect(isoWeekday('2027-10-03')).toBe(7)
  })

  it('uses Berlin as the day boundary', () => {
    // 2027-06-30 22:30 UTC is already July 1st in Berlin.
    expect(today(Date.UTC(2027, 5, 30, 22, 30))).toBe('2027-07-01')
  })
})

describe('formatting', () => {
  it('formats German dates', () => {
    expect(formatDayShort('2027-07-12')).toBe('Mo, 12.07.2027')
    expect(formatDayFull('2027-07-12')).toBe('Montag, 12. Juli 2027')
  })

  it('shortens ranges', () => {
    expect(formatDayRange('2027-07-12', '2027-07-30')).toBe('12.–30.07.2027')
    expect(formatDayRange('2027-07-28', '2027-08-03')).toBe('28.07.–03.08.2027')
    expect(formatDayRange('2027-12-20', '2028-01-02')).toBe('20.12.2027–02.01.2028')
    expect(formatDayRange('2027-05-07', '2027-05-07')).toBe('07.05.2027')
  })

  it('describes days relative to today', () => {
    const now = Date.UTC(2027, 5, 21, 10)
    expect(formatDayRelative('2027-06-21', now)).toBe('heute')
    expect(formatDayRelative('2027-06-22', now)).toBe('morgen')
    expect(formatDayRelative('2027-07-12', now)).toBe('in 3 Wochen')
    expect(formatDayRelative('2027-06-19', now)).toBe('vor 2 Tagen')
  })
})

describe('saved stamp', () => {
  const now = Date.UTC(2026, 9, 6, 12, 32)

  it('is written in Berlin local time with minute precision', () => {
    expect(savedStampNow(now)).toBe('2026-10-06T14:32')
    expect(isSavedStamp('2026-10-06T14:32')).toBe(true)
    expect(isSavedStamp('2026-10-06 14:32')).toBe(false)
  })

  it('is shown absolute and relative', () => {
    expect(formatSavedCompact('2026-10-06T14:32')).toBe('06.10.2026 14:32')
    expect(formatSavedFull('2026-10-06T14:32')).toBe('Di, 06.10.2026, 14:32 Uhr')
    expect(formatSavedRelative('2026-10-06T14:32', now)).toBe('gerade eben')
    expect(formatSavedRelative('2026-09-15T09:00', now)).toBe('vor 3 Wochen')
  })
})
