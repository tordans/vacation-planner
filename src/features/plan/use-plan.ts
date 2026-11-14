import { getRouteApi } from '@tanstack/react-router'
import { today, yearOf } from '@/lib/dates'
import { usePlanContext } from './plan-context'

const routeApi = getRouteApi('/')

/**
 * The shared plan (see `PlanProvider`). `commit` updates the screen at once and saves a moment
 * later. `readOnly` is true for the view role: every place that changes the plan checks this one
 * flag.
 */
export function usePlan() {
  const { server: _server, ...plan } = usePlanContext()
  return plan
}

/** Loading, conflicts, sign out. */
export function useServerControls() {
  return usePlanContext().server
}

export function useView() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const year = search.year ?? yearOf(today())
  const range =
    search.from && search.to && search.from <= search.to
      ? { start: search.from, end: search.to }
      : null

  function setYear(nextYear: number) {
    void navigate({
      search: (previous) => ({ ...previous, year: nextYear, from: undefined, to: undefined }),
    })
  }

  function openRange(start: string, end: string, history: 'push' | 'replace' = 'push') {
    void navigate({
      search: (previous) => ({ ...previous, year, from: start, to: end }),
      replace: history === 'replace',
    })
  }

  function closeRange() {
    void navigate({ search: (previous) => ({ ...previous, from: undefined, to: undefined }) })
  }

  const showOthers = search.others !== 'hide'

  function setShowOthers(show: boolean) {
    void navigate({
      search: (previous) => ({ ...previous, others: show ? undefined : ('hide' as const) }),
      replace: true,
    })
  }

  return { year, range, setYear, openRange, closeRange, showOthers, setShowOthers }
}
