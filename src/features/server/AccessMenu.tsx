import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { KeyIcon } from '@heroicons/react/20/solid'
import { buttonClass } from '@/components/ui/classes'
import { usePlan, useServerControls } from '@/features/plan/use-plan'

const menuButtonClass =
  'block w-full rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-sky-600'

/** Header menu of the shared plan: what this access allows, and leaving this device. */
export function AccessMenu() {
  const { role } = usePlan()
  const server = useServerControls()

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
        <p className="px-3 pt-1 pb-2 text-xs text-zinc-600">
          {role === 'edit'
            ? 'Alle mit diesem Zugang sehen und ändern denselben Plan.'
            : 'Du siehst den gemeinsamen Plan zum Nachschauen.'}
        </p>
        <button type="button" className={menuButtonClass} onClick={server.signOut}>
          Auf diesem Gerät abmelden
        </button>
      </PopoverPanel>
    </Popover>
  )
}
