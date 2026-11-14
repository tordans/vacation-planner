import type { Plan } from '@/features/plan/plan-schema'
import { encodePlan } from '@/features/plan/plan-url'
import type { SavedStamp } from '@/lib/dates'
import { routerSearch } from '@/lib/router-search'

/**
 * The plan as a link without a server, in the format used before the shared plan existed.
 * `base` is the page address without query and fragment; the key is never part of it.
 */
export function snapshotLink({
  base,
  plan,
  year,
  saved,
  showOthers,
}: {
  base: string
  plan: Plan
  year: number
  saved: SavedStamp
  showOthers: boolean
}) {
  const search = routerSearch.stringify({
    year,
    others: showOthers ? undefined : 'hide',
    saved,
    plan: encodePlan(plan),
  })
  return `${base}${search}`
}
