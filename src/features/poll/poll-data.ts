import { yearOf } from '@/lib/dates'
import {
  CHANCEN_SECTION,
  isPollDay,
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

function cleanRange(id: string, input: RangeInput): PollRange {
  return { id, name: input.name.trim(), start: input.start, end: input.end }
}

/** Adds a family before the Chancen section. Unchanged (same object) for empty or taken names. */
export function addFamily(poll: Poll, name: string): Poll {
  const trimmed = name.trim()
  if (trimmed === '' || findSection(poll, trimmed)) return poll
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
  const trimmed = to.trim()
  if (trimmed === '' || trimmed === from || isChancen(from) || isChancen(trimmed)) return poll
  if (poll.sections.some((section) => sameName(section.name, trimmed) && section.name !== from)) {
    return poll
  }
  return withSection(poll, from, (section) => ({ ...section, name: trimmed }))
}

export function removeFamily(poll: Poll, name: string): Poll {
  return { ...poll, sections: poll.sections.filter((section) => !sameName(section.name, name)) }
}

/** Adds a range to a family, or to Chancen (created on demand). Unchanged when invalid. */
export function addRange(poll: Poll, sectionName: string, input: RangeInput): Poll {
  if (rangeProblem(input) !== null) return poll
  const range = cleanRange(nextRangeId(poll), input)
  if (findSection(poll, sectionName)) {
    return withSection(poll, sectionName, (section) => ({
      ...section,
      ranges: [...section.ranges, range],
    }))
  }
  if (!isChancen(sectionName)) return poll
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

/** Adds loaded holidays to a family and remembers its federal state. Skips what is already there. */
export function addHolidays(
  poll: Poll,
  familyName: string,
  federalState: string,
  holidays: RangeInput[],
): Poll {
  let next = setFederalState(poll, familyName, federalState)
  for (const holiday of holidays) {
    const existing = findSection(next, familyName)?.ranges ?? []
    const known = existing.some(
      (range) =>
        range.name === holiday.name && range.start === holiday.start && range.end === holiday.end,
    )
    if (!known) next = addRange(next, familyName, holiday)
  }
  return next
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
