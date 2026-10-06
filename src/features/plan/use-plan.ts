import { getRouteApi } from '@tanstack/react-router'
import { savedStampNow, today, yearOf } from '@/lib/dates'
import { rememberLastPlan, type LastPlan } from './last-plan'
import type { Plan } from './plan-schema'
import { decodePlan, encodePlan } from './plan-url'

const routeApi = getRouteApi('/')

/** The plan lives in the URL. Reading decodes it, committing writes it back with a new `saved`. */
export function usePlan() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const plan = decodePlan(search.plan)
  const year = search.year ?? yearOf(today())

  /**
   * `history: 'push'` for discrete steps (create, delete, drop) so the back button undoes them,
   * `'replace'` for small follow-up edits such as typing a place name.
   */
  function commit(next: Plan, history: 'push' | 'replace' = 'push') {
    const encoded = encodePlan(next)
    const saved = savedStampNow()
    rememberLastPlan({ plan: encoded, saved, year })
    void navigate({
      search: (previous) => ({ ...previous, plan: encoded, saved }),
      replace: history === 'replace',
    })
  }

  return { plan, commit, year, saved: search.saved, hasPlan: search.plan !== undefined }
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

  function openPlan(lastPlan: LastPlan) {
    void navigate({ search: { year: lastPlan.year, saved: lastPlan.saved, plan: lastPlan.plan } })
  }

  return { year, range, setYear, openRange, closeRange, openPlan }
}
