import { z } from 'zod'
import { FEDERAL_STATES } from '@/features/holidays/federal-states'
import { isIsoDay, yearOf, type IsoDay } from '@/lib/dates'

/** The one section that is not a family: windows in which everyone could meet. */
export const CHANCEN_SECTION = 'Chancen'

export const MAX_TITLE_LENGTH = 80
/** Writers stop at these caps; the schema reads anything beyond them as an empty poll. */
export const MAX_FAMILIES = 30
/** All families plus the Chancen section. */
export const MAX_SECTIONS = MAX_FAMILIES + 1
export const MAX_RANGES_PER_SECTION = 200
export const MAX_FAMILY_NAME_LENGTH = 60
export const MAX_RANGE_NAME_LENGTH = 80
const FIRST_YEAR = 1990
const LAST_YEAR = 2100
export const MIN_DAY: IsoDay = `${FIRST_YEAR}-01-01`
export const MAX_DAY: IsoDay = `${LAST_YEAR}-12-31`

/** A real calendar day in a sensible range, so hand-edited links cannot blow up the chart. */
export function isPollDay(value: string) {
  return isIsoDay(value) && yearOf(value) >= FIRST_YEAR && yearOf(value) <= LAST_YEAR
}

const rangeSchema = z
  .object({
    id: z.string().min(1).max(20),
    name: z.string().min(1).max(MAX_RANGE_NAME_LENGTH),
    start: z.string().refine(isPollDay),
    end: z.string().refine(isPollDay),
  })
  .refine((range) => range.start <= range.end)

const sectionSchema = z.object({
  name: z.string().min(1).max(MAX_FAMILY_NAME_LENGTH),
  /** Code from `federal-states.ts`, set when the family loaded its holidays. */
  federalState: z
    .string()
    .refine((code) => FEDERAL_STATES.some((state) => state.code === code))
    .optional()
    .catch(undefined),
  ranges: z.array(rangeSchema).max(MAX_RANGES_PER_SECTION),
})

export const pollSchema = z.object({
  /** The name as typed; the address only holds its slug. */
  title: z.string().min(1).max(MAX_TITLE_LENGTH).optional().catch(undefined),
  sections: z.array(sectionSchema).max(MAX_SECTIONS),
})

export type Poll = z.infer<typeof pollSchema>
export type PollSection = Poll['sections'][number]
export type PollRange = PollSection['ranges'][number]

/** Changes the poll the address holds when the update runs; returns the new poll. */
type PollUpdate = (latest: Poll) => Poll
/**
 * Applies an update to the latest poll. `since` is the pathname when an async update started:
 * if the user has opened another poll since, the update is dropped. Returns whether it changed the poll.
 */
export type UpdatePoll = (update: PollUpdate, since?: string) => boolean

/** The part of a range the user types in. */
export type RangeInput = Pick<PollRange, 'name' | 'start' | 'end'>

export const EMPTY_POLL: Poll = { sections: [] }
