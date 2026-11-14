import { TrashIcon } from '@heroicons/react/20/solid'
import { inputClass } from '@/components/ui/classes'
import { AddRangeForm } from './AddRangeForm'
import { LoadHolidays } from './LoadHolidays'
import { addHolidays, addRange, holidaysClipped, removeFamily, renameFamily } from './poll-data'
import { MAX_RANGES_PER_SECTION, type PollSection, type UpdatePoll } from './poll-schema'
import { RangeList } from './RangeList'

type FamilyCardProps = {
  family: PollSection
  defaultYear: number
  updatePoll: UpdatePoll
}

/** One family: its name, its ranges and the ways to fill them. */
export function FamilyCard({ family, defaultYear, updatePoll }: FamilyCardProps) {
  function remove() {
    const count = family.ranges.length
    if (
      count > 0 &&
      !window.confirm(`Familie „${family.name}“ mit ${count} Zeiträumen entfernen?`)
    ) {
      return
    }
    updatePoll((latest) => removeFamily(latest, family.name))
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
            const value = event.currentTarget.value
            // Empty or taken names are not applied: show the saved name again.
            if (!updatePoll((latest) => renameFamily(latest, family.name, value))) {
              event.currentTarget.value = family.name
            }
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
      <RangeList section={family} updatePoll={updatePoll} />
      <AddRangeForm
        namePlaceholder="Sommerurlaub"
        full={family.ranges.length >= MAX_RANGES_PER_SECTION}
        onAdd={(input) => updatePoll((latest) => addRange(latest, family.name, input))}
      />
      <details open={family.ranges.length === 0} className="group">
        <summary className="cursor-pointer text-sm font-medium text-sky-700 hover:text-sky-900">
          Schulferien laden
        </summary>
        <div className="mt-3">
          <LoadHolidays
            federalState={family.federalState}
            defaultYear={defaultYear}
            onLoad={(federalState, ranges, since) => {
              let clipped = false
              updatePoll((latest) => {
                const next = addHolidays(latest, family.name, federalState, ranges)
                clipped = holidaysClipped(next, family.name, ranges)
                return next
              }, since)
              return clipped
            }}
          />
        </div>
      </details>
    </section>
  )
}
