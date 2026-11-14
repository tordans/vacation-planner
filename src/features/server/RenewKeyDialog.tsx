import { useMutation, useQueryClient } from '@tanstack/react-query'
import { buttonClass, primaryButtonClass } from '@/components/ui/classes'
import { Modal } from '@/components/ui/Modal'
import { createApiClient, type LinkKind } from './api-client'
import { storeKey } from './key-store'
import { LinkCopy } from './LinkCopy'
import { planQueryKey } from './use-server-plan'

const COPY: Record<
  LinkKind,
  { title: string; confirm: string; warning: string; hint: string; label: string }
> = {
  view: {
    title: 'Ansicht-Link erneuern?',
    confirm: 'Ansicht-Link erneuern',
    warning:
      'Der bisherige Link zum Ansehen funktioniert danach nicht mehr. Alle, die den Plan nur ansehen, brauchen den neuen Link.',
    hint: 'Schick ihn an alle, die den Plan ansehen sollen.',
    label: 'Neuer Link zum Ansehen',
  },
  edit: {
    title: 'Bearbeiten-Link erneuern?',
    confirm: 'Bearbeiten-Link erneuern',
    warning:
      'Der bisherige Link zum Bearbeiten funktioniert danach nicht mehr, auch auf anderen Geräten. Alle, die mitbearbeiten, brauchen den neuen Link. Auf diesem Gerät wird der neue Link sofort verwendet.',
    hint: 'Speichere ihn sicher, zum Beispiel in einem Passwortmanager, und gib ihn an alle weiter, die mitbearbeiten.',
    label: 'Neuer Link zum Bearbeiten',
  },
  calendar: {
    title: 'Kalender-Link erstellen?',
    confirm: 'Kalender-Link erstellen',
    warning:
      'Mit dem geheimen Kalender-Link zeigen Google Kalender, Apple Kalender oder Outlook eure festen Zeiträume, den eigenen Urlaub und eigene schulfreie Tage an, mit dem Vorsatz „Urlaubsplan:“. Wer den Link hat, kann diese Termine lesen, aber nichts ändern. Gab es schon einen Kalender-Link, funktioniert er danach nicht mehr.',
    hint: 'In Google Kalender: „Weitere Kalender“ → „Per URL“ → Link einfügen. Google lädt den Kalender nur etwa alle 12 bis 24 Stunden neu.',
    label: 'Kalender-Link (iCal)',
  },
}

type RenewKeyDialogProps = {
  /** Which link is being renewed; `null` closes the dialog. */
  which: LinkKind | null
  /** The edit key of this device (only the edit role can renew). */
  planKey: string
  onClose: () => void
}

/** Ask first, then show the new link once. Renewing the edit link also switches this device to it. */
export function RenewKeyDialog({ which, planKey, onClose }: RenewKeyDialogProps) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (kind: LinkKind) => createApiClient({ key: planKey }).renewKey(kind),
    onSuccess: (newKey, kind) => {
      if (kind !== 'edit') return
      // Carry the loaded plan over to the new key, so the screen stays and this dialog keeps open.
      const loaded = queryClient.getQueryData(planQueryKey(planKey))
      if (loaded) queryClient.setQueryData(planQueryKey(newKey), loaded)
      storeKey(newKey)
    },
  })

  function close() {
    mutation.reset()
    onClose()
  }

  // Keep the last text while the dialog fades out.
  const shown = which ?? mutation.variables ?? 'view'
  const text = COPY[shown]
  const renewed = mutation.data

  return (
    <Modal open={which !== null} onClose={close} title={renewed ? 'Neuer Link' : text.title}>
      {renewed ? (
        <>
          <p className="text-sm/6 text-zinc-700">
            Den neuen Link siehst du <strong className="font-semibold">nur jetzt</strong>.{' '}
            {text.hint}
          </p>
          <LinkCopy label={text.label} planKey={renewed} isCalendar={shown === 'calendar'} />
          <div className="flex justify-end">
            <button type="button" className={primaryButtonClass} onClick={close}>
              Fertig
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm/6 text-zinc-700">{text.warning}</p>
          {mutation.isError && (
            <p role="alert" className="text-sm text-red-800">
              Der Link konnte nicht erneuert werden. Bitte die Verbindung prüfen und noch einmal
              versuchen.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonClass} onClick={close}>
              Abbrechen
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(shown)}
            >
              {mutation.isPending ? 'Wird erneuert …' : text.confirm}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
