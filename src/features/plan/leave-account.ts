import type { Calendar } from '@/features/holidays/periods'
import { eachDay, isoWeekday, yearOf, type IsoDay } from '@/lib/dates'
import type { DayRange } from './plan-actions'
import { leaveBudget, type Parent, type ParentRole, type Plan } from './plan-schema'

export type LeaveCategory = 'care' | 'family' | 'personal'

export const LEAVE_CATEGORY_LABELS: Record<LeaveCategory, string> = {
  care: 'Betreuung zu Hause',
  family: 'Familienurlaub',
  personal: 'Eigener Urlaub',
}

/** A day off costs a leave day only on the parent's working days that are not public holidays. */
export function costsLeave(parent: Parent, day: IsoDay, calendar: Calendar) {
  if (!parent.workingDays.includes(isoWeekday(day))) return false
  return calendar.days.get(day)?.publicHoliday === undefined
}

/** Every day the parent is off, with its category. A day is never counted twice. */
function leaveDays(plan: Plan, role: ParentRole, calendar: Calendar) {
  const parent = plan.parents[role]
  const days = new Map<IsoDay, LeaveCategory>()
  for (const leave of plan.personalLeave) {
    if (leave.parent !== role) continue
    for (const day of eachDay(leave.start, leave.end)) {
      if (costsLeave(parent, day, calendar)) days.set(day, 'personal')
    }
  }
  // Family entries win over personal leave on the same day.
  for (const entry of plan.entries) {
    if (!entry.carers.includes(role)) continue
    const category = entry.kind === 'away' ? 'family' : 'care'
    for (const day of eachDay(entry.start, entry.end)) {
      if (costsLeave(parent, day, calendar)) days.set(day, category)
    }
  }
  return days
}

type LeaveAccount = Record<LeaveCategory, number> & {
  budget: number
  planned: number
  remaining: number
}

/** Leave is attributed to the calendar year of each day. */
export function leaveAccount(plan: Plan, role: ParentRole, year: number, calendar: Calendar) {
  const account: LeaveAccount = {
    care: 0,
    family: 0,
    personal: 0,
    budget: leaveBudget(plan.parents[role], year),
    planned: 0,
    remaining: 0,
  }
  for (const [day, category] of leaveDays(plan, role, calendar)) {
    if (yearOf(day) !== year) continue
    account[category] += 1
    account.planned += 1
  }
  account.remaining = account.budget - account.planned
  return account
}

/** Leave days a single period costs the parent (all years it touches). */
export function rangeCost(plan: Plan, role: ParentRole, range: DayRange, calendar: Calendar) {
  const parent = plan.parents[role]
  return eachDay(range.start, range.end).filter((day) => costsLeave(parent, day, calendar)).length
}
