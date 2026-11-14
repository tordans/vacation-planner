import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useEffectEvent, useReducer, useState } from 'react'
import { emptyPlan, type Plan } from '@/features/plan/plan-schema'
import { decodeWirePlan, toWire } from '@/features/plan/plan-url'
import { savedStampFromIso } from '@/lib/dates'
import {
  ApiError,
  createApiClient,
  type PlanResponse,
  type PutPlanResult,
  type ServerPlan,
} from './api-client'
import { clearKey } from './key-store'
import {
  hasUnsavedChanges,
  initialSyncState,
  saveStateOf,
  shouldScheduleSave,
  shownPlan,
  syncReducer,
} from './sync-state'

/** Edits are saved this long after the last change. */
const SAVE_DELAY_MS = 1000
/** Look for changes of others this often while nothing is unsaved (and when the tab gets focus). */
const POLL_INTERVAL_MS = 60_000

function isStatus(error: unknown, status: number) {
  return error instanceof ApiError && error.status === status
}

/**
 * The shared plan: loaded and refreshed through TanStack Query, edits shown at once and saved
 * with a delay. The rules for saving, failing and conflicts live in `sync-state.ts`.
 * `key === null` switches everything off (link mode).
 */
export function useServerPlan(key: string | null) {
  const queryClient = useQueryClient()
  const [sync, dispatch] = useReducer(syncReducer, initialSyncState)
  // Another link opened in this tab (e.g. view after edit): unsaved edits and conflicts belong to
  // the old key, so start over.
  const [syncKey, setSyncKey] = useState(key)
  if (syncKey !== key) {
    setSyncKey(key)
    dispatch({ type: 'discard' })
  }
  const queryKey = ['plan', key] as const
  const unsaved = hasUnsavedChanges(sync)

  const query = useQuery({
    queryKey,
    enabled: key !== null,
    queryFn: async () => {
      if (key === null) throw new Error('No key')
      try {
        return await createApiClient({ key }).getPlan()
      } catch (error) {
        if (isStatus(error, 401)) clearKey({ revoked: true })
        throw error
      }
    },
    retry: (count, error) => !isStatus(error, 401) && count < 2,
    refetchInterval: unsaved ? false : POLL_INTERVAL_MS,
    refetchOnWindowFocus: !unsaved,
  })

  const role = query.data?.role
  const serverPlan: ServerPlan | null = query.data?.plan ?? null
  const decoded = serverPlan ? (decodeWirePlan(serverPlan.data) ?? emptyPlan()) : emptyPlan()
  const plan = shownPlan(sync, decoded)

  function rememberSaved(saved: Plan, result: Extract<PutPlanResult, { ok: true }>) {
    queryClient.setQueryData<PlanResponse>(queryKey, (old) =>
      old
        ? {
            role: old.role,
            plan: { version: result.version, updatedAt: result.updatedAt, data: toWire(saved) },
          }
        : old,
    )
  }

  function rememberServerPlan(latest: ServerPlan) {
    queryClient.setQueryData<PlanResponse>(queryKey, (old) =>
      old ? { role: old.role, plan: latest } : old,
    )
  }

  /** Never throws: every failure becomes state. */
  async function save(next: Plan, base: number | null) {
    if (key === null) return
    dispatch({ type: 'save-started' })
    try {
      const result = await createApiClient({ key }).putPlan(toWire(next), base)
      if (result.ok) {
        rememberSaved(next, result)
        dispatch({ type: 'saved', plan: next, version: result.version })
      } else {
        rememberServerPlan(result.conflict)
        dispatch({ type: 'conflicted', mine: next })
      }
    } catch (error) {
      if (isStatus(error, 401)) {
        clearKey({ revoked: true })
      } else if (isStatus(error, 403)) {
        // The key is a view key: forget the edits and learn the role again.
        dispatch({ type: 'discard' })
        void queryClient.invalidateQueries({ queryKey })
      } else {
        dispatch({ type: 'save-failed' })
      }
    }
  }

  const saveLater = useEffectEvent((next: Plan, base: number | null) => void save(next, base))

  // Real sync: save once the user stopped changing things for a moment.
  useEffect(() => {
    if (!shouldScheduleSave(sync)) return
    const timer = window.setTimeout(() => saveLater(sync.pending, sync.base), SAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [sync])

  // Real sync: after a failed save, try again when the tab or the network comes back.
  useEffect(() => {
    if (sync.status !== 'failed') return
    const retry = () => dispatch({ type: 'retry' })
    window.addEventListener('focus', retry)
    window.addEventListener('online', retry)
    return () => {
      window.removeEventListener('focus', retry)
      window.removeEventListener('online', retry)
    }
  }, [sync.status])

  function commit(next: Plan) {
    if (role !== 'edit') return
    dispatch({ type: 'edit', plan: next, serverVersion: serverPlan?.version ?? null })
  }

  function overwriteWithMine() {
    if (sync.conflict === null || serverPlan === null) return
    dispatch({ type: 'overwrite', serverVersion: serverPlan.version })
    void save(sync.conflict, serverPlan.version)
  }

  /**
   * Replace the shared plan with `next` right away (used for "Auf den Server übernehmen"); last
   * save wins, so a 409 is answered with one more try on top of the newer version.
   */
  async function replaceWith(next: Plan): Promise<boolean> {
    if (key === null) return false
    const client = createApiClient({ key })
    try {
      let result = await client.putPlan(toWire(next), serverPlan?.version ?? null)
      if (!result.ok) result = await client.putPlan(toWire(next), result.conflict.version)
      if (!result.ok) return false
      rememberSaved(next, result)
      dispatch({ type: 'discard' })
      return true
    } catch (error) {
      if (isStatus(error, 401)) clearKey({ revoked: true })
      return false
    }
  }

  return {
    load: query.data
      ? ('ready' as const)
      : query.isError
        ? ('error' as const)
        : ('loading' as const),
    reload: () => void query.refetch(),
    role,
    serverPlan,
    plan,
    commit,
    saved: serverPlan ? savedStampFromIso(serverPlan.updatedAt) : undefined,
    hasPlan: serverPlan !== null || sync.pending !== null,
    saveState: saveStateOf(sync),
    hasConflict: sync.conflict !== null,
    overwriteWithMine,
    dismissConflict: () => dispatch({ type: 'dismiss-conflict' }),
    replaceWith,
  }
}
