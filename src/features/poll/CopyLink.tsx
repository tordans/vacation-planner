import { CheckIcon, ClipboardDocumentIcon } from '@heroicons/react/20/solid'
import { primaryButtonClass } from '@/components/ui/classes'

/** `initial`: link as received. `changed`: edited since it was last copied. */
export type LinkStatus = 'initial' | 'changed' | 'copied' | 'failed'

type CopyLinkProps = {
  status: LinkStatus
  onStatus: (status: LinkStatus) => void
}

/** Copies the address, whose fragment holds the whole poll, and says when it has to be copied again. */
export function CopyLink({ status, onStatus }: CopyLinkProps) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      onStatus('copied')
    } catch {
      onStatus('failed')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <button type="button" className={primaryButtonClass} onClick={() => void copy()}>
        {status === 'copied' ? (
          <CheckIcon className="size-4" />
        ) : (
          <ClipboardDocumentIcon className="size-4" />
        )}
        {status === 'copied' ? 'Kopiert' : 'Link kopieren'}
      </button>
      {status === 'changed' && (
        <p role="status" className="text-sm font-medium text-amber-900">
          Link geändert – schick den neuen Link zurück.
        </p>
      )}
      {status === 'failed' && (
        <p role="status" className="text-sm text-red-800">
          Kopieren hat nicht geklappt. Kopiere die Adresse aus der Adresszeile.
        </p>
      )}
    </div>
  )
}
