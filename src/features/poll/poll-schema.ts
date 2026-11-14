import { z } from 'zod'
import { FEDERAL_STATES } from '@/features/holidays/federal-states'
import { isIsoDay, yearOf, type IsoDay } from '@/lib/dates'

/** The one section that is not a family: windows in which everyone could meet. */
export const CHANCEN_SECTION = 'Chancen'

export const MAX_TITLE_LENGTH = 80
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
    name: z.string().min(1).max(80),
    start: z.string().refine(isPollDay),
    end: z.string().refine(isPollDay),
  })
  .refine((range) => range.start <= range.end)

const sectionSchema = z.object({
  name: z.string().min(1).max(60),
  /** Code from `federal-states.ts`, set when the family loaded its holidays. */
  federalState: z
    .string()
    .refine((code) => FEDERAL_STATES.some((state) => state.code === code))
    .optional()
    .catch(undefined),
  ranges: z.array(rangeSchema).max(200),
})

export const pollSchema = z.object({
  /** The name as typed; the address only holds its slug. */
  title: z.string().min(1).max(MAX_TITLE_LENGTH).optional().catch(undefined),
  sections: z.array(sectionSchema).max(30),
})

export type Poll = z.infer<typeof pollSchema>
export type PollSection = Poll['sections'][number]
export type PollRange = PollSection['ranges'][number]

/** The part of a range the user types in. */
export type RangeInput = Pick<PollRange, 'name' | 'start' | 'end'>

export const EMPTY_POLL: Poll = { sections: [] }
