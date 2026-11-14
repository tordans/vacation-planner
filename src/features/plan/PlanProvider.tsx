import { getRouteApi } from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'
import { clearKey, dismissRevokedNotice, useKeyState } from '@/features/server/key-store'
import { snapshotLink } from '@/features/server/snapshot-link'
import { useServerPlan } from '@/features/server/use-server-plan'
import { savedStampNow, today, yearOf } from '@/lib/dates'
import {
  dismissLastPlanOffer,
  isLastPlanOfferDismissed,
  readLastPlan,
  rememberLastPlan,
} from './last-plan'
import { PlanContext, type PlanContextValue, type PlanMode } from './plan-context'
import type { Plan } from './plan-schema'
import { decodePlan, encodePlan } from './plan-url'

const routeApi = getRouteApi('/')

/**
 * Where the plan comes from, as one source for the whole app. Without a key, or when a link
 * carries `plan=`, the plan lives in the URL exactly as before. With a stored key and a bare
 * link, it is the shared plan from the server. Components only see `usePlan()`.
 */
export function PlanProvider({ children }: { children: ReactNode }) {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const { key, revoked } = useKeyState()
  const server = useServerPlan(key)
  const [lastPlan] = useState(readLastPlan)
  const [offerDismissed, setOfferDismissed] = useState(isLastPlanOfferDismissed)
  const [adoptFailed, setAdoptFailed] = useState(false)

  const year = search.year ?? yearOf(today())
  const mode: PlanMode = key !== null && search.plan === undefined ? 'server' : 'url'
  const role = mode === 'server' ? (server.role ?? 'view') : 'edit'

  const urlPlan = decodePlan(search.plan)

  /**
   * `history: 'push'` for discrete steps (create, delete, drop) so the back button undoes them,
   * `'replace'` for small follow-up edits such as typing a place name.
   */
  function commitToUrl(next: Plan, history: 'push' | 'replace' = 'push') {
    const encoded = encodePlan(next)
    const saved = savedStampNow()
    rememberLastPlan({ plan: encoded, saved, year })
    void navigate({
      search: (previous) => ({ ...previous, plan: encoded, saved }),
      replace: history === 'replace',
    })
  }

  function openSharedPlan() {
    void navigate({
      search: (previous) => ({ ...previous, plan: undefined, saved: undefined }),
    })
  }

  async function adoptLinkPlan() {
    if (
      server.serverPlan !== null &&
      !window.confirm(
        'Der gemeinsame Plan wird durch den Plan aus diesem Link ersetzt. Fortfahren?',
      )
    ) {
      return
    }
    setAdoptFailed(false)
    if (await server.replaceWith(urlPlan)) openSharedPlan()
    else setAdoptFailed(true)
  }

  const plan = mode === 'server' ? server.plan : urlPlan
  const saved = mode === 'server' ? server.saved : search.saved

  const canOfferLastPlan =
    mode === 'server' &&
    role === 'edit' &&
    server.load === 'ready' &&
    !server.hasPlan &&
    lastPlan !== null &&
    !offerDismissed

  const value: PlanContextValue = {
    mode,
    role,
    readOnly: role === 'view',
    plan,
    commit: mode === 'server' ? server.commit : commitToUrl,
    year,
    saved,
    hasPlan: mode === 'server' ? server.hasPlan : search.plan !== undefined,
    saveState: mode === 'server' ? server.saveState : null,
    snapshotHref: () =>
      snapshotLink({
        base: `${window.location.origin}${window.location.pathname}`,
        plan,
        year,
        saved: saved ?? savedStampNow(),
        showOthers: search.others !== 'hide',
      }),
    server: {
      load: mode === 'server' ? server.load : 'ready',
      reload: server.reload,
      conflict: mode === 'server' && server.hasConflict,
      overwriteWithMine: server.overwriteWithMine,
      dismissConflict: server.dismissConflict,
      revoked,
      dismissRevoked: dismissRevokedNotice,
      signedIn: key !== null,
      signOut: () => clearKey(),
      linkPlanBanner:
        key !== null && search.plan !== undefined
          ? {
              canAdopt: server.role === 'edit',
              adoptFailed,
              openSharedPlan,
              adopt: () => void adoptLinkPlan(),
            }
          : null,
      lastPlanOffer: canOfferLastPlan
        ? {
            lastPlan,
            accept: () => {
              server.commit(decodePlan(lastPlan.plan))
              dismissLastPlanOffer()
            },
            dismiss: () => {
              dismissLastPlanOffer()
              setOfferDismissed(true)
            },
          }
        : null,
    },
  }

  return <PlanContext value={value}>{children}</PlanContext>
}
