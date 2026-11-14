import type { ReactNode } from 'react'
import { clearKey } from '@/features/server/key-store'
import { useServerPlan } from '@/features/server/use-server-plan'
import { PlanContext, type PlanContextValue } from './plan-context'

/**
 * The shared plan from the server, as one source for the whole app. Components only see
 * `usePlan()`. Only rendered while a key is stored; without one the app shows the no-key screen.
 */
export function PlanProvider({
  planKey,
  year,
  children,
}: {
  planKey: string
  /** The year on screen. */
  year: number
  children: ReactNode
}) {
  const server = useServerPlan(planKey)
  const role = server.role ?? 'view'

  const value: PlanContextValue = {
    role,
    readOnly: role === 'view',
    plan: server.plan,
    commit: server.commit,
    year,
    saved: server.saved,
    hasPlan: server.hasPlan,
    saveState: server.saveState,
    server: {
      load: server.load,
      reload: server.reload,
      conflict: server.hasConflict,
      overwriteWithMine: server.overwriteWithMine,
      dismissConflict: server.dismissConflict,
      signOut: () => clearKey(),
    },
  }

  return <PlanContext value={value}>{children}</PlanContext>
}
