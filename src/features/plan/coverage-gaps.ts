import type { Calendar } from '@/features/holidays/periods'
import { eachDay, isoWeekday, yearOf, type IsoDay } from '@/lib/dates'
import type { Plan } from './plan-schema'

/**
 * School-free weekdays in the year nobody is planned for yet:
 * no family entry at all, or an entry whose care is still open.
 */
export function coverageGaps(plan: Plan, year: number, calendar: Calendar): Set<IsoDay> {
  const covered = new Set<IsoDay>()
  for (const entry of plan.entries) {
    if (entry.carers.length === 0) continue
    for (const day of eachDay(entry.start, entry.end)) covered.add(day)
  }
  const gaps = new Set<IsoDay>()
  for (const [day, info] of calendar.days) {
    if (yearOf(day) !== year) continue
    if (info.schoolHoliday === undefined || info.publicHoliday !== undefined) continue
    if (isoWeekday(day) > 5 || covered.has(day)) continue
    gaps.add(day)
  }
  return gaps
}
