import { describe, expect, it } from 'vitest'
import { applyCalendarEdits, deriveBridgeDays, normalizePeriods } from '@/features/holidays/periods'
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

describe('applyCalendarEdits', () => {
  it('adds own school-free days and corrects or removes imported holidays', () => {
    const edited = applyCalendarEdits(BERLIN_2027, {
      customDays: [{ name: 'Studientag', start: '2027-11-12', end: '2027-11-12' }],
      adjustments: [
        { kind: 'school', start: '2027-02-01', end: '2027-02-06', replacement: null },
        {
          kind: 'school',
          start: '2027-10-11',
          end: '2027-10-23',
          replacement: { name: 'Herbstferien', start: '2027-10-11', end: '2027-10-22' },
        },
        { kind: 'public', start: '2027-03-08', end: '2027-03-08', replacement: null },
      ],
    })
    const names = edited.schoolHolidays.map((period) => period.name)
    expect(names).not.toContain('Winterferien')
    expect(names).toContain('Studientag')
    expect(edited.schoolHolidays.find((period) => period.name === 'Herbstferien')?.end).toBe(
      '2027-10-22',
    )
    expect(edited.publicHolidays).toHaveLength(BERLIN_2027.publicHolidays.length - 1)
  })

  it('leaves the imported data alone without edits', () => {
    expect(applyCalendarEdits(BERLIN_2027, { customDays: [], adjustments: [] })).toEqual(
      BERLIN_2027,
    )
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
