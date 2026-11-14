import { useId, useState } from 'react'
import { buttonClass, inputClass } from '@/components/ui/classes'
import { rangeProblem } from './poll-data'
import { MAX_DAY, MIN_DAY, type RangeInput } from './poll-schema'

const EMPTY: RangeInput = { name: '', start: '', end: '' }

type AddRangeFormProps = {
  /** Placeholder for the name, e.g. "Sommerurlaub". */
  namePlaceholder: string
  onAdd: (input: RangeInput) => void
}

/** Name and two dates; the button stays off until they make a valid range. */
export function AddRangeForm({ namePlaceholder, onAdd }: AddRangeFormProps) {
  const id = useId()
  const [draft, setDraft] = useState(EMPTY)
  const touched = draft.start !== '' && draft.end !== '' && draft.name !== ''
  const problem = rangeProblem(draft)

  return (
    <form
      className="space-y-1"
      onSubmit={(event) => {
        event.preventDefault()
        if (problem !== null) return
        onAdd(draft)
        setDraft(EMPTY)
      }}
    >
      <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_9.5rem_9.5rem_auto]">
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor={`${id}-name`} className="block text-xs font-medium text-zinc-600">
            Zeitraum
          </label>
          <input
            id={`${id}-name`}
            maxLength={80}
            placeholder={namePlaceholder}
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${id}-start`} className="block text-xs font-medium text-zinc-600">
            Von
          </label>
          <input
            id={`${id}-start`}
            type="date"
            min={MIN_DAY}
            max={MAX_DAY}
            value={draft.start}
            onChange={(event) => setDraft({ ...draft, start: event.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${id}-end`} className="block text-xs font-medium text-zinc-600">
            Bis
          </label>
          <input
            id={`${id}-end`}
            type="date"
            min={MIN_DAY}
            max={MAX_DAY}
            value={draft.end}
            onChange={(event) => setDraft({ ...draft, end: event.target.value })}
            className={inputClass}
          />
        </div>
        <button type="submit" className={buttonClass} disabled={problem !== null}>
          Hinzufügen
        </button>
      </div>
      {touched && problem && (
        <p role="alert" className="text-xs text-red-800">
          {problem}
        </p>
      )}
    </form>
  )
}
