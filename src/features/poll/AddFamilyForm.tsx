import { useMutation } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useId, useState } from 'react'
import { buttonClass, inputClass } from '@/components/ui/classes'
import { FEDERAL_STATES, federalStateByCode } from '@/features/holidays/federal-states'
import { fetchHolidayRanges } from './fetch-holiday-ranges'
import { addFamily, addHolidays, findSection, isChancen, setFederalState } from './poll-data'
import type { Poll } from './poll-schema'
import { pollFromHash } from './poll-url'

type AddFamilyFormProps = {
  poll: Poll
  /** Year for the school holidays loaded together with a new family. */
  defaultYear: number
  onChange: (poll: Poll) => void
}

export function AddFamilyForm({ poll, defaultYear, onChange }: AddFamilyFormProps) {
  const id = useId()
  const router = useRouter()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const trimmed = name.trim()
  const problem = isChancen(trimmed)
    ? '„Chancen“ ist für gemeinsame Zeiträume reserviert.'
    : findSection(poll, trimmed)
      ? 'Diese Familie gibt es schon.'
      : null
  const mutation = useMutation({ mutationFn: fetchHolidayRanges })

  return (
    <form
      className="space-y-1"
      onSubmit={(event) => {
        event.preventDefault()
        if (trimmed === '' || problem) return
        const added = addFamily(poll, trimmed)
        if (code === '') {
          onChange(added)
          mutation.reset()
        } else {
          onChange(setFederalState(added, trimmed, code))
          const request = { code, year: defaultYear, withPublicHolidays: false }
          void mutation.mutateAsync(request).then(
            (ranges) => {
              // The poll may have changed while the holidays loaded: apply them to the latest one.
              // The router's history location is updated at once, unlike the rendered `poll`.
              const latest = pollFromHash(router.history.location.hash)
              onChange(addHolidays(latest, trimmed, code, ranges))
            },
            // The error is shown below the form.
            () => undefined,
          )
        }
        setName('')
        setCode('')
      }}
    >
      <label htmlFor={id} className="block text-sm font-medium">
        Familie hinzufügen
      </label>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <input
            id={id}
            maxLength={60}
            autoComplete="off"
            placeholder="Familie Schmidt"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
          />
        </div>
        <div className="min-w-44 flex-1">
          <label htmlFor={`${id}-state`} className="block text-xs font-medium text-zinc-600">
            Bundesland
          </label>
          <select
            id={`${id}-state`}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className={inputClass}
          >
            <option value="">Ohne Bundesland</option>
            {FEDERAL_STATES.map((state) => (
              <option key={state.code} value={state.code}>
                {state.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={buttonClass} disabled={trimmed === '' || problem !== null}>
          Anlegen
        </button>
      </div>
      {problem && (
        <p role="alert" className="text-xs text-red-800">
          {problem}
        </p>
      )}
      {mutation.isPending && (
        <p role="status" className="text-sm text-zinc-600">
          Ferien werden geladen …
        </p>
      )}
      {mutation.isError && (
        <p role="alert" className="text-sm text-red-800">
          Ferien konnten nicht geladen werden. Du kannst sie in der Familie unten noch einmal laden.
        </p>
      )}
      {mutation.isSuccess && mutation.data.length === 0 && (
        <p role="status" className="text-sm text-amber-900">
          Für {mutation.variables.year} sind in {federalStateByCode(mutation.variables.code).name}{' '}
          noch keine Ferien veröffentlicht.
        </p>
      )}
    </form>
  )
}
