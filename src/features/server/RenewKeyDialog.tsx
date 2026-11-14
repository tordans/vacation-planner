import { useMutation, useQueryClient } from '@tanstack/react-query'
import { buttonClass, primaryButtonClass } from '@/components/ui/classes'
import { Modal } from '@/components/ui/Modal'
import { createApiClient, type Role } from './api-client'
import { storeKey } from './key-store'
import { LinkCopy } from './LinkCopy'
import { planQueryKey } from './use-server-plan'

const COPY: Record<Role, { title: string; confirm: string; warning: string; hint: string }> = {
  view: {
    title: 'Ansicht-Link erneuern?',
    confirm: 'Ansicht-Link erneuern',
    warning:
      'Der bisherige Link zum Ansehen funktioniert danach nicht mehr. Alle, die den Plan nur ansehen, brauchen den neuen Link.',
    hint: 'Schick ihn an alle, die den Plan ansehen sollen.',
  },
  edit: {
    title: 'Bearbeiten-Link erneuern?',
    confirm: 'Bearbeiten-Link erneuern',
    warning:
      'Der bisherige Link zum Bearbeiten funktioniert danach nicht mehr, auch auf anderen Geräten. Alle, die mitbearbeiten, brauchen den neuen Link. Auf diesem Gerät wird der neue Link sofort verwendet.',
    hint: 'Speichere ihn sicher, zum Beispiel in einem Passwortmanager, und gib ihn an alle weiter, die mitbearbeiten.',
  },
}

type RenewKeyDialogProps = {
  /** Which link is being renewed; `null` closes the dialog. */
  which: Role | null
  /** The edit key of this device (only the edit role can renew). */
  planKey: string
  onClose: () => void
}

/** Ask first, then show the new link once. Renewing the edit link also switches this device to it. */
export function RenewKeyDialog({ which, planKey, onClose }: RenewKeyDialogProps) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (kind: Role) => createApiClient({ key: planKey }).renewKey(kind),
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
          <LinkCopy
            label={shown === 'edit' ? 'Neuer Link zum Bearbeiten' : 'Neuer Link zum Ansehen'}
            planKey={renewed}
          />
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
