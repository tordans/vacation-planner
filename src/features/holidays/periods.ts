import { addDays, eachDay, isoWeekday, type IsoDay } from '@/lib/dates'

export type Period = {
  name: string
  start: IsoDay
  end: IsoDay
}

export type YearPeriods = {
  schoolHolidays: Period[]
  publicHolidays: Period[]
}

const SCHOOL_HOLIDAY_LABELS: Record<string, string> = {
  Winter: 'Winterferien',
  Sommer: 'Sommerferien',
  Herbst: 'Herbstferien',
  Frühjahr: 'Frühjahrsferien',
  Ostern: 'Osterferien',
  Pfingsten: 'Pfingstferien',
  Weihnachten: 'Weihnachtsferien',
  Himmelfahrt: 'Himmelfahrt (schulfrei)',
}

export function schoolHolidayLabel(apiName: string) {
  return SCHOOL_HOLIDAY_LABELS[apiName] ?? apiName
}

/** Sorts by start and merges rows with an identical range (the API returns some twice). */
export function normalizePeriods(periods: Period[]): Period[] {
  const byRange = new Map<string, Period>()
  for (const period of periods) {
    const key = `${period.start}|${period.end}`
    const existing = byRange.get(key)
    if (!existing) {
      byRange.set(key, period)
    } else if (!existing.name.split(' / ').includes(period.name)) {
      byRange.set(key, { ...existing, name: `${existing.name} / ${period.name}` })
    }
  }
  return [...byRange.values()].toSorted((a, b) => a.start.localeCompare(b.start))
}

const MONDAY = 1
const TUESDAY = 2
const THURSDAY = 4
const FRIDAY = 5

/**
 * A bridge day is the single working day between a public holiday and the weekend:
 * the Friday after a Thursday holiday, the Monday before a Tuesday holiday.
 * Days that are public holidays themselves are not bridge days.
 */
export function deriveBridgeDays(publicHolidays: Period[]): IsoDay[] {
  const holidayDays = new Set(publicHolidays.flatMap((period) => eachDay(period.start, period.end)))
  const bridgeDays = new Set<IsoDay>()
  for (const day of holidayDays) {
    const weekday = isoWeekday(day)
    const candidate =
      weekday === THURSDAY ? addDays(day, 1) : weekday === TUESDAY ? addDays(day, -1) : null
    if (!candidate || holidayDays.has(candidate)) continue
    const candidateWeekday = isoWeekday(candidate)
    if (candidateWeekday === FRIDAY || candidateWeekday === MONDAY) bridgeDays.add(candidate)
  }
  return [...bridgeDays].toSorted()
}

/** Family-specific corrections on top of the imported holidays. */
export type CalendarEdits = {
  customDays: Period[]
  adjustments: Array<{
    kind: 'school' | 'public'
    start: IsoDay
    end: IsoDay
    replacement: Period | null
  }>
}

/** Corrects or removes imported holidays and adds the family's own school-free days. */
export function applyCalendarEdits(source: YearPeriods, edits: CalendarEdits): YearPeriods {
  const adjust = (kind: 'school' | 'public', periods: Period[]) =>
    periods.flatMap((period) => {
      const adjustment = edits.adjustments.find(
        (candidate) =>
          candidate.kind === kind &&
          candidate.start === period.start &&
          candidate.end === period.end,
      )
      if (!adjustment) return [period]
      return adjustment.replacement ? [adjustment.replacement] : []
    })
  return {
    schoolHolidays: normalizePeriods([
      ...adjust('school', source.schoolHolidays),
      ...edits.customDays,
    ]),
    publicHolidays: normalizePeriods(adjust('public', source.publicHolidays)),
  }
}

type DayInfo = {
  schoolHoliday?: string
  publicHoliday?: string
  bridgeDay?: boolean
}

export type Calendar = {
  schoolHolidays: Period[]
  publicHolidays: Period[]
  bridgeDays: IsoDay[]
  days: Map<IsoDay, DayInfo>
}

export function buildCalendar(years: YearPeriods[]): Calendar {
  const schoolHolidays = normalizePeriods(years.flatMap((year) => year.schoolHolidays))
  const publicHolidays = normalizePeriods(years.flatMap((year) => year.publicHolidays))
  const bridgeDays = deriveBridgeDays(publicHolidays)
  const days = new Map<IsoDay, DayInfo>()
  const info = (day: IsoDay) => {
    let entry = days.get(day)
    if (!entry) {
      entry = {}
      days.set(day, entry)
    }
    return entry
  }
  for (const period of schoolHolidays) {
    for (const day of eachDay(period.start, period.end)) info(day).schoolHoliday = period.name
  }
  for (const period of publicHolidays) {
    for (const day of eachDay(period.start, period.end)) info(day).publicHoliday = period.name
  }
  for (const day of bridgeDays) info(day).bridgeDay = true
  return { schoolHolidays, publicHolidays, bridgeDays, days }
}
