import { createContext, use } from 'react'
import type { Role } from '@/features/server/api-client'
import type { SaveState } from '@/features/server/sync-state'
import type { SavedStamp } from '@/lib/dates'
import type { LastPlan } from './last-plan'
import type { Plan } from './plan-schema'

/** `url`: the plan lives in the link. `server`: the shared plan, opened with an access key. */
export type PlanMode = 'url' | 'server'

/** What the screen needs to show and explain the server side; all `null`/`false` in link mode. */
type ServerControls = {
  /** Server mode only: the first load is running or failed. Link mode is always `ready`. */
  load: 'loading' | 'error' | 'ready'
  reload: () => void
  /** Someone else saved first; our edit waits for "Meine Änderung trotzdem speichern". */
  conflict: boolean
  overwriteWithMine: () => void
  dismissConflict: () => void
  /** The server rejected the stored key (shown once, after falling back to link mode). */
  revoked: boolean
  dismissRevoked: () => void
  /** A key is stored on this device. */
  signedIn: boolean
  signOut: () => void
  /** A link with `plan=` was opened while a key is stored. */
  linkPlanBanner: {
    /** Only the edit role may replace the shared plan. */
    canAdopt: boolean
    adoptFailed: boolean
    openSharedPlan: () => void
    adopt: () => void
  } | null
  /** Server mode, edit role, empty server: the plan this browser edited last. */
  lastPlanOffer: { lastPlan: LastPlan; accept: () => void; dismiss: () => void } | null
}

export type PlanContextValue = {
  mode: PlanMode
  role: Role
  /** View role: nothing may be changed anywhere. */
  readOnly: boolean
  plan: Plan
  commit: (next: Plan, history?: 'push' | 'replace') => void
  year: number
  saved: SavedStamp | undefined
  hasPlan: boolean
  /** Server mode only. */
  saveState: SaveState | null
  /** The plan as a link without a server (snapshot of what is on screen). */
  snapshotHref: () => string
  server: ServerControls
}

export const PlanContext = createContext<PlanContextValue | null>(null)

export function usePlanContext() {
  const value = use(PlanContext)
  if (value === null) throw new Error('usePlan needs a PlanProvider')
  return value
}
