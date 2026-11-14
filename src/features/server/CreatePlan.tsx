import { useMutation } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { primaryButtonClass } from '@/components/ui/classes'
import { type CreatePlanFailure, createPlan } from './api-client'
import { storeKey } from './key-store'
import { LinkCopy } from './LinkCopy'

const FAILURE_TEXT: Record<CreatePlanFailure, string> = {
  invalid_invite: 'Das Einladungswort stimmt nicht.',
  rate_limited: 'Zu viele Versuche. Bitte später noch einmal.',
  plans_full: 'Im Moment können keine neuen Pläne angelegt werden.',
}

const UNKNOWN_FAILURE_TEXT =
  'Der Plan konnte nicht angelegt werden. Bitte die Verbindung prüfen und noch einmal versuchen.'

/** "Neuen Plan anlegen": invite word in, two links out (shown once), then open the plan. */
export function CreatePlan() {
  const inviteId = useId()
  const [invite, setInvite] = useState('')
  const mutation = useMutation({ mutationFn: (word: string) => createPlan(word) })
  const created = mutation.data?.ok ? mutation.data : null

  if (created) {
    return (
      <section className="space-y-5 rounded-xl bg-white p-5 text-left shadow-xs ring-1 ring-zinc-200">
        <h2 className="text-base font-semibold">Dein Plan ist angelegt</h2>
        <p className="text-sm/6 text-zinc-700">
          Diese beiden Links siehst du <strong className="font-semibold">nur jetzt</strong>. Wir
          können sie später nicht wieder anzeigen.
        </p>
        <LinkCopy label="Link zum Bearbeiten" planKey={created.editKey} />
        <p className="-mt-3 text-sm/6 text-zinc-700">
          Speichere ihn sicher, zum Beispiel in einem Passwortmanager. Wer ihn hat, kann alles
          ändern.
        </p>
        <LinkCopy label="Link zum Ansehen" planKey={created.viewKey} />
        <p className="-mt-3 text-sm/6 text-zinc-700">
          Schick ihn an alle, die den Plan nur ansehen sollen, zum Beispiel die Großeltern.
        </p>
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() => storeKey(created.editKey)}
        >
          Plan öffnen
        </button>
      </section>
    )
  }

  const failure = mutation.data && !mutation.data.ok ? FAILURE_TEXT[mutation.data.reason] : null
  const message = failure ?? (mutation.isError ? UNKNOWN_FAILURE_TEXT : null)

  return (
    <section className="space-y-3 rounded-xl bg-white p-5 text-left shadow-xs ring-1 ring-zinc-200">
      <h2 className="text-base font-semibold">Neuen Plan anlegen</h2>
      <p className="text-sm/6 text-zinc-700">
        Du hast ein Einladungswort von uns bekommen? Dann kannst du einen eigenen Plan anlegen.
      </p>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (invite.trim() !== '') mutation.mutate(invite.trim())
        }}
      >
        <div className="space-y-1.5">
          <label htmlFor={inviteId} className="block text-sm font-medium">
            Einladungswort
          </label>
          <input
            id={inviteId}
            type="text"
            name="invite"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={invite}
            onChange={(event) => setInvite(event.target.value)}
            aria-invalid={message !== null}
            className="block w-full rounded-md border-zinc-300 text-sm shadow-xs focus:border-sky-600 focus:ring-sky-600"
          />
        </div>
        {message && (
          <p role="alert" className="text-sm text-red-800">
            {message}
          </p>
        )}
        <button
          type="submit"
          className={primaryButtonClass}
          disabled={mutation.isPending || invite.trim() === ''}
        >
          {mutation.isPending ? 'Wird angelegt …' : 'Plan anlegen'}
        </button>
      </form>
    </section>
  )
}
