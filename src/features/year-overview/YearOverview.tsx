import type { Calendar } from '@/features/holidays/periods'
import { coverageGaps } from '@/features/plan/coverage-gaps'
import type { DayRange } from '@/features/plan/plan-actions'
import { PARENT_ROLES, parentLabel, type Plan } from '@/features/plan/plan-schema'
import { CARER_STYLES, STAY_STYLES } from '@/features/plan/styles'
import { useNow } from '@/hooks/use-now'
import { cn } from '@/lib/cn'
import { today } from '@/lib/dates'
import { HolidayList } from './HolidayList'
import { LeaveAccounts } from './LeaveAccounts'
import { MonthBlock } from './MonthBlock'
import { PlanList } from './PlanList'
import { zoomRangeForDay } from './zoom-range'

type YearOverviewProps = {
  plan: Plan
  year: number
  calendar: Calendar
  onOpenRange: (range: DayRange) => void
  onEditCalendar: () => void
}

const MONTHS = Array.from({ length: 12 }, (_, month) => month)

/** Read-only overview of the year. Clicking anything opens the detail planning for that period. */
export function YearOverview({
  plan,
  year,
  calendar,
  onOpenRange,
  onEditCalendar,
}: YearOverviewProps) {
  const now = useNow()
  const todayDay = today(now)
  const gaps = coverageGaps(plan, year, calendar, todayDay)

  return (
    <div className="space-y-6">
      <LeaveAccounts plan={plan} year={year} calendar={calendar} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <h2 className="text-base font-semibold">Jahresübersicht {year}</h2>
          <Legend plan={plan} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 print:grid-cols-4">
          {MONTHS.map((month) => (
            <MonthBlock
              key={month}
              year={year}
              month={month}
              plan={plan}
              calendar={calendar}
              gaps={gaps}
              today={todayDay}
              onOpenDay={(day) => onOpenRange(zoomRangeForDay(day, plan, calendar))}
              onOpenMonth={(start, end) => onOpenRange({ start, end })}
            />
          ))}
        </div>
      </section>

      <HolidayList
        year={year}
        calendar={calendar}
        gaps={gaps}
        today={todayDay}
        onOpen={onOpenRange}
        onEdit={onEditCalendar}
      />

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Geplant für {year}</h2>
        <PlanList
          plan={plan}
          year={year}
          calendar={calendar}
          today={todayDay}
          onOpen={onOpenRange}
        />
      </section>
    </div>
  )
}

function Legend({ plan }: { plan: Plan }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600">
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded-sm bg-amber-100 ring-1 ring-amber-300" /> Ferien
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded-sm bg-rose-200 ring-1 ring-rose-300" /> Feiertag
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded-sm outline-2 -outline-offset-2 outline-orange-500 outline-dashed" />{' '}
        Brückentag
      </li>
      <li className="flex items-center gap-1.5">
        <span className={cn('h-1.5 w-4 rounded-full', STAY_STYLES.away.bar)} /> Unterwegs
      </li>
      <li className="flex items-center gap-1.5">
        <span className={cn('h-1.5 w-4 rounded-full', STAY_STYLES.home.bar)} /> Zuhause
      </li>
      {PARENT_ROLES.map((role) => (
        <li key={role} className="flex items-center gap-1.5">
          <span className={cn('size-1.5 rounded-full', CARER_STYLES[role].dot)} /> eigener Urlaub{' '}
          {parentLabel(plan, role)}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-red-500" /> Ferientag ohne Betreuung
      </li>
    </ul>
  )
}
