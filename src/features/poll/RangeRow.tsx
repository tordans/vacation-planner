import { TrashIcon } from '@heroicons/react/20/solid'
import { useState } from 'react'
import { inputClass } from '@/components/ui/classes'
import { rangeProblem } from './poll-data'
import { MAX_DAY, MIN_DAY, type PollRange } from './poll-schema'

type RangeRowProps = {
  range: PollRange
  onChange: (input: Pick<PollRange, 'name' | 'start' | 'end'>) => void
  onRemove: () => void
}

/**
 * Edits one range. The fields are drafts until focus leaves the row; a draft that is not valid
 * stays on screen with the reason. The parent re-keys the row when the range changes.
 */
export function RangeRow({ range, onChange, onRemove }: RangeRowProps) {
  const [draft, setDraft] = useState({ name: range.name, start: range.start, end: range.end })
  const problem = rangeProblem(draft)

  return (
    <li
      className="space-y-1"
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return
        const changed =
          draft.name !== range.name || draft.start !== range.start || draft.end !== range.end
        if (changed && problem === null) onChange(draft)
      }}
    >
      <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_9.5rem_9.5rem_auto]">
        <input
          aria-label="Bezeichnung"
          maxLength={80}
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          className={`${inputClass} col-span-2 sm:col-span-1`}
        />
        <input
          type="date"
          aria-label={`Von (${range.name})`}
          min={MIN_DAY}
          max={MAX_DAY}
          value={draft.start}
          onChange={(event) => setDraft({ ...draft, start: event.target.value })}
          className={inputClass}
        />
        <input
          type="date"
          aria-label={`Bis (${range.name})`}
          min={MIN_DAY}
          max={MAX_DAY}
          value={draft.end}
          onChange={(event) => setDraft({ ...draft, end: event.target.value })}
          className={inputClass}
        />
        <button
          type="button"
          aria-label={`${range.name} entfernen`}
          className="col-start-2 justify-self-end rounded-md p-2 text-zinc-500 hover:bg-red-50 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-sky-600 sm:col-start-auto"
          onClick={onRemove}
        >
          <TrashIcon className="size-4" />
        </button>
      </div>
      {problem && (
        <p role="alert" className="text-xs text-red-800">
          {problem} Die Änderung ist noch nicht im Link.
        </p>
      )}
    </li>
  )
}
