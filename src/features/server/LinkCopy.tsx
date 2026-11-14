import { CheckIcon, ClipboardDocumentIcon } from '@heroicons/react/20/solid'
import { useId, useState } from 'react'
import { buttonClass } from '@/components/ui/classes'
import { linkForKey } from './key-hash'

type CopyState = 'idle' | 'copied' | 'failed'

/** A link that is shown once: readonly field, so it can also be selected by hand, and a copy button. */
export function LinkCopy({ label, planKey }: { label: string; planKey: string }) {
  const id = useId()
  const [copy, setCopy] = useState<CopyState>('idle')
  const link = linkForKey(planKey, window.location.origin)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopy('copied')
    } catch {
      setCopy('failed')
    }
  }

  return (
    <div className="space-y-1.5 text-left">
      <label htmlFor={id} className="block text-sm font-medium text-zinc-900">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          readOnly
          value={link}
          onFocus={(event) => event.currentTarget.select()}
          className="block min-w-0 flex-1 rounded-md border-zinc-300 font-mono text-xs shadow-xs focus:border-sky-600 focus:ring-sky-600"
        />
        <button type="button" className={buttonClass} onClick={() => void copyLink()}>
          {copy === 'copied' ? (
            <CheckIcon className="size-4 text-green-700" />
          ) : (
            <ClipboardDocumentIcon className="size-4 text-zinc-500" />
          )}
          {copy === 'copied' ? 'Kopiert' : 'Kopieren'}
        </button>
      </div>
      {copy === 'failed' && (
        <p role="status" className="text-xs text-red-800">
          Kopieren hat nicht geklappt. Markiere den Link und kopiere ihn von Hand.
        </p>
      )}
    </div>
  )
}
