import { describe, expect, it } from 'vitest'
import { emptyPlan } from '@/features/plan/plan-schema'
import {
  hasUnsavedChanges,
  initialSyncState,
  saveStateOf,
  shouldScheduleSave,
  shownPlan,
  syncReducer,
  type SyncEvent,
  type SyncState,
} from '@/features/server/sync-state'
import { familyPlan } from './fixtures'

function run(events: SyncEvent[], from: SyncState = initialSyncState) {
  return events.reduce(syncReducer, from)
}

const mine = familyPlan()
const server = emptyPlan()

describe('sync state: saving', () => {
  it('shows an edit at once and schedules one save', () => {
    const state = run([{ type: 'edit', plan: mine, serverVersion: 3 }])
    expect(shownPlan(state, server)).toBe(mine)
    expect(state.base).toBe(3)
    expect(shouldScheduleSave(state)).toBe(true)
    expect(hasUnsavedChanges(state)).toBe(true)
    expect(saveStateOf(state)).toBe('saving')
  })

  it('shows the server plan when nothing is unsaved', () => {
    expect(shownPlan(initialSyncState, server)).toBe(server)
    expect(saveStateOf(initialSyncState)).toBe('saved')
    expect(hasUnsavedChanges(initialSyncState)).toBe(false)
  })

  it('creates the plan when the server has none', () => {
    const state = run([{ type: 'edit', plan: mine, serverVersion: null }])
    expect(state.base).toBeNull()
    expect(shouldScheduleSave(state)).toBe(true)
  })

  it('keeps the first base while edits pile up', () => {
    const second = familyPlan()
    const state = run([
      { type: 'edit', plan: mine, serverVersion: 3 },
      { type: 'edit', plan: second, serverVersion: 4 },
    ])
    expect(state.base).toBe(3)
    expect(state.pending).toBe(second)
  })

  it('does not schedule while a save runs', () => {
    const state = run([{ type: 'edit', plan: mine, serverVersion: 3 }, { type: 'save-started' }])
    expect(state.status).toBe('saving')
    expect(shouldScheduleSave(state)).toBe(false)
    expect(saveStateOf(state)).toBe('saving')
  })

  it('is saved once the server stored exactly what is pending', () => {
    const state = run([
      { type: 'edit', plan: mine, serverVersion: 3 },
      { type: 'save-started' },
      { type: 'saved', plan: mine, version: 4 },
    ])
    expect(state.pending).toBeNull()
    expect(state.base).toBe(4)
    expect(saveStateOf(state)).toBe('saved')
  })

  it('keeps edits made during a save and saves them on top of the new version', () => {
    const newer = familyPlan()
    const state = run([
      { type: 'edit', plan: mine, serverVersion: 3 },
      { type: 'save-started' },
      { type: 'edit', plan: newer, serverVersion: 3 },
      { type: 'saved', plan: mine, version: 4 },
    ])
    expect(state.pending).toBe(newer)
    expect(state.base).toBe(4)
    expect(shouldScheduleSave(state)).toBe(true)
  })

  it('ignores save-started without edits', () => {
    expect(syncReducer(initialSyncState, { type: 'save-started' })).toBe(initialSyncState)
  })
})

describe('sync state: offline', () => {
  const failed = run([
    { type: 'edit', plan: mine, serverVersion: 3 },
    { type: 'save-started' },
    { type: 'save-failed' },
  ])

  it('keeps the edits and reports it', () => {
    expect(failed.pending).toBe(mine)
    expect(saveStateOf(failed)).toBe('offline')
    expect(shouldScheduleSave(failed)).toBe(false)
  })

  it('retries on the next change', () => {
    const next = familyPlan()
    const state = syncReducer(failed, { type: 'edit', plan: next, serverVersion: 3 })
    expect(state.base).toBe(3)
    expect(state.status).toBe('idle')
    expect(shouldScheduleSave(state)).toBe(true)
  })

  it('retries on focus', () => {
    const state = syncReducer(failed, { type: 'retry' })
    expect(state.pending).toBe(mine)
    expect(shouldScheduleSave(state)).toBe(true)
  })

  it('ignores focus when nothing failed', () => {
    expect(syncReducer(initialSyncState, { type: 'retry' })).toBe(initialSyncState)
  })
})

describe('sync state: conflict', () => {
  const conflicted = run([
    { type: 'edit', plan: mine, serverVersion: 3 },
    { type: 'save-started' },
    { type: 'conflicted', mine },
  ])

  it('adopts the server plan and keeps ours aside', () => {
    expect(conflicted.pending).toBeNull()
    expect(conflicted.conflict).toBe(mine)
    expect(shownPlan(conflicted, server)).toBe(server)
    expect(shouldScheduleSave(conflicted)).toBe(false)
    expect(saveStateOf(conflicted)).toBe('saved')
  })

  it('"Meine Änderung trotzdem speichern" saves ours over the new version', () => {
    const state = syncReducer(conflicted, { type: 'overwrite', serverVersion: 5 })
    expect(state.pending).toBe(mine)
    expect(state.base).toBe(5)
    expect(state.conflict).toBeNull()
    expect(shouldScheduleSave(state)).toBe(true)
  })

  it('keeps edits made during the losing save as "mine"', () => {
    const newer = familyPlan()
    const state = run([
      { type: 'edit', plan: mine, serverVersion: 3 },
      { type: 'save-started' },
      { type: 'edit', plan: newer, serverVersion: 3 },
      { type: 'conflicted', mine },
    ])
    expect(state.conflict).toBe(newer)
  })

  it('a new edit on top of the server plan accepts it', () => {
    const next = familyPlan()
    const state = syncReducer(conflicted, { type: 'edit', plan: next, serverVersion: 5 })
    expect(state.conflict).toBeNull()
    expect(state.base).toBe(5)
  })

  it('can be dismissed', () => {
    expect(syncReducer(conflicted, { type: 'dismiss-conflict' }).conflict).toBeNull()
  })

  it('overwrite without a conflict does nothing', () => {
    expect(syncReducer(initialSyncState, { type: 'overwrite', serverVersion: 1 })).toBe(
      initialSyncState,
    )
  })
})

describe('sync state: refused edits', () => {
  it('drops everything when the server says the key may not edit', () => {
    const state = run([{ type: 'edit', plan: mine, serverVersion: 3 }, { type: 'discard' }])
    expect(state).toEqual(initialSyncState)
  })
})
