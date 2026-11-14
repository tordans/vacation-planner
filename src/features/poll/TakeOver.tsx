import { buttonClass } from '@/components/ui/classes'
import { DateRangeDisplay } from '@/components/ui/DateDisplay'
import { federalStateByCode } from '@/features/holidays/federal-states'
import { PlanProvider } from '@/features/plan/PlanProvider'
import { usePlan, useServerControls } from '@/features/plan/use-plan'
import { SaveStatus } from '@/features/server/SaveStatus'
import { ServerNotices } from '@/features/server/ServerNotices'
import { today, yearOf } from '@/lib/dates'
import type { Poll } from './poll-schema'
import { takeOverHousehold, takeOverIdea, takeoverItems, type TakeoverItem } from './poll-takeover'

/**
 * "In deinen Plan übernehmen": only rendered while this device holds a plan key. The plan is
 * loaded here, so a poll opened by someone without a plan never calls the server.
 */
export function TakeOver({ planKey, poll }: { planKey: string; poll: Poll }) {
  return (
    <PlanProvider planKey={planKey} year={yearOf(today())}>
      <TakeOverSection poll={poll} />
    </PlanProvider>
  )
}

function Done() {
  return (
    <span role="status" className="text-sm font-medium text-green-800">
      Übernommen
    </span>
  )
}

function TakeOverSection({ poll }: { poll: Poll }) {
  const server = useServerControls()
  const { plan, commit, readOnly, role } = usePlan()

  let body
  if (server.load === 'loading') {
    body = <p className="text-sm text-zinc-600">Plan wird geladen …</p>
  } else if (server.load === 'error') {
    body = (
      <p className="flex flex-wrap items-center gap-3 text-sm text-red-800">
        Der Plan konnte nicht geladen werden.
        <button type="button" className="font-semibold underline" onClick={server.reload}>
          Erneut versuchen
        </button>
      </p>
    )
  } else if (readOnly || role !== 'edit') {
    body = (
      <p className="text-sm text-zinc-700">Zum Übernehmen brauchst du den Link zum Bearbeiten.</p>
    )
  } else {
    const items = takeoverItems(plan, poll)
    body =
      items.length === 0 ? (
        <p className="text-sm text-zinc-700">Es gibt nichts zu übernehmen.</p>
      ) : (
        <ul className="divide-y divide-zinc-200">
          {items.map((item) => (
            <li
              key={itemKey(item)}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2"
            >
              <ItemText item={item} />
              {item.kind === 'no-federal-state' ? null : item.done ? (
                <Done />
              ) : (
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() =>
                    commit(
                      item.kind === 'household'
                        ? takeOverHousehold(plan, item.name, item.federalState)
                        : takeOverIdea(plan, item.range),
                    )
                  }
                >
                  {item.kind === 'household' ? 'Als Haushalt übernehmen' : 'Als Idee übernehmen'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )
  }

  return (
    <section className="space-y-3 rounded-lg bg-white p-4 shadow-xs ring-1 ring-zinc-200">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">In deinen Plan übernehmen</h2>
        {!readOnly && server.load === 'ready' && (
          <p className="text-sm text-zinc-600">
            <SaveStatus />
          </p>
        )}
      </div>
      <ServerNotices />
      {body}
    </section>
  )
}

function itemKey(item: TakeoverItem) {
  return item.kind === 'idea' ? `idea:${item.range.id}` : `${item.kind}:${item.name}`
}

function ItemText({ item }: { item: TakeoverItem }) {
  if (item.kind === 'no-federal-state') {
    return (
      <p className="text-sm text-zinc-700">
        {item.name}: ohne Bundesland – bitte von Hand übernehmen.
      </p>
    )
  }
  if (item.kind === 'household') {
    return (
      <p className="text-sm">
        <span className="font-medium">{item.name}</span>{' '}
        <span className="text-zinc-600">({federalStateByCode(item.federalState).name})</span>
      </p>
    )
  }
  return (
    <p className="text-sm">
      <span className="font-medium">{item.range.name}</span>{' '}
      <DateRangeDisplay start={item.range.start} end={item.range.end} className="text-zinc-600" />{' '}
      <span className="text-zinc-600">(Chance)</span>
    </p>
  )
}
