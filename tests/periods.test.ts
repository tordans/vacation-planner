import { describe, expect, it } from 'vitest'
import { deriveBridgeDays, normalizePeriods } from '@/features/holidays/periods'
import { BERLIN_2027, berlin2027 } from './fixtures'

describe('deriveBridgeDays', () => {
  it('finds the Friday after Ascension Day in Berlin 2027', () => {
    expect(deriveBridgeDays(BERLIN_2027.publicHolidays)).toEqual(['2027-05-07'])
  })

  it('finds the Monday before a Tuesday holiday', () => {
    expect(
      deriveBridgeDays([{ name: 'Feiertag', start: '2027-06-01', end: '2027-06-01' }]),
    ).toEqual(['2027-05-31'])
  })

  it('ignores Monday, Wednesday, Friday and weekend holidays', () => {
    expect(
      deriveBridgeDays([
        { name: 'Montag', start: '2027-03-08', end: '2027-03-08' },
        { name: 'Mittwoch', start: '2027-06-02', end: '2027-06-02' },
        { name: 'Freitag', start: '2027-03-26', end: '2027-03-26' },
        { name: 'Samstag', start: '2027-05-01', end: '2027-05-01' },
      ]),
    ).toEqual([])
  })

  it('does not call a public holiday a bridge day', () => {
    expect(
      deriveBridgeDays([
        { name: 'Donnerstag', start: '2027-06-03', end: '2027-06-03' },
        { name: 'Freitag', start: '2027-06-04', end: '2027-06-04' },
      ]),
    ).toEqual([])
  })
})

describe('normalizePeriods', () => {
  it('merges duplicate rows and sorts by start', () => {
    expect(
      normalizePeriods([
        { name: 'B', start: '2027-05-01', end: '2027-05-01' },
        { name: 'A', start: '2027-01-01', end: '2027-01-01' },
        { name: 'B', start: '2027-05-01', end: '2027-05-01' },
        { name: 'C', start: '2027-05-01', end: '2027-05-01' },
      ]),
    ).toEqual([
      { name: 'A', start: '2027-01-01', end: '2027-01-01' },
      { name: 'B / C', start: '2027-05-01', end: '2027-05-01' },
    ])
  })
})

describe('buildCalendar', () => {
  it('marks school holidays, public holidays and bridge days per day', () => {
    expect(berlin2027.days.get('2027-07-01')).toEqual({ schoolHoliday: 'Sommerferien' })
    expect(berlin2027.days.get('2027-03-26')).toEqual({
      schoolHoliday: 'Osterferien',
      publicHoliday: 'Karfreitag',
    })
    expect(berlin2027.days.get('2027-05-07')).toEqual({
      schoolHoliday: 'Himmelfahrt (schulfrei)',
      bridgeDay: true,
    })
    expect(berlin2027.days.get('2027-06-15')).toBeUndefined()
  })
})
