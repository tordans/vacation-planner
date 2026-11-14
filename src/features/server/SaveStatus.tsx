import { usePlan } from '@/features/plan/use-plan'
import { useNow } from '@/hooks/use-now'
import { cn } from '@/lib/cn'
import { formatSavedFull, formatSavedShort } from '@/lib/dates'

/** Header line of the shared plan: what the last save was, or that one is running or failed. */
export function SaveStatus() {
  const { saved, saveState } = usePlan()
  const now = useNow()

  let text = 'Noch nicht gespeichert'
  if (saveState === 'saving') text = 'Speichert …'
  else if (saveState === 'offline') text = 'Nicht gespeichert – keine Verbindung'
  else if (saved) text = `Gespeichert ${formatSavedShort(saved, now)}`

  return (
    <span
      role="status"
      title={saved && saveState === 'saved' ? formatSavedFull(saved) : undefined}
      className={cn('tabular-nums', saveState === 'offline' ? 'font-medium text-red-700' : '')}
    >
      {text}
    </span>
  )
}
