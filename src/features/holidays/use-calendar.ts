import { useQueries } from '@tanstack/react-query'
import { federalStateByCode } from './federal-states'
import { fetchYearPeriods } from './fetch-periods'
import { buildCalendar } from './periods'

/** Holidays for the given years, merged into one day lookup. */
export function useCalendar(federalStateCode: string, years: number[]) {
  const { slug } = federalStateByCode(federalStateCode)
  return useQueries({
    queries: years.map((year) => ({
      queryKey: ['periods', slug, year],
      queryFn: () => fetchYearPeriods(slug, year),
      staleTime: Infinity,
      retry: 1,
    })),
    combine: (results) => ({
      calendar: buildCalendar(results.flatMap((result) => (result.data ? [result.data] : []))),
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
    }),
  })
}
