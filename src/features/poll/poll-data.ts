import { yearOf } from '@/lib/dates'
import {
  CHANCEN_SECTION,
  isPollDay,
  MAX_FAMILIES,
  MAX_FAMILY_NAME_LENGTH,
  MAX_RANGE_NAME_LENGTH,
  MAX_RANGES_PER_SECTION,
  MAX_SECTIONS,
  type Poll,
  type PollRange,
  type PollSection,
  type RangeInput,
} from './poll-schema'

function sameName(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export function isChancen(sectionName: string) {
  return sameName(sectionName, CHANCEN_SECTION)
}

export function findSection(poll: Poll, name: string) {
  return poll.sections.find((section) => sameName(section.name, name))
}

/** Families in the order they were added, then the Chancen section. */
export function familiesOf(poll: Poll) {
  return poll.sections.filter((section) => !isChancen(section.name))
}

export function chancenOf(poll: Poll) {
  return poll.sections.find((section) => isChancen(section.name))
}

/** What is wrong with a range the user typed in, in German; `null` when it is fine. */
export function rangeProblem(range: RangeInput) {
  if (range.name.trim() === '') return 'Es fehlt eine Bezeichnung.'
  if (range.start === '' || range.end === '') return 'Es fehlen Start und Ende.'
  if (!isPollDay(range.start) || !isPollDay(range.end)) return 'Das Datum ist ungültig.'
  if (range.end < range.start) return 'Das Ende liegt vor dem Start.'
  return null
}

function nextRangeId(poll: Poll) {
  let highest = 0
  for (const section of poll.sections) {
    for (const range of section.ranges) {
      const match = /^r(\d+)$/.exec(range.id)
      if (match) highest = Math.max(highest, Number(match[1]))
    }
  }
  return `r${highest + 1}`
}

function withSection(
  poll: Poll,
  name: string,
  change: (section: PollSection) => PollSection,
): Poll {
  return {
    ...poll,
    sections: poll.sections.map((section) =>
      sameName(section.name, name) ? change(section) : section,
    ),
  }
}

/** Trimmed and cut to the length the schema accepts; every write path goes through it. */
function cleanName(name: string, maxLength: number) {
  return name.trim().slice(0, maxLength).trim()
}

function cleanInput(input: RangeInput): RangeInput {
  return {
    name: cleanName(input.name, MAX_RANGE_NAME_LENGTH),
    start: input.start,
    end: input.end,
  }
}

function cleanRange(id: string, input: RangeInput): PollRange {
  return { id, ...cleanInput(input) }
}

function sameRange(a: RangeInput, b: RangeInput) {
  return a.name === b.name && a.start === b.start && a.end === b.end
}

/** Adds a family before the Chancen section. Unchanged (same object) for empty, taken or
 * "Chancen" names, and when the poll already has the most families the schema allows. */
export function addFamily(poll: Poll, name: string): Poll {
  const trimmed = cleanName(name, MAX_FAMILY_NAME_LENGTH)
  if (trimmed === '' || isChancen(trimmed) || findSection(poll, trimmed)) return poll
  if (familiesOf(poll).length >= MAX_FAMILIES) return poll
  const family: PollSection = { name: trimmed, ranges: [] }
  const chancenIndex = poll.sections.findIndex((section) => isChancen(section.name))
  if (chancenIndex === -1) return { ...poll, sections: [...poll.sections, family] }
  return {
    ...poll,
    sections: [
      ...poll.sections.slice(0, chancenIndex),
      family,
      ...poll.sections.slice(chancenIndex),
    ],
  }
}

/** Unchanged (same object) when the new name is empty, taken or "Chancen". */
export function renameFamily(poll: Poll, from: string, to: string): Poll {
  const trimmed = cleanName(to, MAX_FAMILY_NAME_LENGTH)
  if (trimmed === '' || trimmed === from || isChancen(from) || isChancen(trimmed)) return poll
  if (poll.sections.some((section) => sameName(section.name, trimmed) && section.name !== from)) {
    return poll
  }
  return withSection(poll, from, (section) => ({ ...section, name: trimmed }))
}

export function removeFamily(poll: Poll, name: string): Poll {
  return { ...poll, sections: poll.sections.filter((section) => !sameName(section.name, name)) }
}

/**
 * Adds a range to a family, or to Chancen (created on demand). Unchanged when invalid, when the
 * section is full or already has the same range, and when Chancen would be one section too many.
 */
export function addRange(poll: Poll, sectionName: string, input: RangeInput): Poll {
  if (rangeProblem(input) !== null) return poll
  const section = findSection(poll, sectionName)
  if (section) {
    if (section.ranges.length >= MAX_RANGES_PER_SECTION) return poll
    if (section.ranges.some((range) => sameRange(range, cleanInput(input)))) return poll
    const range = cleanRange(nextRangeId(poll), input)
    return withSection(poll, sectionName, (current) => ({
      ...current,
      ranges: [...current.ranges, range],
    }))
  }
  if (!isChancen(sectionName) || poll.sections.length >= MAX_SECTIONS) return poll
  const range = cleanRange(nextRangeId(poll), input)
  return { ...poll, sections: [...poll.sections, { name: CHANCEN_SECTION, ranges: [range] }] }
}

/** Changes one range in place. Unchanged when the input is invalid or the range is gone. */
export function updateRange(poll: Poll, sectionName: string, id: string, input: RangeInput): Poll {
  if (rangeProblem(input) !== null) return poll
  return withSection(poll, sectionName, (section) => ({
    ...section,
    ranges: section.ranges.map((range) => (range.id === id ? cleanRange(id, input) : range)),
  }))
}

/** A family without ranges stays; an empty Chancen section disappears. */
export function removeRange(poll: Poll, sectionName: string, id: string): Poll {
  const next = withSection(poll, sectionName, (section) => ({
    ...section,
    ranges: section.ranges.filter((range) => range.id !== id),
  }))
  return {
    ...next,
    sections: next.sections.filter(
      (section) => !(isChancen(section.name) && section.ranges.length === 0),
    ),
  }
}

/** Remembers the federal state of a family for its holiday loader. Unchanged for an unknown family. */
export function setFederalState(poll: Poll, familyName: string, federalState: string): Poll {
  return withSection(poll, familyName, (section) => ({ ...section, federalState }))
}

/**
 * Adds loaded holidays to a family and remembers its federal state. Holidays already there and
 * those beyond the family's limit are skipped (see `holidaysClipped`).
 */
export function addHolidays(
  poll: Poll,
  familyName: string,
  federalState: string,
  holidays: RangeInput[],
): Poll {
  let next = setFederalState(poll, familyName, federalState)
  for (const holiday of holidays) next = addRange(next, familyName, holiday)
  return next
}

/** True when `addHolidays` had to leave some of `holidays` out because the family is full. */
export function holidaysClipped(poll: Poll, familyName: string, holidays: RangeInput[]) {
  const family = findSection(poll, familyName)
  if (!family || family.ranges.length < MAX_RANGES_PER_SECTION) return false
  return holidays.some(
    (holiday) => !family.ranges.some((range) => sameRange(range, cleanInput(holiday))),
  )
}

/** One line of the chart. A family without ranges gets a line with `range: null`. */
export type PollRow = {
  section: string
  kind: 'family' | 'chancen'
  /** Index among the families, picks the colour. */
  familyIndex: number
  range: PollRange | null
  firstInSection: boolean
}

/** Families in order, Chancen last. */
export function pollRows(poll: Poll): PollRow[] {
  const rows: PollRow[] = []
  const add = (section: PollSection, kind: PollRow['kind'], familyIndex: number) => {
    if (section.ranges.length === 0) {
      rows.push({ section: section.name, kind, familyIndex, range: null, firstInSection: true })
    }
    section.ranges.forEach((range, index) => {
      rows.push({ section: section.name, kind, familyIndex, range, firstInSection: index === 0 })
    })
  }
  familiesOf(poll).forEach((family, index) => add(family, 'family', index))
  const chancen = chancenOf(poll)
  if (chancen) add(chancen, 'chancen', 0)
  return rows
}

/** Latest year in the poll, for the default of the holiday loader. */
export function latestYear(poll: Poll): number | null {
  const years = poll.sections.flatMap((section) => section.ranges.map((range) => yearOf(range.end)))
  return years.length === 0 ? null : Math.max(...years)
}
