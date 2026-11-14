import type { Period, YearPeriods } from '@/features/holidays/periods'
import { addDays, eachDay, isIsoDay, isoWeekday, type IsoDay } from '@/lib/dates'

/** Longest name a school-free day may have (same limit as the form). */
const NAME_MAX_LENGTH = 60

function unescapeText(value: string) {
  return value.replace(/\\([\\,;nN])/g, (_, char: string) =>
    char === 'n' || char === 'N' ? ' ' : char,
  )
}

/** `20270129` or `20270129T080000Z` → `2027-01-29`; the time is ignored. */
function dayFrom(value: string): IsoDay | null {
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(value)
  if (!match) return null
  const day = `${match[1]}-${match[2]}-${match[3]}`
  return isIsoDay(day) ? day : null
}

type DateProperty = { day: IsoDay; isDate: boolean; time: string }

function dateProperty(params: string, value: string): DateProperty | null {
  const day = dayFrom(value)
  if (!day) return null
  const isDate = /;VALUE=DATE(;|$)/i.test(params) || !value.includes('T')
  return { day, isDate, time: value.split('T')[1]?.slice(0, 6) ?? '' }
}

/**
 * The events of an iCalendar file as day ranges (end inclusive), sorted by start.
 * All-day events end the day before `DTEND` (which is exclusive); timed events keep their dates.
 * Recurrence rules are ignored (only the first occurrence counts), cancelled events are skipped.
 */
export function parseIcs(text: string): Period[] {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)
  const events = new Map<string, Period>()
  const stack: string[] = []
  let current: { name: string; start?: DateProperty; end?: DateProperty; cancelled: boolean } = {
    name: '',
    cancelled: false,
  }

  for (const line of lines) {
    const colon = line.indexOf(':')
    if (colon < 0) continue
    const head = line.slice(0, colon)
    const value = line.slice(colon + 1).trim()
    const semicolon = head.indexOf(';')
    const property = (semicolon < 0 ? head : head.slice(0, semicolon)).toUpperCase()
    const params = semicolon < 0 ? '' : head.slice(semicolon)

    if (property === 'BEGIN') {
      stack.push(value.toUpperCase())
      if (value.toUpperCase() === 'VEVENT') current = { name: '', cancelled: false }
      continue
    }
    if (property === 'END') {
      const closed = stack.pop()
      if (closed !== 'VEVENT' || !current.start || current.cancelled) continue
      const { start } = current
      let end = current.end?.day ?? start.day
      if (current.end && (start.isDate || current.end.time === '000000') && end > start.day) {
        end = addDays(end, -1)
      }
      if (end < start.day) end = start.day
      const name = current.name.slice(0, NAME_MAX_LENGTH).trim() || 'Schulfrei'
      events.set(`${start.day}|${end}|${name}`, { name, start: start.day, end })
      continue
    }
    if (stack.at(-1) !== 'VEVENT') continue
    if (property === 'SUMMARY') current.name = unescapeText(value).replace(/\s+/g, ' ').trim()
    if (property === 'DTSTART') current.start = dateProperty(params, value) ?? undefined
    if (property === 'DTEND') current.end = dateProperty(params, value) ?? undefined
    if (property === 'STATUS' && value.toUpperCase() === 'CANCELLED') current.cancelled = true
  }

  return [...events.values()].toSorted(
    (a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end),
  )
}

/**
 * `added`: this range is already one of the family's own days.
 * `known`: every weekday in it is already school-free (holidays, public holidays, own days).
 * `new`: at least one weekday would become school-free.
 */
export type ImportStatus = 'added' | 'known' | 'new'

export function importStatus(
  event: Period,
  calendar: YearPeriods,
  customDays: Period[],
): ImportStatus {
  if (customDays.some((day) => day.start === event.start && day.end === event.end)) {
    return 'added'
  }
  const free = new Set(
    [...calendar.schoolHolidays, ...calendar.publicHolidays].flatMap((period) =>
      eachDay(period.start, period.end),
    ),
  )
  const isNew = eachDay(event.start, event.end).some(
    (day) => isoWeekday(day) <= 5 && !free.has(day),
  )
  return isNew ? 'new' : 'known'
}
