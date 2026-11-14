import { useNow } from '@/hooks/use-now'
import { today, yearOf } from '@/lib/dates'
import { AddFamilyForm } from './AddFamilyForm'
import { ChancenCard } from './ChancenCard'
import { FamilyCard } from './FamilyCard'
import { familiesOf, latestYear } from './poll-data'
import type { Poll, UpdatePoll } from './poll-schema'

type PollEditorProps = {
  poll: Poll
  updatePoll: UpdatePoll
}

/** Families first, then the Chancen. */
export function PollEditor({ poll, updatePoll }: PollEditorProps) {
  const now = useNow()
  const defaultYear = latestYear(poll) ?? yearOf(today(now))

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">Eintragen</h2>
      {familiesOf(poll).map((family) => (
        <FamilyCard
          key={family.name}
          family={family}
          defaultYear={defaultYear}
          updatePoll={updatePoll}
        />
      ))}
      <div className="rounded-lg bg-white p-4 shadow-xs ring-1 ring-zinc-200">
        <AddFamilyForm poll={poll} defaultYear={defaultYear} updatePoll={updatePoll} />
      </div>
      <ChancenCard poll={poll} updatePoll={updatePoll} />
    </section>
  )
}
