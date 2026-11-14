import { z } from 'zod'
import { isIsoDay } from '@/lib/dates'

export const appSearchSchema = z.object({
  /** Selected year; defaults to the current year. */
  year: z.number().int().min(1990).max(2100).optional().catch(undefined),
  /** Detail view range. Both present = detail view, otherwise year overview. */
  from: z.string().refine(isIsoDay).optional().catch(undefined),
  to: z.string().refine(isIsoDay).optional().catch(undefined),
  /** `hide` hides the other households in the views; shown by default. */
  others: z.literal('hide').optional().catch(undefined),
})
