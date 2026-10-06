import { useSyncExternalStore } from 'react'

const TICK_MS = 60_000

function subscribe(onTick: () => void) {
  const interval = window.setInterval(onTick, TICK_MS)
  return () => window.clearInterval(interval)
}

function currentMinute() {
  return Math.floor(Date.now() / TICK_MS) * TICK_MS
}

/** Current time, refreshed once a minute so relative dates in an open tab do not go stale. */
export function useNow() {
  return useSyncExternalStore(subscribe, currentMinute)
}
