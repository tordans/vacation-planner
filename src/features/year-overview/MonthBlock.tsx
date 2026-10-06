import { Tooltip } from '@/components/ui/tooltip'
import type { Calendar } from '@/features/holidays/periods'
import { carerLabel, parentLabel, PARENT_ROLES, type Plan } from '@/features/plan/plan-schema'
import { CARER_STYLES, STAY_STYLES, stayTitle } from '@/features/plan/styles'
import { cn } from '@/lib/cn'
import {
  addDays,
  formatDayFull,
  isoWeek,
  isoWeekday,
  MONTH_NAMES,
  WEEKDAY_LABELS,
  type IsoDay,
} from '@/lib/dates'

type MonthBlockProps = {
  year: number
  /** 0 = January */
  month: number
  plan: Plan
  calendar: Calendar
  gaps: Set<IsoDay>
  today: IsoDay
  onOpenDay: (day: IsoDay) => void
  onOpenMonth: (start: IsoDay, end: IsoDay) => void
}

function monthDays(year: number, month: number) {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`
  const first = `${prefix}01`
  const days: IsoDay[] = []
  for (let day = first; day.startsWith(prefix); day = addDays(day, 1)) days.push(day)
  return days
}

export function MonthBlock({
  year,
  month,
  plan,
  calendar,
  gaps,
  today,
  onOpenDay,
  onOpenMonth,
}: MonthBlockProps) {
  const days = monthDays(year, month)
  const first = days[0]!
  const last = days.at(-1)!
  const leadingBlanks = isoWeekday(first) - 1
  const cells: Array<IsoDay | null> = [...Array<null>(leadingBlanks).fill(null), ...days]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks = Array.from({ length: cells.length / 7 }, (_, index) =>
    cells.slice(index * 7, index * 7 + 7),
  )

  return (
    <section className="break-inside-avoid rounded-lg bg-white p-3 shadow-xs ring-1 ring-zinc-200">
      <h3>
        <button
          type="button"
          className="rounded-sm text-sm font-semibold hover:text-sky-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
          onClick={() => onOpenMonth(addDays(first, -3), addDays(last, 3))}
        >
          {MONTH_NAMES[month]}
        </button>
      </h3>
      <div className="mt-2 grid grid-cols-[1.5rem_repeat(7,minmax(0,1fr))] gap-px text-center text-xs">
        <span className="text-[0.625rem] text-zinc-400">KW</span>
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="pb-1 font-medium text-zinc-500">
            {label}
          </span>
        ))}
        {weeks.map((week) => {
          const weekDay = week.find((day) => day !== null)!
          return [
            <span
              key={`kw-${weekDay}`}
              className="self-center text-[0.625rem] text-zinc-400 tabular-nums"
            >
              {isoWeek(weekDay)}
            </span>,
            ...week.map((day, index) =>
              day === null ? (
                <span key={`blank-${weekDay}-${index}`} />
              ) : (
                <DayCell
                  key={day}
                  day={day}
                  plan={plan}
                  calendar={calendar}
                  isGap={gaps.has(day)}
                  isToday={day === today}
                  onOpen={onOpenDay}
                />
              ),
            ),
          ]
        })}
      </div>
    </section>
  )
}

type DayCellProps = {
  day: IsoDay
  plan: Plan
  calendar: Calendar
  isGap: boolean
  isToday: boolean
  onOpen: (day: IsoDay) => void
}

function DayCell({ day, plan, calendar, isGap, isToday, onOpen }: DayCellProps) {
  const info = calendar.days.get(day)
  const isWeekend = isoWeekday(day) > 5
  const entry = plan.entries.find((candidate) => candidate.start <= day && candidate.end >= day)
  const leaves = plan.personalLeave.filter(
    (candidate) => candidate.start <= day && candidate.end >= day,
  )
  const onLeave = PARENT_ROLES.filter((role) => leaves.some((leave) => leave.parent === role))

  return (
    <Tooltip
      className="flex"
      content={
        <>
          <span className="block">{formatDayFull(day)}</span>
          {info?.publicHoliday && (
            <span className="block text-rose-200">Feiertag: {info.publicHoliday}</span>
          )}
          {info?.bridgeDay && <span className="block text-orange-200">Brückentag</span>}
          {info?.schoolHoliday && (
            <span className="block text-amber-200">{info.schoolHoliday}</span>
          )}
          {entry && (
            <span className="block text-sky-200">
              {stayTitle(entry)} ·{' '}
              {entry.carers.length > 0
                ? entry.carers.map((carer) => carerLabel(plan, carer)).join(', ')
                : 'Betreuung offen'}
            </span>
          )}
          {leaves.map((leave) => (
            <span key={leave.id} className="block text-fuchsia-200">
              {parentLabel(plan, leave.parent)}: {stayTitle(leave)} (eigener Urlaub)
            </span>
          ))}
          {isGap && <span className="block text-red-300">Noch nicht geplant</span>}
        </>
      }
    >
      <button
        type="button"
        aria-label={formatDayFull(day)}
        className={cn(
          'relative flex h-9 w-full items-center justify-center rounded-sm tabular-nums outline-none hover:ring-2 hover:ring-sky-600 hover:ring-inset focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-inset',
          isWeekend ? 'bg-zinc-100 text-zinc-400' : 'bg-white',
          info?.schoolHoliday && 'bg-amber-100 text-amber-950',
          info?.schoolHoliday && isWeekend && 'text-amber-900/50',
          info?.publicHoliday && 'bg-rose-200 font-semibold text-rose-950',
          info?.bridgeDay && 'outline-2 -outline-offset-2 outline-orange-500 outline-dashed',
          isToday && 'font-bold underline decoration-2 underline-offset-2',
        )}
        onClick={() => onOpen(day)}
      >
        {Number(day.slice(8, 10))}
        {onLeave.length > 0 && (
          <span className="absolute top-0.5 left-0.5 flex gap-px">
            {onLeave.map((role) => (
              <span key={role} className={cn('size-1.5 rounded-full', CARER_STYLES[role].dot)} />
            ))}
          </span>
        )}
        {isGap && <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-red-500" />}
        {entry && (
          <span
            className={cn(
              'absolute inset-x-0 bottom-0 h-1.5',
              STAY_STYLES[entry.kind].bar,
              entry.carers.length === 0 && 'opacity-40',
              entry.start === day && 'rounded-l-full',
              entry.end === day && 'rounded-r-full',
            )}
          />
        )}
      </button>
    </Tooltip>
  )
}
