import { useNow } from '@/hooks/use-now'
import { cn } from '@/lib/cn'
import {
  formatDayFull,
  formatDayRange,
  formatDayRelative,
  formatDayShort,
  formatSavedFull,
  formatSavedRelative,
  savedAgeInDays,
  type IsoDay,
  type SavedStamp,
} from '@/lib/dates'
import { Tooltip } from './tooltip'

const hintClass =
  'cursor-help underline decoration-zinc-300 decoration-dotted underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600'

type DateDisplayProps = {
  day: IsoDay
  /** `relative`: "in 3 Wochen" with the full date on hover. `absolute`: the other way round. */
  variant: 'relative' | 'absolute'
  className?: string
}

/** Every date is shown as a pair: one form visible, the other in the tooltip. */
export function DateDisplay({ day, variant, className }: DateDisplayProps) {
  const now = useNow()
  const relative = formatDayRelative(day, now)
  return (
    <Tooltip content={variant === 'relative' ? formatDayFull(day) : relative}>
      <time dateTime={day} tabIndex={0} className={cn(hintClass, className)}>
        {variant === 'relative' ? relative : formatDayShort(day)}
      </time>
    </Tooltip>
  )
}

type DateRangeDisplayProps = {
  start: IsoDay
  end: IsoDay
  className?: string
}

/** "12.–30.07.2027"; the tooltip adds when it starts and the full dates. */
export function DateRangeDisplay({ start, end, className }: DateRangeDisplayProps) {
  const now = useNow()
  return (
    <Tooltip
      content={
        <>
          <span className="block">Beginnt {formatDayRelative(start, now)}</span>
          <span className="block font-normal text-zinc-300">
            {formatDayFull(start)}
            {start !== end && <> bis {formatDayFull(end)}</>}
          </span>
        </>
      }
    >
      <time dateTime={start} tabIndex={0} className={cn(hintClass, 'tabular-nums', className)}>
        {formatDayRange(start, end)}
      </time>
    </Tooltip>
  )
}

const STALE_AFTER_DAYS = 7

/**
 * When the plan in this link was last changed. Older than a week, the age is spelled out
 * next to the timestamp: that is the old-bookmark case this display exists for.
 */
export function SavedDisplay({ stamp }: { stamp: SavedStamp | undefined }) {
  const now = useNow()
  if (!stamp) {
    return <span className="text-zinc-500">Noch nicht gespeichert</span>
  }
  const relative = formatSavedRelative(stamp, now)
  const isStale = savedAgeInDays(stamp, now) >= STALE_AFTER_DAYS
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <Tooltip content={`Zuletzt geändert ${relative}`}>
        <time dateTime={stamp} tabIndex={0} className={cn(hintClass, 'tabular-nums')}>
          Stand: {formatSavedFull(stamp)}
        </time>
      </Tooltip>
      {isStale && (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
          {relative} geändert
        </span>
      )}
    </span>
  )
}
