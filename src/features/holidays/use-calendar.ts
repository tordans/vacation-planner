import { useQueries } from '@tanstack/react-query'
import { federalStateByCode } from './federal-states'
import { fetchYearPeriods } from './fetch-periods'
import {
  applyCalendarEdits,
  buildCalendar,
  normalizePeriods,
  type CalendarEdits,
  type YearPeriods,
} from './periods'

/**
 * Holidays for the given years, merged into one day lookup.
 * `source` is what the API delivered, `calendar` is that plus the family's own corrections.
 */
export function useCalendar(federalStateCode: string, years: number[], edits: CalendarEdits) {
  const { slug } = federalStateByCode(federalStateCode)
  return useQueries({
    queries: years.map((year) => ({
      queryKey: ['periods', slug, year],
      queryFn: () => fetchYearPeriods(slug, year),
      staleTime: Infinity,
      retry: 1,
    })),
    combine: (results) => {
      const loaded = results.flatMap((result) => (result.data ? [result.data] : []))
      const source: YearPeriods = {
        schoolHolidays: normalizePeriods(loaded.flatMap((year) => year.schoolHolidays)),
        publicHolidays: normalizePeriods(loaded.flatMap((year) => year.publicHolidays)),
      }
      return {
        source,
        calendar: buildCalendar([applyCalendarEdits(source, edits)]),
        isPending: results.some((result) => result.isPending),
        isError: results.some((result) => result.isError),
        missingYears: years.filter((_, index) => {
          const data = results[index]?.data
          return data !== undefined && data.schoolHolidays.length === 0
        }),
        refetch: () => {
          for (const result of results) {
            if (result.isError) void result.refetch()
          }
        },
      }
    },
  })
}
