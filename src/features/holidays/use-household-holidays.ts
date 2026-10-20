import { useQueries } from '@tanstack/react-query'
import type { Household } from '@/features/plan/plan-schema'
import { federalStateByCode } from './federal-states'
import { fetchYearPeriods } from './fetch-periods'
import { normalizePeriods, type Period } from './periods'

/**
 * School holidays of the federal states other households live in, for information only.
 * Shares the query cache with the family's own calendar, so a state is never loaded twice.
 */
export function useHouseholdHolidays(households: Household[], years: number[]) {
  const codes = [
    ...new Set(households.flatMap((household) => household.federalState ?? [])),
  ].toSorted()
  const requests = codes.flatMap((code) => years.map((year) => ({ code, year })))
  return useQueries({
    queries: requests.map(({ code, year }) => {
      const { slug } = federalStateByCode(code)
      return {
        queryKey: ['periods', slug, year],
        queryFn: () => fetchYearPeriods(slug, year),
        staleTime: Infinity,
        retry: 1,
      }
    }),
    combine: (results) => {
      const byState = new Map<string, Period[]>()
      for (const code of codes) {
        const periods = results.flatMap((result, index) =>
          requests[index]?.code === code && result.data ? result.data.schoolHolidays : [],
        )
        byState.set(code, normalizePeriods(periods))
      }
      return byState
    },
  })
}
