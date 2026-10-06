import type { Calendar } from '@/features/holidays/periods'
import type { DayRange } from '@/features/plan/plan-actions'
import type { Plan } from '@/features/plan/plan-schema'
import { addDays, isoWeekday, type IsoDay } from '@/lib/dates'

const PADDING_DAYS = 7

export function paddedRange(range: DayRange): DayRange {
  return { start: addDays(range.start, -PADDING_DAYS), end: addDays(range.end, PADDING_DAYS) }
}

/** What to show in the detail view when a day is clicked in the year overview. */
export function zoomRangeForDay(day: IsoDay, plan: Plan, calendar: Calendar): DayRange {
  const entry = plan.entries.find((candidate) => candidate.start <= day && candidate.end >= day)
  const holiday = calendar.schoolHolidays.find(
    (candidate) => candidate.start <= day && candidate.end >= day,
  )
  if (entry && holiday) {
    return paddedRange({
      start: entry.start < holiday.start ? entry.start : holiday.start,
      end: entry.end > holiday.end ? entry.end : holiday.end,
    })
  }
  if (entry) return paddedRange(entry)
  if (holiday) return paddedRange(holiday)
  const monday = addDays(day, 1 - isoWeekday(day))
  return { start: addDays(monday, -7), end: addDays(monday, 20) }
}
