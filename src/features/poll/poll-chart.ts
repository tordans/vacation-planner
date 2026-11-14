import { addDays, daysBetween, formatDay, isoWeekday, type IsoDay } from '@/lib/dates'
import type { PollRow } from './poll-data'
import type { PollRange } from './poll-schema'

/** Narrowest a week may get; wider screens stretch the chart, narrower ones scroll. */
export const MIN_WEEK_WIDTH_PX = 40

/** Days a month needs on the chart to fit its label. */
const MIN_DAYS_FOR_MONTH_LABEL = 10

type Frame = { left: number; width: number }

export type ChartLayout = {
  /** The Monday the chart starts on. */
  start: IsoDay
  weekCount: number
  dayCount: number
  months: Array<{ label: string; left: number }>
  /** Windows that are highlighted over the whole chart, by range id. */
  chancen: Array<Frame & { id: string }>
  today: number | null
}

/** Week start (Monday) of a day. */
function mondayOf(day: IsoDay) {
  return addDays(day, 1 - isoWeekday(day))
}

function firstOfNextMonth(day: IsoDay) {
  const year = Number(day.slice(0, 4))
  const month = Number(day.slice(5, 7))
  return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
}

/** Position and width in percent of the chart. Bars include their last day. */
export function frameOf(layout: Pick<ChartLayout, 'start' | 'dayCount'>, range: PollRange): Frame {
  const left = daysBetween(layout.start, range.start)
  const days = daysBetween(range.start, range.end) + 1
  return { left: (left / layout.dayCount) * 100, width: (days / layout.dayCount) * 100 }
}

/**
 * Lays the chart out in whole weeks with a week of room on both sides.
 * `null` while there is no range to show.
 */
export function computeChartLayout(rows: PollRow[], today: IsoDay): ChartLayout | null {
  const ranges = rows.flatMap((row) => (row.range ? [row.range] : []))
  if (ranges.length === 0) return null
  const first = ranges.map((range) => range.start).toSorted()[0]!
  const last = ranges
    .map((range) => range.end)
    .toSorted()
    .at(-1)!

  const start = mondayOf(addDays(first, -7))
  const end = addDays(mondayOf(addDays(last, 7)), 6)
  const dayCount = daysBetween(start, end) + 1
  const layout = { start, dayCount }

  const monthStarts: IsoDay[] = []
  for (let day = start; day <= end; day = firstOfNextMonth(day)) monthStarts.push(day)
  const leftOf = (day: IsoDay) => (Math.max(daysBetween(start, day), 0) / dayCount) * 100
  // The end of a first month has no room for its name: at the narrowest, 10 days are 57px.
  if (monthStarts.length > 1 && daysBetween(start, monthStarts[1]!) < MIN_DAYS_FOR_MONTH_LABEL) {
    monthStarts.shift()
  }
  const months = monthStarts.map((day, index) => ({
    label: formatDay(day, index === 0 || day.slice(5, 7) === '01' ? 'LLL yyyy' : 'LLL').replaceAll(
      '.',
      '',
    ),
    left: leftOf(day),
  }))

  return {
    ...layout,
    weekCount: dayCount / 7,
    months,
    chancen: rows.flatMap((row) =>
      row.kind === 'chancen' && row.range
        ? [{ id: row.range.id, ...frameOf(layout, row.range) }]
        : [],
    ),
    today: today >= start && today <= end ? (daysBetween(start, today) / dayCount) * 100 : null,
  }
}
