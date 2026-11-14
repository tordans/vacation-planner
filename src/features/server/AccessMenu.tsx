import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { KeyIcon } from '@heroicons/react/20/solid'
import { useState } from 'react'
import { buttonClass } from '@/components/ui/classes'
import { usePlan, useServerControls } from '@/features/plan/use-plan'

const menuButtonClass =
  'block w-full rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-sky-600'

/** Header menu of the shared plan: leave the server behind or take a snapshot with you. */
export function AccessMenu() {
  const { role, snapshotHref } = usePlan()
  const server = useServerControls()
  const [copied, setCopied] = useState(false)

  async function copySnapshot() {
    try {
      await navigator.clipboard.writeText(snapshotHref())
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: nothing else to offer here.
    }
  }

  return (
    <Popover className="relative">
      <PopoverButton className={buttonClass}>
        <KeyIcon className="size-4 text-zinc-500" />
        {role === 'edit' ? 'Gemeinsamer Plan' : 'Zugang'}
      </PopoverButton>
      <PopoverPanel
        anchor="bottom end"
        className="z-30 w-72 space-y-1 rounded-lg bg-white p-2 shadow-lg ring-1 ring-zinc-200 [--anchor-gap:0.25rem]"
      >
        {role === 'edit' ? (
          <p className="px-3 pt-1 pb-2 text-xs text-zinc-600">
            Alle mit diesem Zugang sehen und ändern denselben Plan.
          </p>
        ) : (
          <p className="px-3 pt-1 pb-2 text-xs text-zinc-600">
            Du siehst den gemeinsamen Plan zum Nachschauen.
          </p>
        )}
        {role === 'edit' && (
          <button type="button" className={menuButtonClass} onClick={() => void copySnapshot()}>
            {copied ? 'Link kopiert' : 'Als Link ohne Server kopieren'}
          </button>
        )}
        <button type="button" className={menuButtonClass} onClick={server.signOut}>
          Auf diesem Gerät abmelden
        </button>
      </PopoverPanel>
    </Popover>
  )
}
