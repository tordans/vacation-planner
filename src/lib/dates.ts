import { tz, TZDate } from '@date-fns/tz'
import {
  addDays as addDaysFn,
  differenceInCalendarDays,
  format,
  getISODay,
  getISOWeek,
  intlFormatDistance,
} from 'date-fns'
import { de } from 'date-fns/locale'

const APP_TIME_ZONE = 'Europe/Berlin'

const appTz = tz(APP_TIME_ZONE)
const dateOptions = { in: appTz, locale: de } as const

/** Calendar day as `yyyy-MM-dd`. All plan data uses this form. */
export type IsoDay = string

const ISO_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function isIsoDay(value: string): value is IsoDay {
  if (!ISO_DAY_PATTERN.test(value)) return false
  return toIsoDay(parseDay(value)) === value
}

function parseDay(day: IsoDay) {
  const year = Number(day.slice(0, 4))
  const month = Number(day.slice(5, 7))
  const date = Number(day.slice(8, 10))
  return new TZDate(year, month - 1, date, APP_TIME_ZONE)
}

function toIsoDay(date: Date): IsoDay {
  return format(date, 'yyyy-MM-dd', dateOptions)
}

export function today(now: number = Date.now()): IsoDay {
  return toIsoDay(new TZDate(now, APP_TIME_ZONE))
}

export function addDays(day: IsoDay, amount: number): IsoDay {
  return toIsoDay(addDaysFn(parseDay(day), amount))
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: IsoDay, to: IsoDay) {
  return differenceInCalendarDays(parseDay(to), parseDay(from))
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(day: IsoDay) {
  return getISODay(parseDay(day))
}

export function isoWeek(day: IsoDay) {
  return getISOWeek(parseDay(day))
}

export function yearOf(day: IsoDay) {
  return Number(day.slice(0, 4))
}

export function eachDay(start: IsoDay, end: IsoDay): IsoDay[] {
  const count = daysBetween(start, end)
  const days: IsoDay[] = []
  for (let index = 0; index <= count; index++) {
    days.push(addDays(start, index))
  }
  return days
}

export function minDay(a: IsoDay, b: IsoDay) {
  return a <= b ? a : b
}

export function maxDay(a: IsoDay, b: IsoDay) {
  return a >= b ? a : b
}

export function formatDay(day: IsoDay, pattern: string) {
  return format(parseDay(day), pattern, dateOptions)
}

/** "Mo, 12.07.2027" */
export function formatDayShort(day: IsoDay) {
  return formatDay(day, 'EEEEEE, dd.MM.yyyy')
}

/** "Montag, 12. Juli 2027" */
export function formatDayFull(day: IsoDay) {
  return formatDay(day, 'EEEE, d. MMMM yyyy')
}

/** "12.–30.07.2027", "28.07.–03.08.2027" or "20.12.2027–02.01.2028" */
export function formatDayRange(start: IsoDay, end: IsoDay) {
  if (start === end) return formatDay(start, 'dd.MM.yyyy')
  if (start.slice(0, 7) === end.slice(0, 7)) {
    return `${formatDay(start, 'dd.')}–${formatDay(end, 'dd.MM.yyyy')}`
  }
  if (yearOf(start) === yearOf(end)) {
    return `${formatDay(start, 'dd.MM.')}–${formatDay(end, 'dd.MM.yyyy')}`
  }
  return `${formatDay(start, 'dd.MM.yyyy')}–${formatDay(end, 'dd.MM.yyyy')}`
}

function relative(amount: number, unit: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year') {
  const base = new Date(0)
  const scale = { minute: 60_000, hour: 3_600_000, day: 86_400_000, week: 604_800_000 }
  if (unit === 'month' || unit === 'year') {
    const months = unit === 'month' ? amount : amount * 12
    return intlFormatDistance(new Date(Date.UTC(1970, months, 1)), base, {
      unit,
      locale: 'de',
      numeric: 'always',
    })
  }
  return intlFormatDistance(new Date(amount * scale[unit]), base, {
    unit,
    locale: 'de',
    numeric: 'always',
  })
}

/** Days up to two weeks, then weeks, months and years, always rounded down. */
function relativeDays(distance: number) {
  const size = Math.abs(distance)
  if (size < 14) return relative(distance, 'day')
  if (size < 60) return relative(Math.trunc(distance / 7), 'week')
  if (size < 730) return relative(Math.trunc(distance / 30.44), 'month')
  return relative(Math.trunc(distance / 365.25), 'year')
}

/** "heute", "morgen", "in 3 Wochen", "vor 2 Tagen" */
export function formatDayRelative(day: IsoDay, now: number = Date.now()) {
  const base = today(now)
  const distance = daysBetween(base, day)
  if (distance === 0) return 'heute'
  if (distance === 1) return 'morgen'
  if (distance === -1) return 'gestern'
  return relativeDays(distance)
}

/** Minute-precision local timestamp `yyyy-MM-ddTHH:mm` used for the `saved` URL param. */
export type SavedStamp = string

const SAVED_STAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

export function isSavedStamp(value: string): value is SavedStamp {
  return SAVED_STAMP_PATTERN.test(value) && isIsoDay(value.slice(0, 10))
}

export function savedStampNow(now: number = Date.now()): SavedStamp {
  return format(new TZDate(now, APP_TIME_ZONE), "yyyy-MM-dd'T'HH:mm", dateOptions)
}

function parseSavedStamp(stamp: SavedStamp) {
  const day = parseDay(stamp.slice(0, 10))
  return new TZDate(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    Number(stamp.slice(11, 13)),
    Number(stamp.slice(14, 16)),
    APP_TIME_ZONE,
  )
}

/** "06.10.2026 14:32" */
export function formatSavedCompact(stamp: SavedStamp) {
  return format(parseSavedStamp(stamp), 'dd.MM.yyyy HH:mm', dateOptions)
}

/** "Di, 06.10.2026, 14:32 Uhr" */
export function formatSavedFull(stamp: SavedStamp) {
  return `${format(parseSavedStamp(stamp), 'EEEEEE, dd.MM.yyyy, HH:mm', dateOptions)} Uhr`
}

/** "vor 3 Wochen", "vor 5 Minuten", "gerade eben" */
export function formatSavedRelative(stamp: SavedStamp, now: number = Date.now()) {
  const saved = parseSavedStamp(stamp).getTime()
  if (Math.abs(now - saved) < 60_000) return 'gerade eben'
  const minutes = Math.round((saved - now) / 60_000)
  if (Math.abs(minutes) < 60) return relative(minutes, 'minute')
  if (Math.abs(minutes) < 24 * 60) return relative(Math.trunc(minutes / 60), 'hour')
  return relativeDays(-savedAgeInDays(stamp, now))
}

export function savedAgeInDays(stamp: SavedStamp, now: number = Date.now()) {
  return daysBetween(stamp.slice(0, 10), today(now))
}

export const MONTH_NAMES = Array.from({ length: 12 }, (_, month) =>
  format(new TZDate(2027, month, 1, APP_TIME_ZONE), 'LLLL', dateOptions),
)

export const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const
