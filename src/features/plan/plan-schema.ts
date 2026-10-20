import { z } from 'zod'
import { isIsoDay, type IsoDay } from '@/lib/dates'

export const PARENT_ROLES = ['mother', 'father'] as const
export type ParentRole = (typeof PARENT_ROLES)[number]

export const CARERS = ['mother', 'father', 'grandparents'] as const
export type Carer = (typeof CARERS)[number]

export type StayKind = 'away' | 'home'

const DEFAULT_LEAVE_DAYS = 30
const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5]
const DEFAULT_FEDERAL_STATE = 'BE'

export type Parent = {
  role: ParentRole
  name: string
  /** ISO weekdays 1 (Monday) … 7 (Sunday) */
  workingDays: number[]
  leaveDaysByYear: Record<number, number>
}

/** A period for the whole family: where we are and who takes care. */
export type FamilyEntry = {
  id: string
  start: IsoDay
  end: IsoDay
  kind: StayKind
  place: string
  note: string
  /** Empty means: care is still open. */
  carers: Carer[]
}

/** Leave one parent takes on their own, unrelated to child care. */
export type PersonalLeave = {
  id: string
  parent: ParentRole
  start: IsoDay
  end: IsoDay
  kind: StayKind
  place: string
  note: string
}

/** A school-free period the family adds on its own, e.g. "Studientag" or "Hort geschlossen". */
export type CustomDay = {
  name: string
  start: IsoDay
  end: IsoDay
}

/**
 * A correction of one imported school or public holiday, identified by its original dates.
 * `replacement: null` removes the holiday.
 */
export type CalendarAdjustment = {
  kind: 'school' | 'public'
  start: IsoDay
  end: IsoDay
  replacement: CustomDay | null
}

/** A period another household is away from home, e.g. the cousins on holiday. */
export type Absence = {
  /** `h0a2`: absence 2 of household 0 */
  id: string
  start: IsoDay
  end: IsoDay
  place: string
  note: string
}

/**
 * Another household we want to see next to our plan, for information only: the grandparents,
 * the cousins. Its school holidays (when a federal state is set) and absences never need care
 * and never cost leave.
 */
export type Household = {
  /** `h0`, positional like all ids */
  id: HouseholdId
  name: string
  /** Federal state code whose school holidays are shown, or null for none. */
  federalState: string | null
  absences: Absence[]
}

export type HouseholdId = `h${number}`

export type Plan = {
  federalState: string
  parents: Record<ParentRole, Parent>
  entries: FamilyEntry[]
  personalLeave: PersonalLeave[]
  customDays: CustomDay[]
  adjustments: CalendarAdjustment[]
  households: Household[]
}

export const PARENT_LABELS: Record<ParentRole, string> = {
  mother: 'Mutter',
  father: 'Vater',
}

const CARER_LABELS: Record<Carer, string> = {
  mother: 'Mutter',
  father: 'Vater',
  grandparents: 'Großeltern',
}

export function parentLabel(plan: Plan, role: ParentRole) {
  return plan.parents[role].name.trim() || PARENT_LABELS[role]
}

export function carerLabel(plan: Plan, carer: Carer) {
  return carer === 'grandparents' ? CARER_LABELS.grandparents : parentLabel(plan, carer)
}

export function leaveBudget(parent: Parent, year: number) {
  return parent.leaveDaysByYear[year] ?? DEFAULT_LEAVE_DAYS
}

function emptyParent(role: ParentRole): Parent {
  return { role, name: '', workingDays: DEFAULT_WORKING_DAYS, leaveDaysByYear: {} }
}

export function emptyPlan(): Plan {
  return {
    federalState: DEFAULT_FEDERAL_STATE,
    parents: { mother: emptyParent('mother'), father: emptyParent('father') },
    entries: [],
    personalLeave: [],
    customDays: [],
    adjustments: [],
    households: [],
  }
}

/**
 * Compact wire format stored in the `plan` URL param. Short keys and tuples keep links short.
 * Bump `v` and add a migration in `plan-url.ts` when this shape changes.
 */
const isoDaySchema = z.string().refine(isIsoDay)
const kindSchema = z.union([z.literal(0), z.literal(1)])

const wireParentSchema = z.object({
  n: z.string().optional(),
  w: z.array(z.number().int().min(1).max(7)),
  l: z.record(z.string(), z.number().min(0).max(366)).optional(),
})

export const wirePlanSchema = z.object({
  v: z.literal(1),
  s: z.string(),
  p: z.tuple([wireParentSchema, wireParentSchema]),
  /** [start, end, kind (0 home, 1 away), carer bitmask, place, note] */
  e: z.array(
    z.tuple([
      isoDaySchema,
      isoDaySchema,
      kindSchema,
      z.number().int().min(0).max(7),
      z.string(),
      z.string(),
    ]),
  ),
  /** [parent (0 mother, 1 father), start, end, kind, place, note] */
  x: z.array(
    z.tuple([
      z.union([z.literal(0), z.literal(1)]),
      isoDaySchema,
      isoDaySchema,
      kindSchema,
      z.string(),
      z.string(),
    ]),
  ),
  /** Own school-free days: [start, end, name]. Left out when empty. */
  d: z.array(z.tuple([isoDaySchema, isoDaySchema, z.string()])).optional(),
  /**
   * Corrected imported holidays:
   * [kind (0 school, 1 public), original start, original end, removed (0/1), start, end, name]
   */
  a: z
    .array(
      z.tuple([
        kindSchema,
        isoDaySchema,
        isoDaySchema,
        kindSchema,
        isoDaySchema,
        isoDaySchema,
        z.string(),
      ]),
    )
    .optional(),
  /** Other households: [name, federal state code or '', [[start, end, place, note], …]] */
  o: z
    .array(
      z.tuple([
        z.string(),
        z.string(),
        z.array(z.tuple([isoDaySchema, isoDaySchema, z.string(), z.string()])),
      ]),
    )
    .optional(),
})

export type WirePlan = z.infer<typeof wirePlanSchema>
