import { addDays, daysBetween, type IsoDay } from '@/lib/dates'
import type {
  CalendarAdjustment,
  Carer,
  CustomDay,
  FamilyEntry,
  Household,
  HouseholdId,
  Parent,
  ParentRole,
  PersonalLeave,
  Plan,
} from './plan-schema'
import { fixedEntries } from './plan-schema'
import { withFreshIds } from './plan-url'

export type DayRange = { start: IsoDay; end: IsoDay }

/** Wide enough for any plan; used where a bar is not limited to the visible range. */
export const ANY_DAY: DayRange = { start: '1990-01-01', end: '2100-12-31' }

function overlaps(a: DayRange, b: DayRange) {
  return a.start <= b.end && a.end >= b.start
}

export function touchesYear(range: DayRange, year: number) {
  return overlaps(range, { start: `${year}-01-01`, end: `${year}-12-31` })
}

export function addEntry(plan: Plan, range: DayRange, isIdea = false): { plan: Plan; id: string } {
  const entry: FamilyEntry = {
    id: '',
    ...range,
    kind: 'home',
    place: '',
    note: '',
    carers: [],
    isIdea,
  }
  const next = withFreshIds({ ...plan, entries: [...plan.entries, entry] })
  return { plan: next, id: next.entries.at(-1)!.id }
}

export function updateEntry(plan: Plan, id: string, patch: Partial<Omit<FamilyEntry, 'id'>>): Plan {
  return {
    ...plan,
    entries: plan.entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
  }
}

export function removeEntry(plan: Plan, id: string): Plan {
  return withFreshIds({ ...plan, entries: plan.entries.filter((entry) => entry.id !== id) })
}

export function toggleCarer(plan: Plan, id: string, carer: Carer): Plan {
  const entry = plan.entries.find((candidate) => candidate.id === id)
  if (!entry) return plan
  const carers = entry.carers.includes(carer)
    ? entry.carers.filter((candidate) => candidate !== carer)
    : [...entry.carers, carer]
  return updateEntry(plan, id, { carers })
}

/** Splits an entry so care can differ between the two parts. `firstDayOfSecond` starts part two. */
export function splitEntry(plan: Plan, id: string, firstDayOfSecond: IsoDay): Plan {
  const entry = plan.entries.find((candidate) => candidate.id === id)
  if (!entry || firstDayOfSecond <= entry.start || firstDayOfSecond > entry.end) return plan
  const first = { ...entry, end: addDays(firstDayOfSecond, -1) }
  const second = { ...entry, start: firstDayOfSecond }
  return withFreshIds({
    ...plan,
    entries: plan.entries.flatMap((candidate) =>
      candidate.id === id ? [first, second] : [candidate],
    ),
  })
}

export function middleOf(range: DayRange): IsoDay {
  return addDays(range.start, Math.ceil((daysBetween(range.start, range.end) + 1) / 2))
}

export function addPersonalLeave(
  plan: Plan,
  parent: ParentRole,
  range: DayRange,
): { plan: Plan; id: string } {
  const leave: PersonalLeave = { id: '', parent, ...range, kind: 'home', place: '', note: '' }
  const next = withFreshIds({ ...plan, personalLeave: [...plan.personalLeave, leave] })
  return { plan: next, id: next.personalLeave.at(-1)!.id }
}

export function updatePersonalLeave(
  plan: Plan,
  id: string,
  patch: Partial<Omit<PersonalLeave, 'id' | 'parent'>>,
): Plan {
  return {
    ...plan,
    personalLeave: plan.personalLeave.map((leave) =>
      leave.id === id ? { ...leave, ...patch } : leave,
    ),
  }
}

export function removePersonalLeave(plan: Plan, id: string): Plan {
  return withFreshIds({
    ...plan,
    personalLeave: plan.personalLeave.filter((leave) => leave.id !== id),
  })
}

export function updateParent(
  plan: Plan,
  role: ParentRole,
  patch: Partial<Omit<Parent, 'role'>>,
): Plan {
  return { ...plan, parents: { ...plan.parents, [role]: { ...plan.parents[role], ...patch } } }
}

export function addCustomDay(plan: Plan, day: CustomDay): Plan {
  return { ...plan, customDays: [...plan.customDays, day] }
}

export function updateCustomDay(plan: Plan, index: number, patch: Partial<CustomDay>): Plan {
  return {
    ...plan,
    customDays: plan.customDays.map((day, position) =>
      position === index ? { ...day, ...patch } : day,
    ),
  }
}

export function removeCustomDay(plan: Plan, index: number): Plan {
  return { ...plan, customDays: plan.customDays.filter((_, position) => position !== index) }
}

/**
 * Corrects or removes (`replacement: null`) one imported holiday.
 * `replacement: undefined` drops the correction, so the imported dates apply again.
 */
export function adjustHoliday(
  plan: Plan,
  original: Pick<CalendarAdjustment, 'kind' | 'start' | 'end'>,
  replacement: CustomDay | null | undefined,
): Plan {
  const others = plan.adjustments.filter(
    (adjustment) =>
      adjustment.kind !== original.kind ||
      adjustment.start !== original.start ||
      adjustment.end !== original.end,
  )
  if (replacement === undefined) return { ...plan, adjustments: others }
  return {
    ...plan,
    adjustments: [
      ...others,
      { kind: original.kind, start: original.start, end: original.end, replacement },
    ],
  }
}

export function isHouseholdId(value: string): value is HouseholdId {
  return /^h\d+$/.test(value)
}

export function addHousehold(
  plan: Plan,
  household: Pick<Household, 'name' | 'federalState'>,
): { plan: Plan; id: HouseholdId } {
  const next = withFreshIds({
    ...plan,
    households: [...plan.households, { ...household, id: 'h0', absences: [] }],
  })
  return { plan: next, id: next.households.at(-1)!.id }
}

export function updateHousehold(
  plan: Plan,
  id: HouseholdId,
  patch: Partial<Pick<Household, 'name' | 'federalState'>>,
): Plan {
  return {
    ...plan,
    households: plan.households.map((household) =>
      household.id === id ? { ...household, ...patch } : household,
    ),
  }
}

export function removeHousehold(plan: Plan, id: HouseholdId): Plan {
  return withFreshIds({
    ...plan,
    households: plan.households.filter((household) => household.id !== id),
  })
}

/** The household an absence id (`h1a3`) belongs to. */
export function householdOfAbsence(absenceId: string): HouseholdId | null {
  const match = /^(h\d+)a\d+$/.exec(absenceId)
  return match ? (match[1] as HouseholdId) : null
}

export function addAbsence(
  plan: Plan,
  householdId: HouseholdId,
  range: DayRange,
): { plan: Plan; id: string } {
  const next = withFreshIds({
    ...plan,
    households: plan.households.map((household) =>
      household.id === householdId
        ? {
            ...household,
            absences: [...household.absences, { id: '', ...range, place: '', note: '' }],
          }
        : household,
    ),
  })
  const household = next.households.find((candidate) => candidate.id === householdId)
  return { plan: next, id: household?.absences.at(-1)?.id ?? '' }
}

export function updateAbsence(
  plan: Plan,
  absenceId: string,
  patch: Partial<Omit<Household['absences'][number], 'id'>>,
): Plan {
  return {
    ...plan,
    households: plan.households.map((household) => ({
      ...household,
      absences: household.absences.map((absence) =>
        absence.id === absenceId ? { ...absence, ...patch } : absence,
      ),
    })),
  }
}

export function removeAbsence(plan: Plan, absenceId: string): Plan {
  return withFreshIds({
    ...plan,
    households: plan.households.map((household) => ({
      ...household,
      absences: household.absences.filter((absence) => absence.id !== absenceId),
    })),
  })
}

/**
 * Ranges a bar must not overlap.
 * Fixed family entries block each other (ideas block nothing); a parent's personal leave is blocked by their other
 * personal leave and by family entries where they already are a carer.
 */
export function blockersFor(
  plan: Plan,
  target: { row: 'family' } | { row: ParentRole } | { row: HouseholdId },
  ignoreId?: string,
): DayRange[] {
  if (target.row === 'family') {
    // Ideas overlap anything; fixed entries are blocked by the other fixed ones.
    if (plan.entries.find((entry) => entry.id === ignoreId)?.isIdea) return []
    return fixedEntries(plan).filter((entry) => entry.id !== ignoreId)
  }
  if (isHouseholdId(target.row)) {
    const household = plan.households.find((candidate) => candidate.id === target.row)
    return household?.absences.filter((absence) => absence.id !== ignoreId) ?? []
  }
  const role = target.row
  return [
    ...plan.personalLeave.filter((leave) => leave.parent === role && leave.id !== ignoreId),
    ...fixedEntries(plan).filter((entry) => entry.carers.includes(role)),
  ]
}

/**
 * The free window around `anchor` between the neighbouring blockers, limited to `limits`.
 * Returns null when `anchor` itself is blocked.
 */
export function freeWindow(
  blockers: DayRange[],
  anchor: DayRange,
  limits: DayRange,
): DayRange | null {
  let start = limits.start
  let end = limits.end
  for (const blocker of blockers) {
    if (overlaps(blocker, anchor)) return null
    if (blocker.end < anchor.start) {
      const candidate = addDays(blocker.end, 1)
      if (candidate > start) start = candidate
    } else {
      const candidate = addDays(blocker.start, -1)
      if (candidate < end) end = candidate
    }
  }
  return start <= anchor.start && end >= anchor.end ? { start, end } : null
}

/**
 * Where an existing bar may go. Blockers it already overlaps (e.g. after a parent was added as
 * carer on top of their own leave) are ignored, so the bar can always be moved out again.
 */
export function movableWindow(blockers: DayRange[], bar: DayRange, limits: DayRange): DayRange {
  const outside = blockers.filter((blocker) => !overlaps(blocker, bar))
  return freeWindow(outside, bar, limits) ?? limits
}
