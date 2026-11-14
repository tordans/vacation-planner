import { AddRangeForm } from './AddRangeForm'
import { addRange, chancenOf } from './poll-data'
import { CHANCEN_SECTION, type Poll } from './poll-schema'
import { RangeList } from './RangeList'

type ChancenCardProps = {
  poll: Poll
  onChange: (poll: Poll) => void
}

/** Windows in which everyone could meet; the chart highlights them across all families. */
export function ChancenCard({ poll, onChange }: ChancenCardProps) {
  const chancen = chancenOf(poll) ?? { name: CHANCEN_SECTION, ranges: [] }
  return (
    <section className="space-y-4 rounded-lg bg-emerald-50 p-4 ring-1 ring-emerald-200">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-emerald-950">Chancen</h3>
        <p className="text-sm/6 text-emerald-950">
          Zeiträume, in denen es für alle passen könnte. Sie sind in der Übersicht grün hinterlegt.
        </p>
      </div>
      <RangeList poll={poll} section={chancen} onChange={onChange} />
      <AddRangeForm
        namePlaceholder="Besuch bei Oma"
        onAdd={(input) => onChange(addRange(poll, CHANCEN_SECTION, input))}
      />
    </section>
  )
}
