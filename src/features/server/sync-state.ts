import type { Plan } from '@/features/plan/plan-schema'

/**
 * What the browser knows beyond the last server answer: edits not yet saved, whether a save is
 * running or failed, and a lost conflict. Plain data and a reducer, so it is testable without
 * React. The server's own copy lives in the query cache.
 */
export type SyncState = {
  /** Edits the server does not have yet; shown instead of the server plan. */
  pending: Plan | null
  /** Server version `pending` is based on; `null` means "no plan on the server yet". */
  base: number | null
  status: 'idle' | 'saving' | 'failed'
  /** Our edit that lost against someone else's save, kept for "Meine Änderung trotzdem speichern". */
  conflict: Plan | null
}

export const initialSyncState: SyncState = {
  pending: null,
  base: null,
  status: 'idle',
  conflict: null,
}

export type SyncEvent =
  /** The user changed the plan. `serverVersion` is the version on screen when they did. */
  | { type: 'edit'; plan: Plan; serverVersion: number | null }
  | { type: 'save-started' }
  /** The server stored `plan` as `version`. Newer edits made meanwhile stay pending. */
  | { type: 'saved'; plan: Plan; version: number }
  /** Network or server error: keep the edits, retry later. */
  | { type: 'save-failed' }
  /** The server had a newer version; `mine` is what we tried to save. */
  | { type: 'conflicted'; mine: Plan }
  /** "Meine Änderung trotzdem speichern": save `conflict` over `serverVersion`. */
  | { type: 'overwrite'; serverVersion: number }
  | { type: 'dismiss-conflict' }
  /** Focus came back after a failed save. */
  | { type: 'retry' }
  /** The server refused our edits for good (the key is a view key now). */
  | { type: 'discard' }

export function syncReducer(state: SyncState, event: SyncEvent): SyncState {
  switch (event.type) {
    case 'edit':
      return {
        pending: event.plan,
        // Edits on top of unsaved edits keep the version they started from.
        base: state.pending === null ? event.serverVersion : state.base,
        status: state.status === 'failed' ? 'idle' : state.status,
        // Editing on top of the adopted server plan accepts it.
        conflict: null,
      }
    case 'save-started':
      return state.pending === null ? state : { ...state, status: 'saving' }
    case 'saved':
      return {
        ...state,
        pending: state.pending === event.plan ? null : state.pending,
        base: event.version,
        status: 'idle',
      }
    case 'save-failed':
      return { ...state, status: 'failed' }
    case 'conflicted':
      // Edits made while the save ran belong to "mine" too.
      return { ...state, pending: null, status: 'idle', conflict: state.pending ?? event.mine }
    case 'overwrite':
      return state.conflict === null
        ? state
        : {
            pending: state.conflict,
            base: event.serverVersion,
            status: 'idle',
            conflict: null,
          }
    case 'dismiss-conflict':
      return { ...state, conflict: null }
    case 'retry':
      return state.status === 'failed' ? { ...state, status: 'idle' } : state
    case 'discard':
      return initialSyncState
  }
}

/** Edits wait for the debounce, then a save; nothing starts while one runs or after a failure. */
export function shouldScheduleSave(state: SyncState): state is SyncState & { pending: Plan } {
  return state.pending !== null && state.status === 'idle'
}

/** Polling and focus refresh must not replace what the user is working on. */
export function hasUnsavedChanges(state: SyncState) {
  return state.pending !== null
}

export type SaveState = 'saved' | 'saving' | 'offline'

export function saveStateOf(state: SyncState): SaveState {
  if (state.status === 'failed') return 'offline'
  if (state.pending !== null) return 'saving'
  return 'saved'
}

/** The plan to show: unsaved edits win over the server's copy. */
export function shownPlan(state: SyncState, server: Plan): Plan {
  return state.pending ?? server
}
