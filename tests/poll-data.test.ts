import { describe, expect, it } from 'vitest'
import { holidayRanges } from '@/features/poll/holiday-ranges'
import {
  addFamily,
  addHolidays,
  addRange,
  holidaysClipped,
  pollRows,
  removeFamily,
  removeRange,
  renameFamily,
  setFederalState,
  updateRange,
} from '@/features/poll/poll-data'
import { EMPTY_POLL, type Poll } from '@/features/poll/poll-schema'
import { pollFromHash, pollToHash } from '@/features/poll/poll-url'

const summer = { name: 'Sommerurlaub', start: '2027-07-12', end: '2027-07-30' }

function sample(): Poll {
  let poll = addFamily(EMPTY_POLL, 'Familie A')
  poll = addFamily(poll, 'Familie B')
  poll = addRange(poll, 'Familie A', summer)
  return addRange(poll, 'Chancen', { name: 'Besuch', start: '2027-07-20', end: '2027-07-25' })
}

describe('title', () => {
  it('survives every change', () => {
    let poll: Poll = { title: 'Sommer', sections: [] }
    poll = addFamily(poll, 'A')
    poll = addRange(poll, 'A', summer)
    poll = addRange(poll, 'Chancen', summer)
    poll = renameFamily(poll, 'A', 'B')
    const id = poll.sections[0]!.ranges[0]!.id
    poll = updateRange(poll, 'B', id, { ...summer, name: 'Urlaub' })
    poll = removeRange(poll, 'Chancen', poll.sections[1]!.ranges[0]!.id)
    poll = addHolidays(poll, 'B', 'BE', [])
    expect(poll.title).toBe('Sommer')
    expect(removeFamily(poll, 'B').title).toBe('Sommer')
  })
})

describe('families', () => {
  it('adds families before Chancen and rejects empty or taken names', () => {
    const poll = sample()
    expect(poll.sections.map((section) => section.name)).toEqual([
      'Familie A',
      'Familie B',
      'Chancen',
    ])
    const withC = addFamily(poll, 'Familie C')
    expect(withC.sections.map((section) => section.name)).toEqual([
      'Familie A',
      'Familie B',
      'Familie C',
      'Chancen',
    ])
    expect(addFamily(poll, '  ')).toBe(poll)
    expect(addFamily(poll, 'familie a')).toBe(poll)
    expect(addFamily(poll, 'chancen')).toBe(poll)
  })

  it('renames, but not to a taken name or to Chancen', () => {
    const poll = sample()
    const renamed = renameFamily(poll, 'Familie A', ' Jordans ')
    expect(renamed.sections[0]).toMatchObject({ name: 'Jordans' })
    expect(renamed.sections[0]?.ranges).toHaveLength(1)
    expect(renameFamily(poll, 'Familie A', 'Familie B')).toBe(poll)
    expect(renameFamily(poll, 'Familie A', 'Chancen')).toBe(poll)
    expect(renameFamily(poll, 'Chancen', 'Etwas')).toBe(poll)
  })

  it('removes a family with its ranges', () => {
    expect(removeFamily(sample(), 'familie a').sections.map((section) => section.name)).toEqual([
      'Familie B',
      'Chancen',
    ])
  })
})

describe('ranges', () => {
  it('gives every range its own id', () => {
    const ids = sample().sections.flatMap((section) => section.ranges.map((range) => range.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('rejects invalid ranges', () => {
    const poll = sample()
    expect(addRange(poll, 'Familie A', { ...summer, end: '2027-07-01' })).toBe(poll)
    expect(addRange(poll, 'Familie A', { ...summer, name: ' ' })).toBe(poll)
    expect(addRange(poll, 'Familie A', { ...summer, start: '2027-02-30' })).toBe(poll)
    expect(addRange(poll, 'Familie A', { ...summer, start: '1800-01-01' })).toBe(poll)
    expect(addRange(poll, 'Unbekannt', summer)).toBe(poll)
  })

  it('edits a range in place', () => {
    const poll = sample()
    const id = poll.sections[0]!.ranges[0]!.id
    const next = updateRange(poll, 'Familie A', id, {
      ...summer,
      name: 'Urlaub',
      end: '2027-08-01',
    })
    expect(next.sections[0]?.ranges).toEqual([
      { id, name: 'Urlaub', start: '2027-07-12', end: '2027-08-01' },
    ])
    expect(updateRange(poll, 'Familie A', id, { ...summer, end: '2027-01-01' })).toBe(poll)
  })

  it('keeps an empty family but drops an empty Chancen section', () => {
    const poll = sample()
    const familyRange = poll.sections[0]!.ranges[0]!.id
    const chancenRange = poll.sections[2]!.ranges[0]!.id
    expect(removeRange(poll, 'Familie A', familyRange).sections[0]).toMatchObject({
      name: 'Familie A',
      ranges: [],
    })
    expect(
      removeRange(poll, 'Chancen', chancenRange).sections.map((section) => section.name),
    ).toEqual(['Familie A', 'Familie B'])
  })
})

describe('holidays', () => {
  const periods = {
    schoolHolidays: [{ name: 'Sommerferien', start: '2027-07-01', end: '2027-08-13' }],
    publicHolidays: [{ name: 'Christi Himmelfahrt', start: '2027-05-06', end: '2027-05-06' }],
  }

  it('lists school holidays, with public holidays and bridge days on request', () => {
    expect(holidayRanges(periods, false)).toEqual([
      { name: 'Sommerferien', start: '2027-07-01', end: '2027-08-13' },
    ])
    expect(holidayRanges(periods, true).map((range) => range.name)).toEqual([
      'Christi Himmelfahrt',
      'Brückentag',
      'Sommerferien',
    ])
  })

  it('stores the federal state and does not add the same holidays twice', () => {
    const ranges = holidayRanges(periods, false)
    const once = addHolidays(sample(), 'Familie B', 'BE', ranges)
    const twice = addHolidays(once, 'Familie B', 'BE', ranges)
    expect(once.sections[1]).toMatchObject({ federalState: 'BE' })
    expect(once.sections[1]?.ranges).toHaveLength(1)
    expect(twice.sections[1]?.ranges).toHaveLength(1)
  })

  it('applies holidays to the named family only, and to nothing for an unknown family', () => {
    const ranges = holidayRanges(periods, false)
    const applied = addHolidays(sample(), 'Familie B', 'BE', ranges)
    expect(applied.sections[0]).toEqual(sample().sections[0])
    expect(applied.sections[1]?.ranges.map((range) => range.name)).toEqual(['Sommerferien'])
    expect(addHolidays(sample(), 'Unbekannt', 'BE', ranges)).toEqual(sample())
  })

  it('sets the federal state without any holidays', () => {
    const next = setFederalState(sample(), 'Familie B', 'HH')
    expect(next.sections[1]).toMatchObject({ name: 'Familie B', federalState: 'HH', ranges: [] })
    expect(setFederalState(sample(), 'Unbekannt', 'HH')).toEqual(sample())
  })
})

describe('rows', () => {
  it('lists families in order, Chancen last, and families without ranges once', () => {
    const rows = pollRows(sample())
    expect(rows.map((row) => [row.section, row.kind, row.range?.name ?? null])).toEqual([
      ['Familie A', 'family', 'Sommerurlaub'],
      ['Familie B', 'family', null],
      ['Chancen', 'chancen', 'Besuch'],
    ])
  })
})

describe('writer limits', () => {
  const dayOf = (index: number) => new Date(Date.UTC(2027, 0, 1 + index)).toISOString().slice(0, 10)
  const ranges = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      name: `Zeit ${index}`,
      start: dayOf(index),
      end: dayOf(index),
    }))

  it('never makes a family called Chancen', () => {
    expect(addFamily(EMPTY_POLL, 'Chancen')).toBe(EMPTY_POLL)
    expect(addFamily(EMPTY_POLL, ' chancen ')).toBe(EMPTY_POLL)
  })

  it('refuses more than 30 families but still allows the Chancen section', () => {
    let poll = EMPTY_POLL
    for (let index = 0; index < 30; index++) poll = addFamily(poll, `Familie ${index}`)
    expect(poll.sections).toHaveLength(30)
    expect(addFamily(poll, 'Familie 30')).toBe(poll)
    const withChancen = addRange(poll, 'Chancen', summer)
    expect(withChancen.sections).toHaveLength(31)
    expect(pollFromHash(`#${pollToHash(withChancen)}`).sections).toHaveLength(31)
  })

  it('caps the ranges of a section at 200 and skips holidays beyond it', () => {
    let poll = addFamily(EMPTY_POLL, 'A')
    for (const range of ranges(198)) poll = addRange(poll, 'A', range)
    const holidays = ranges(203).slice(198)
    const next = addHolidays(poll, 'A', 'BE', holidays)
    expect(next.sections[0]?.ranges).toHaveLength(200)
    expect(holidaysClipped(next, 'A', holidays)).toBe(true)
    expect(addRange(next, 'A', summer)).toBe(next)
    expect(holidaysClipped(next, 'A', ranges(3))).toBe(false)
  })

  it('trims names and cuts them to the schema lengths on every path', () => {
    let poll = addFamily(EMPTY_POLL, `  ${'F'.repeat(70)} `)
    const family = poll.sections[0]!.name
    expect(family).toHaveLength(60)
    const long = `  ${'x'.repeat(100)}  `
    poll = addRange(poll, family, { name: long, start: '2027-07-01', end: '2027-07-02' })
    poll = addHolidays(poll, family, 'BE', [{ name: long, start: '2027-08-01', end: '2027-08-02' }])
    expect(poll.sections[0]?.ranges.map((range) => range.name)).toEqual([
      'x'.repeat(80),
      'x'.repeat(80),
    ])
  })

  it('ignores an exact duplicate range in the same section', () => {
    const poll = addRange(addFamily(EMPTY_POLL, 'A'), 'A', summer)
    expect(addRange(poll, 'A', summer)).toBe(poll)
    expect(addRange(poll, 'A', { ...summer, name: 'Anderer Name' })).not.toBe(poll)
  })
})
