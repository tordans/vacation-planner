import { TrashIcon } from '@heroicons/react/20/solid'
import { inputClass } from '@/components/ui/classes'
import { AddRangeForm } from './AddRangeForm'
import { LoadHolidays } from './LoadHolidays'
import { addHolidays, addRange, removeFamily, renameFamily } from './poll-data'
import type { Poll, PollSection } from './poll-schema'
import { RangeList } from './RangeList'

type FamilyCardProps = {
  poll: Poll
  family: PollSection
  defaultYear: number
  onChange: (poll: Poll) => void
}

/** One family: its name, its ranges and the ways to fill them. */
export function FamilyCard({ poll, family, defaultYear, onChange }: FamilyCardProps) {
  function remove() {
    const count = family.ranges.length
    if (
      count > 0 &&
      !window.confirm(`Familie „${family.name}“ mit ${count} Zeiträumen entfernen?`)
    ) {
      return
    }
    onChange(removeFamily(poll, family.name))
  }

  return (
    <section className="space-y-4 rounded-lg bg-white p-4 shadow-xs ring-1 ring-zinc-200">
      <div className="flex items-center gap-2">
        <input
          aria-label="Name der Familie"
          maxLength={60}
          defaultValue={family.name}
          className={`${inputClass} font-semibold`}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
          onBlur={(event) => {
            const next = renameFamily(poll, family.name, event.currentTarget.value)
            // Empty or taken names are not applied: show the saved name again.
            if (next === poll) event.currentTarget.value = family.name
            else onChange(next)
          }}
        />
        <button
          type="button"
          aria-label={`Familie ${family.name} entfernen`}
          className="shrink-0 rounded-md p-2 text-zinc-500 hover:bg-red-50 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-sky-600"
          onClick={remove}
        >
          <TrashIcon className="size-4" />
        </button>
      </div>
      <RangeList poll={poll} section={family} onChange={onChange} />
      <AddRangeForm
        namePlaceholder="Sommerurlaub"
        onAdd={(input) => onChange(addRange(poll, family.name, input))}
      />
      <details open={family.ranges.length === 0} className="group">
        <summary className="cursor-pointer text-sm font-medium text-sky-700 hover:text-sky-900">
          Schulferien laden
        </summary>
        <div className="mt-3">
          <LoadHolidays
            federalState={family.federalState}
            defaultYear={defaultYear}
            onLoad={(federalState, ranges) =>
              onChange(addHolidays(poll, family.name, federalState, ranges))
            }
          />
        </div>
      </details>
    </section>
  )
}
