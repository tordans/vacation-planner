import { DateDisplay, DateRangeDisplay } from '@/components/ui/DateDisplay'
import type { Calendar } from '@/features/holidays/periods'
import { rangeCost } from '@/features/plan/leave-account'
import type { DayRange } from '@/features/plan/plan-actions'
import { carerLabel, PARENT_ROLES, parentLabel, type Plan } from '@/features/plan/plan-schema'
import { CARER_STYLES, STAY_STYLES, stayTitle } from '@/features/plan/styles'
import { cn } from '@/lib/cn'
import { daysBetween, yearOf, type IsoDay } from '@/lib/dates'
import { paddedRange } from './zoom-range'

type PlanListProps = {
  plan: Plan
  year: number
  calendar: Calendar
  today: IsoDay
  onOpen: (range: DayRange) => void
}

function touchesYear(range: DayRange, year: number) {
  return yearOf(range.start) <= year && yearOf(range.end) >= year
}

/** Everything planned for the year as a list, sorted by date. */
export function PlanList({ plan, year, calendar, today, onOpen }: PlanListProps) {
  const rows = [
    ...plan.entries.map((entry) => ({ type: 'family' as const, item: entry })),
    ...plan.personalLeave.map((leave) => ({ type: 'personal' as const, item: leave })),
  ]
    .filter((row) => touchesYear(row.item, year))
    .toSorted((a, b) => a.item.start.localeCompare(b.item.start))

  if (rows.length === 0) {
    return (
      <p className="rounded-lg bg-white p-4 text-sm text-zinc-600 shadow-xs ring-1 ring-zinc-200">
        Für {year} ist noch nichts geplant. Klicke im Kalender auf einen Tag oder auf Ferien, um den
        Zeitraum zu öffnen und dort Zeiten einzuziehen.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-zinc-100 rounded-lg bg-white shadow-xs ring-1 ring-zinc-200">
      {rows.map((row) => {
        const { item } = row
        const length = daysBetween(item.start, item.end) + 1
        const onLeave =
          row.type === 'family'
            ? PARENT_ROLES.filter((role) => row.item.carers.includes(role))
            : [row.item.parent]
        return (
          <li
            key={item.id}
            className="grid items-center gap-x-4 gap-y-1 px-4 py-3 text-sm sm:grid-cols-[11rem_minmax(0,1fr)_auto]"
          >
            <span className="text-zinc-700">
              <DateRangeDisplay start={item.start} end={item.end} />
              <span className="block text-xs text-zinc-500">
                {length} {length === 1 ? 'Tag' : 'Tage'} ·{' '}
                <DateDisplay day={item.start} variant="relative" />
              </span>
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  STAY_STYLES[item.kind].soft,
                )}
              >
                {stayTitle(item)}
              </span>
              {row.type === 'family' ? (
                row.item.carers.length > 0 ? (
                  row.item.carers.map((carer) => (
                    <span
                      key={carer}
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        CARER_STYLES[carer].soft,
                      )}
                    >
                      {carerLabel(plan, carer)}
                    </span>
                  ))
                ) : item.end < today ? null : (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                    Betreuung offen
                  </span>
                )
              ) : (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    CARER_STYLES[row.item.parent].soft,
                  )}
                >
                  {parentLabel(plan, row.item.parent)} · eigener Urlaub
                </span>
              )}
              {item.note && <span className="truncate text-xs text-zinc-500">{item.note}</span>}
              {onLeave.length > 0 && (
                <span className="text-xs text-zinc-500">
                  {onLeave
                    .map(
                      (role) =>
                        `${parentLabel(plan, role)} ${rangeCost(plan, role, item, calendar)} Urlaubstage`,
                    )
                    .join(' · ')}
                </span>
              )}
            </span>
            <button
              type="button"
              className="justify-self-start rounded-md px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-sky-600 print:hidden"
              onClick={() => onOpen(paddedRange(item))}
            >
              Planen
            </button>
          </li>
        )
      })}
    </ul>
  )
}
