import { createContext, use } from 'react'
import type { Role } from '@/features/server/api-client'
import type { SaveState } from '@/features/server/sync-state'
import type { SavedStamp } from '@/lib/dates'
import type { Plan } from './plan-schema'

/** What the screen needs to load, save and explain the shared plan. */
type ServerControls = {
  /** The first load is running or failed. */
  load: 'loading' | 'error' | 'ready'
  reload: () => void
  /** Someone else saved first; our edit waits for "Meine Änderung trotzdem speichern". */
  conflict: boolean
  overwriteWithMine: () => void
  dismissConflict: () => void
  signOut: () => void
}

export type PlanContextValue = {
  /** From the server, by the key that was opened. */
  role: Role
  /** View role: nothing may be changed anywhere. */
  readOnly: boolean
  plan: Plan
  commit: (next: Plan) => void
  year: number
  /** Last save on the server (`updatedAt`), in Berlin time. */
  saved: SavedStamp | undefined
  hasPlan: boolean
  saveState: SaveState
  server: ServerControls
}

export const PlanContext = createContext<PlanContextValue | null>(null)

export function usePlanContext() {
  const value = use(PlanContext)
  if (value === null) throw new Error('usePlan needs a PlanProvider')
  return value
}
