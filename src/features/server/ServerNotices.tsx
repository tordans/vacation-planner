import type { ReactNode } from 'react'
import { useServerControls } from '@/features/plan/use-plan'
import { formatSavedFull } from '@/lib/dates'

const linkButtonClass = 'font-semibold underline underline-offset-2'

function Notice({ tone, children }: { tone: 'sky' | 'amber' | 'red'; children: ReactNode }) {
  const tones = {
    sky: 'bg-sky-50 text-sky-950 ring-sky-200',
    amber: 'bg-amber-50 text-amber-950 ring-amber-200',
    red: 'bg-red-50 text-red-900 ring-red-200',
  }
  return (
    <p
      role="status"
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg px-4 py-3 text-sm ring-1 print:hidden ${tones[tone]}`}
    >
      {children}
    </p>
  )
}

/** Everything the shared plan has to tell the user besides the plan itself. */
export function ServerNotices() {
  const server = useServerControls()
  const { revoked, conflict, linkPlanBanner, lastPlanOffer } = server

  return (
    <>
      {revoked && (
        <Notice tone="amber">
          <span>
            Dieser Link gilt nicht mehr. Frag nach dem neuen Link, um wieder am gemeinsamen Plan
            teilzunehmen.
          </span>
          <button type="button" className={linkButtonClass} onClick={server.dismissRevoked}>
            Okay
          </button>
        </Notice>
      )}

      {conflict && (
        <Notice tone="amber">
          <span>Inzwischen von jemand anderem geändert. Du siehst jetzt den neuen Stand.</span>
          <button type="button" className={linkButtonClass} onClick={server.overwriteWithMine}>
            Meine Änderung trotzdem speichern
          </button>
          <button type="button" className={linkButtonClass} onClick={server.dismissConflict}>
            Neuen Stand behalten
          </button>
        </Notice>
      )}

      {linkPlanBanner && (
        <Notice tone="sky">
          <span>
            Dieser Link enthält einen eigenen Plan. Der gemeinsame Plan liegt auf dem Server.
          </span>
          <button type="button" className={linkButtonClass} onClick={linkPlanBanner.openSharedPlan}>
            Zum gemeinsamen Plan
          </button>
          {linkPlanBanner.canAdopt && (
            <button type="button" className={linkButtonClass} onClick={linkPlanBanner.adopt}>
              Auf den Server übernehmen
            </button>
          )}
          {linkPlanBanner.adoptFailed && (
            <span className="font-medium text-red-700">Nicht übernommen – keine Verbindung.</span>
          )}
        </Notice>
      )}

      {lastPlanOffer && (
        <Notice tone="sky">
          <span>
            Der gemeinsame Plan ist noch leer. In diesem Browser wurde zuletzt ein Plan bearbeitet,
            Stand {formatSavedFull(lastPlanOffer.lastPlan.saved)}.
          </span>
          <button type="button" className={linkButtonClass} onClick={lastPlanOffer.accept}>
            Diesen Plan auf den Server übernehmen
          </button>
          <button type="button" className={linkButtonClass} onClick={lastPlanOffer.dismiss}>
            Nein, danke
          </button>
        </Notice>
      )}
    </>
  )
}
