import { DateRangeDisplay } from '@/components/ui/DateDisplay'
import type { Calendar } from '@/features/holidays/periods'
import type { DayRange } from '@/features/plan/plan-actions'
import { addDays, formatDay, isoWeekday, yearOf, type IsoDay } from '@/lib/dates'
import { paddedRange } from './zoom-range'

type HolidayListProps = {
  year: number
  calendar: Calendar
  gaps: Set<IsoDay>
  onOpen: (range: DayRange) => void
}

function gapsWithin(range: DayRange, gaps: Set<IsoDay>) {
  let count = 0
  for (const day of gaps) {
    if (day >= range.start && day <= range.end) count += 1
  }
  return count
}

/** School holidays and public holidays of the year, with what is still unplanned. */
export function HolidayList({ year, calendar, gaps, onOpen }: HolidayListProps) {
  const schoolHolidays = calendar.schoolHolidays.filter(
    (period) => yearOf(period.start) <= year && yearOf(period.end) >= year,
  )
  const publicHolidays = calendar.publicHolidays.filter((period) => yearOf(period.start) === year)

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <section className="rounded-lg bg-white p-4 shadow-xs ring-1 ring-zinc-200">
        <h3 className="text-sm font-semibold">Ferien {year}</h3>
        <ul className="mt-2 divide-y divide-zinc-100 text-sm">
          {schoolHolidays.map((period) => {
            const open = gapsWithin(period, gaps)
            return (
              <li key={`${period.start}-${period.name}`}>
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-sm py-2 text-left hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-sky-600"
                  onClick={() => onOpen(paddedRange(period))}
                >
                  <span className="font-medium">{period.name}</span>
                  <span className="flex items-center gap-2 text-zinc-600">
                    <DateRangeDisplay start={period.start} end={period.end} />
                    {open > 0 ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                        {open} {open === 1 ? 'Tag' : 'Tage'} offen
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        geplant
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
      <section className="rounded-lg bg-white p-4 shadow-xs ring-1 ring-zinc-200">
        <h3 className="text-sm font-semibold">Feiertage und Brückentage {year}</h3>
        <ul className="mt-2 grid gap-x-6 text-sm sm:grid-cols-2">
          {publicHolidays.map((period) => {
            const weekday = isoWeekday(period.start)
            const bridgeDay =
              weekday === 4
                ? addDays(period.start, 1)
                : weekday === 2
                  ? addDays(period.start, -1)
                  : null
            const hasBridgeDay = bridgeDay !== null && calendar.bridgeDays.includes(bridgeDay)
            return (
              <li key={period.start} className="flex items-baseline justify-between gap-3 py-1.5">
                <span className={weekday > 5 ? 'text-zinc-400' : undefined}>{period.name}</span>
                <span className="shrink-0 text-right text-zinc-600 tabular-nums">
                  {formatDay(period.start, 'EEEEEE dd.MM.')}
                  {hasBridgeDay && bridgeDay && (
                    <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-900">
                      Brückentag {formatDay(bridgeDay, 'EEEEEE dd.MM.')}
                    </span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
