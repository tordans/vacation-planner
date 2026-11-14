import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { KeyIcon } from '@heroicons/react/20/solid'
import { useState } from 'react'
import { buttonClass } from '@/components/ui/classes'
import { usePlan, useServerControls } from '@/features/plan/use-plan'
import type { LinkKind } from './api-client'
import { useKeyState } from './key-store'
import { RenewKeyDialog } from './RenewKeyDialog'

const menuButtonClass =
  'block w-full rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:text-zinc-400 disabled:hover:bg-transparent'

const LABELS: Record<LinkKind, string> = {
  view: 'Ansicht-Link erneuern',
  edit: 'Bearbeiten-Link erneuern',
  calendar: 'Kalender-Link (iCal) erstellen oder erneuern',
}

/** Header menu of the shared plan: what this access allows, renewing links, leaving this device. */
export function AccessMenu() {
  const { role, saveState } = usePlan()
  const server = useServerControls()
  const { key } = useKeyState()
  const [renewing, setRenewing] = useState<LinkKind | null>(null)
  const canRenew = role === 'edit' && key !== null
  // Renewing the edit link switches this device to the new key; unsaved edits would be lost.
  const waitingForSave = saveState !== 'saved'

  return (
    <>
      <Popover className="relative">
        <PopoverButton className={buttonClass}>
          <KeyIcon className="size-4 text-zinc-500" />
          {role === 'edit' ? 'Gemeinsamer Plan' : 'Zugang'}
        </PopoverButton>
        <PopoverPanel
          anchor="bottom end"
          className="z-30 w-72 space-y-1 rounded-lg bg-white p-2 shadow-lg ring-1 ring-zinc-200 [--anchor-gap:0.25rem]"
        >
          {({ close }) => (
            <>
              <p className="px-3 pt-1 pb-2 text-xs text-zinc-600">
                {role === 'edit'
                  ? 'Alle mit dem Link zum Bearbeiten sehen und ändern denselben Plan.'
                  : 'Du siehst den gemeinsamen Plan zum Nachschauen.'}
              </p>
              {canRenew && (
                <>
                  {(['view', 'edit', 'calendar'] as const).map((which) => (
                    <button
                      key={which}
                      type="button"
                      className={menuButtonClass}
                      disabled={which === 'edit' && waitingForSave}
                      title={
                        which === 'edit' && waitingForSave
                          ? 'Erst wenn alles gespeichert ist.'
                          : undefined
                      }
                      onClick={() => {
                        close()
                        setRenewing(which)
                      }}
                    >
                      {LABELS[which]}
                    </button>
                  ))}
                  <p className="px-3 pb-2 text-xs text-zinc-600">
                    Gespeicherte Links lassen sich nicht wieder anzeigen. Wer einen Link verloren
                    hat, erneuert ihn hier; der alte gilt dann nicht mehr.
                  </p>
                </>
              )}
              <button type="button" className={menuButtonClass} onClick={server.signOut}>
                Auf diesem Gerät abmelden
              </button>
            </>
          )}
        </PopoverPanel>
      </Popover>
      {canRenew && (
        <RenewKeyDialog which={renewing} planKey={key} onClose={() => setRenewing(null)} />
      )}
    </>
  )
}
