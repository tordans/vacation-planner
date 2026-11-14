import { useNow } from '@/hooks/use-now'
import { today, yearOf } from '@/lib/dates'
import { AddFamilyForm } from './AddFamilyForm'
import { ChancenCard } from './ChancenCard'
import { FamilyCard } from './FamilyCard'
import { familiesOf, latestYear } from './poll-data'
import type { Poll } from './poll-schema'

type PollEditorProps = {
  poll: Poll
  onChange: (poll: Poll) => void
}

/** Families first, then the Chancen. */
export function PollEditor({ poll, onChange }: PollEditorProps) {
  const now = useNow()
  const defaultYear = latestYear(poll) ?? yearOf(today(now))

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">Eintragen</h2>
      {familiesOf(poll).map((family) => (
        <FamilyCard
          key={family.name}
          poll={poll}
          family={family}
          defaultYear={defaultYear}
          onChange={onChange}
        />
      ))}
      <div className="rounded-lg bg-white p-4 shadow-xs ring-1 ring-zinc-200">
        <AddFamilyForm poll={poll} onChange={onChange} />
      </div>
      <ChancenCard poll={poll} onChange={onChange} />
    </section>
  )
}
