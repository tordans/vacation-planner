import { Tooltip } from '@/components/ui/tooltip'
import { useNow } from '@/hooks/use-now'
import { cn } from '@/lib/cn'
import { daysBetween, formatDayRange, today } from '@/lib/dates'
import { computeChartLayout, frameOf, MIN_WEEK_WIDTH_PX, type ChartLayout } from './poll-chart'
import type { PollRow } from './poll-data'
import type { PollRange } from './poll-schema'

const LABEL_WIDTH = 'w-28 sm:w-36'
const HEADER_HEIGHT = 'h-8'
const ROW_HEIGHT = 'h-10'

const FAMILY_COLORS = [
  'bg-sky-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-600',
  'bg-fuchsia-500',
]
const CHANCEN_COLOR = 'bg-emerald-500'

/** Longer bars hold their label; for the others it goes next to the bar. */
const LABEL_INSIDE_FROM_PERCENT = 22
/** Bars starting after this point put their label on the left, so it stays on screen. */
const LABEL_LEFT_FROM_PERCENT = 55

const WEEKDAY_BACKGROUND = '#ffffff'
const WEEKEND_BACKGROUND = '#f4f4f5'
const WEEK_LINE = '#e4e4e7'
const WEEKEND_FROM_PERCENT = (5 / 7) * 100

function dayCountText(range: PollRange) {
  const days = daysBetween(range.start, range.end) + 1
  return days === 1 ? '1 Tag' : `${days} Tage`
}

/** Weeks and weekends as one repeating background: cheap however many years the chart spans. */
function weekBackground(weekCount: number) {
  return {
    backgroundColor: WEEKDAY_BACKGROUND,
    backgroundImage: [
      `linear-gradient(to right, ${WEEK_LINE} 1px, transparent 1px)`,
      `linear-gradient(to right, transparent ${WEEKEND_FROM_PERCENT}%, ${WEEKEND_BACKGROUND} ${WEEKEND_FROM_PERCENT}%)`,
    ].join(', '),
    backgroundSize: `${100 / weekCount}% 100%`,
  }
}

function Bar({ row, range, layout }: { row: PollRow; range: PollRange; layout: ChartLayout }) {
  const { left, width } = frameOf(layout, range)
  const label = `${range.name} · ${formatDayRange(range.start, range.end)}`
  const isInside = width >= LABEL_INSIDE_FROM_PERCENT
  const color =
    row.kind === 'chancen' ? CHANCEN_COLOR : FAMILY_COLORS[row.familyIndex % FAMILY_COLORS.length]

  return (
    <>
      <div className="absolute inset-y-2" style={{ left: `${left}%`, width: `${width}%` }}>
        <Tooltip
          className="size-full"
          content={
            <>
              <span className="block">{range.name}</span>
              <span className="block font-normal text-zinc-300">
                {formatDayRange(range.start, range.end)} · {dayCountText(range)}
              </span>
            </>
          }
        >
          <div
            role="img"
            aria-label={`${row.section}: ${label}, ${dayCountText(range)}`}
            tabIndex={0}
            className={cn(
              'size-full min-w-0.5 truncate rounded px-1.5 text-xs/6 font-medium text-white outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-600',
              color,
            )}
          >
            {isInside && label}
          </div>
        </Tooltip>
      </div>
      {!isInside && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-2 text-xs/6 whitespace-nowrap text-zinc-700"
          style={
            left > LABEL_LEFT_FROM_PERCENT
              ? { right: `calc(${100 - left}% + 0.375rem)` }
              : { left: `calc(${left + width}% + 0.375rem)` }
          }
        >
          {label}
        </span>
      )}
    </>
  )
}

/** A line separates the sections, not the ranges inside one. */
function rowClass(row: PollRow) {
  return cn(ROW_HEIGHT, 'border-t', row.firstInSection ? 'border-zinc-200' : 'border-transparent')
}

function rowKey(row: PollRow) {
  return `${row.section}::${row.range?.id ?? ''}`
}

function Label({ row }: { row: PollRow }) {
  return (
    <div className={cn(rowClass(row), 'flex items-center pr-2 text-sm font-semibold')}>
      {row.firstInSection && (
        <span
          title={row.section}
          className={cn('truncate', row.kind === 'chancen' ? 'text-emerald-800' : 'text-zinc-900')}
        >
          {row.section}
        </span>
      )}
    </div>
  )
}

/** One line per range, a coloured bar per range, Chancen as green windows over everything. */
export function PollChart({ rows }: { rows: PollRow[] }) {
  const now = useNow()
  const layout = computeChartLayout(rows, today(now))

  if (!layout) {
    return (
      <p className="rounded-lg bg-white p-4 text-sm text-zinc-600 shadow-xs ring-1 ring-zinc-200">
        Noch keine Zeiträume eingetragen.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg bg-white shadow-xs ring-1 ring-zinc-200">
      {/* As wide as its content, so the labels stay stuck while the weeks scroll under them. */}
      <div className="flex w-max min-w-full">
        <div className={cn('sticky left-0 z-20 shrink-0 bg-white pl-3', LABEL_WIDTH)}>
          <div className={HEADER_HEIGHT} />
          {rows.map((row) => (
            <Label key={rowKey(row)} row={row} />
          ))}
        </div>
        <div
          className="relative min-w-0 flex-1"
          style={{ minWidth: layout.weekCount * MIN_WEEK_WIDTH_PX }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={weekBackground(layout.weekCount)}
          />
          {layout.chancen.map((frame) => (
            <div
              key={frame.id}
              aria-hidden="true"
              className="absolute inset-y-0 bg-emerald-400/20"
              style={{ left: `${frame.left}%`, width: `${frame.width}%` }}
            />
          ))}
          {layout.today !== null && (
            <div
              aria-hidden="true"
              className="absolute inset-y-0 z-10 w-0.5 bg-rose-400/70"
              style={{ left: `${layout.today}%` }}
            />
          )}
          <div className={cn('relative', HEADER_HEIGHT)}>
            {layout.months.map((month) => (
              <span
                key={month.left}
                className="absolute inset-y-0 flex items-center border-l border-zinc-300 pl-1 text-xs font-medium whitespace-nowrap text-zinc-600"
                style={{ left: `${month.left}%` }}
              >
                {month.label}
              </span>
            ))}
          </div>
          {rows.map((row) => (
            <div key={rowKey(row)} className={cn('relative', rowClass(row))}>
              {row.range ? (
                <Bar row={row} range={row.range} layout={layout} />
              ) : (
                <span className="absolute inset-y-0 left-2 flex items-center text-xs text-zinc-500">
                  Noch kein Zeitraum
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
