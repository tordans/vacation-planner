import { federalStateByCode } from '@/features/holidays/federal-states'
import { fetchYearPeriods } from '@/features/holidays/fetch-periods'
import { holidayRanges } from './holiday-ranges'

/** School holidays (optionally public holidays and bridge days) of a federal state and year. */
export async function fetchHolidayRanges({
  code,
  year,
  withPublicHolidays,
}: {
  code: string
  year: number
  withPublicHolidays: boolean
}) {
  return holidayRanges(
    await fetchYearPeriods(federalStateByCode(code).slug, year),
    withPublicHolidays,
  )
}
