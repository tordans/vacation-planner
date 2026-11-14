import { removeRange, updateRange } from './poll-data'
import type { Poll, PollSection } from './poll-schema'
import { RangeRow } from './RangeRow'

type RangeListProps = {
  poll: Poll
  section: PollSection
  onChange: (poll: Poll) => void
}

/** The editable ranges of one section. */
export function RangeList({ poll, section, onChange }: RangeListProps) {
  if (section.ranges.length === 0) return null
  return (
    <ul className="space-y-3">
      {section.ranges.map((range) => (
        <RangeRow
          // New key on every change, so the row starts over from the saved values.
          key={`${range.id}|${range.name}|${range.start}|${range.end}`}
          range={range}
          onChange={(input) => onChange(updateRange(poll, section.name, range.id, input))}
          onRemove={() => onChange(removeRange(poll, section.name, range.id))}
        />
      ))}
    </ul>
  )
}
