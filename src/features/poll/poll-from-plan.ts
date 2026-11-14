import type { Period } from '@/features/holidays/periods'
import { touchesYear } from '@/features/plan/plan-actions'
import type { FamilyEntry, Plan } from '@/features/plan/plan-schema'
import { addFamily, addHolidays, addRange, isChancen } from './poll-data'
import { CHANCEN_SECTION, MAX_FAMILY_NAME_LENGTH, MAX_TITLE_LENGTH, type Poll } from './poll-schema'

const FALLBACK_FAMILY_NAME = 'Unsere Familie'
const IDEA_NAME = 'Idee'

/** The parents' names joined with " & " (those that are set), else "Unsere Familie". */
export function defaultFamilyName(plan: Plan) {
  const names = [plan.parents.mother.name, plan.parents.father.name]
    .map((name) => name.trim())
    .filter((name) => name !== '')
  return names.length > 0 ? names.join(' & ') : FALLBACK_FAMILY_NAME
}

/** Ideas that touch the year, the candidates for Chancen. */
export function ideasOfYear(plan: Plan, year: number): FamilyEntry[] {
  return plan.entries.filter((entry) => entry.isIdea && touchesYear(entry, year))
}

type PollFromPlanOptions = {
  title: string
  familyName: string
  year: number
  /** The family's school holidays (corrected calendar); `null` leaves them out. */
  schoolHolidays: Period[] | null
  withIdeas: boolean
}

/** A new poll with the plan's family, optionally with its school holidays and ideas as Chancen. */
export function pollFromPlan(plan: Plan, options: PollFromPlanOptions): Poll {
  const requested = options.familyName.trim().slice(0, MAX_FAMILY_NAME_LENGTH).trim()
  // "Chancen" is the section for shared windows, not a family.
  const familyName = requested === '' || isChancen(requested) ? FALLBACK_FAMILY_NAME : requested
  const title = options.title.trim().slice(0, MAX_TITLE_LENGTH)
  let poll = addFamily(title === '' ? { sections: [] } : { title, sections: [] }, familyName)
  if (options.schoolHolidays !== null) {
    const holidays = options.schoolHolidays.filter((period) => touchesYear(period, options.year))
    poll = addHolidays(poll, familyName, plan.federalState, holidays)
  }
  if (options.withIdeas) {
    for (const idea of ideasOfYear(plan, options.year)) {
      poll = addRange(poll, CHANCEN_SECTION, {
        name: idea.place.trim() || IDEA_NAME,
        start: idea.start,
        end: idea.end,
      })
    }
  }
  return poll
}
