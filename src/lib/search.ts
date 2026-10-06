import { z } from 'zod'
import { isIsoDay, isSavedStamp } from '@/lib/dates'

export const appSearchSchema = z.object({
  /** Selected year; defaults to the current year. */
  year: z.number().int().min(1990).max(2100).optional().catch(undefined),
  /** Detail view range. Both present = detail view, otherwise year overview. */
  from: z.string().refine(isIsoDay).optional().catch(undefined),
  to: z.string().refine(isIsoDay).optional().catch(undefined),
  /** Last change of the plan as plain text, so the age of a link is visible in the URL. */
  saved: z.string().refine(isSavedStamp).optional().catch(undefined),
  /** The plan itself, LZ-compressed. See `plan-url.ts`. */
  plan: z.coerce.string().optional().catch(undefined),
})
