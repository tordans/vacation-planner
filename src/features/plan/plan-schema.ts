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

export type Plan = {
  federalState: string
  parents: Record<ParentRole, Parent>
  entries: FamilyEntry[]
  personalLeave: PersonalLeave[]
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
})

export type WirePlan = z.infer<typeof wirePlanSchema>
