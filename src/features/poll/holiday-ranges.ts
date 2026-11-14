import { deriveBridgeDays, type YearPeriods } from '@/features/holidays/periods'
import type { RangeInput } from './poll-schema'

const BRIDGE_DAY_NAME = 'Brückentag'

/**
 * School holidays as ranges, optionally with public holidays and bridge days.
 * Public holidays can run across the turn of the year, so both years list some twice: the caller
 * skips what is already in the poll.
 */
export function holidayRanges(periods: YearPeriods, withPublicHolidays: boolean): RangeInput[] {
  const ranges: RangeInput[] = periods.schoolHolidays.map(({ name, start, end }) => ({
    name,
    start,
    end,
  }))
  if (withPublicHolidays) {
    for (const { name, start, end } of periods.publicHolidays) ranges.push({ name, start, end })
    for (const day of deriveBridgeDays(periods.publicHolidays)) {
      ranges.push({ name: BRIDGE_DAY_NAME, start: day, end: day })
    }
  }
  return ranges.toSorted((a, b) => a.start.localeCompare(b.start))
}
