import { useSyncExternalStore } from 'react'
import { parseKeyFromHash, removeKeyFromHash } from './key-hash'

const STORAGE_KEY = 'vacation-planner:key:v1'

/** `revoked`: the server rejected the stored key; shown on the no-key screen, never persisted. */
type KeyState = { key: string | null; revoked: boolean }

function readStoredKey(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value && parseKeyFromHash(`#key=${value}`) ? value : null
  } catch {
    return null
  }
}

function writeStoredKey(key: string | null) {
  try {
    if (key === null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, key)
  } catch {
    // Storage blocked: the key still works until the tab is closed.
  }
}

/** Takes `#key=…` from the address bar, remembers it and removes it from the history entry. */
function takeKeyFromLocation(): string | null {
  const key = parseKeyFromHash(window.location.hash)
  if (key === null) return null
  const hash = removeKeyFromHash(window.location.hash)
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${window.location.search}${hash}`,
  )
  writeStoredKey(key)
  return key
}

function initialState(): KeyState {
  if (typeof window === 'undefined') return { key: null, revoked: false }
  const fromLocation = takeKeyFromLocation()
  return { key: fromLocation ?? readStoredKey(), revoked: false }
}

// Evaluated when the app module graph loads, before the router reads the address bar.
let state = initialState()
const listeners = new Set<() => void>()

function setState(next: KeyState) {
  state = next
  for (const listener of listeners) listener()
}

// A key link opened in a tab that already runs the app only changes the fragment.
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const key = takeKeyFromLocation()
    if (key !== null) setState({ key, revoked: false })
  })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return state
}

/** Remember `key` on this device and switch to it (a new plan, or a renewed edit link). */
export function storeKey(key: string) {
  writeStoredKey(key)
  setState({ key, revoked: false })
}

/** Forget the key on this device. `revoked` additionally shows "Dieser Link gilt nicht mehr". */
export function clearKey(options: { revoked?: boolean } = {}) {
  writeStoredKey(null)
  setState({ key: null, revoked: options.revoked === true })
}

export function useKeyState() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
