import { z } from 'zod'
import { isSavedStamp } from '@/lib/dates'

const STORAGE_KEY = 'vacation-planner:last-plan:v1'

const lastPlanSchema = z.object({
  plan: z.string().min(1),
  saved: z.string().refine(isSavedStamp),
  year: z.number().int(),
})

export type LastPlan = z.infer<typeof lastPlanSchema>

/** Convenience only: lets an empty visit offer the plan this browser edited last. */
export function rememberLastPlan(lastPlan: LastPlan) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lastPlan))
  } catch {
    // Storage full or blocked: the URL still holds the plan.
  }
}

export function readLastPlan(): LastPlan | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const result = lastPlanSchema.safeParse(JSON.parse(raw))
    return result.success ? result.data : null
  } catch {
    return null
  }
}
