import { useServerControls } from '@/features/plan/use-plan'

const linkButtonClass = 'font-semibold underline underline-offset-2'

/** What the shared plan has to tell the user besides the plan itself: someone saved first. */
export function ServerNotices() {
  const server = useServerControls()
  if (!server.conflict) return null

  return (
    <p
      role="status"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-200 print:hidden"
    >
      <span>Inzwischen von jemand anderem geändert. Du siehst jetzt den neuen Stand.</span>
      <button type="button" className={linkButtonClass} onClick={server.overwriteWithMine}>
        Meine Änderung trotzdem speichern
      </button>
      <button type="button" className={linkButtonClass} onClick={server.dismissConflict}>
        Neuen Stand behalten
      </button>
    </p>
  )
}
