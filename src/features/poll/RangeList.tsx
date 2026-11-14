import { removeRange, updateRange } from './poll-data'
import type { PollSection, UpdatePoll } from './poll-schema'
import { RangeRow } from './RangeRow'

type RangeListProps = {
  section: PollSection
  updatePoll: UpdatePoll
}

/** The editable ranges of one section. */
export function RangeList({ section, updatePoll }: RangeListProps) {
  if (section.ranges.length === 0) return null
  return (
    <ul className="space-y-3">
      {section.ranges.map((range) => (
        <RangeRow
          // New key on every change, so the row starts over from the saved values.
          key={`${range.id}|${range.name}|${range.start}|${range.end}`}
          range={range}
          onChange={(input) =>
            updatePoll((latest) => updateRange(latest, section.name, range.id, input))
          }
          onRemove={() => updatePoll((latest) => removeRange(latest, section.name, range.id))}
        />
      ))}
    </ul>
  )
}
