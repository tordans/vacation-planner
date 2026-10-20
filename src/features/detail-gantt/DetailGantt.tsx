import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MinusIcon,
  PlusIcon,
} from '@heroicons/react/20/solid'
import { useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { DateRangeDisplay } from '@/components/ui/DateDisplay'
import { Tooltip } from '@/components/ui/tooltip'
import { federalStateByCode } from '@/features/holidays/federal-states'
import type { Calendar, Period } from '@/features/holidays/periods'
import { costsLeave, leaveAccount, rangeCost } from '@/features/plan/leave-account'
import {
  addEntry,
  ANY_DAY,
  addPersonalLeave,
  blockersFor,
  freeWindow,
  movableWindow,
  removeEntry,
  removePersonalLeave,
  addAbsence,
  isHouseholdId,
  removeAbsence,
  updateAbsence,
  toggleCarer,
  updateEntry,
  updatePersonalLeave,
  type DayRange,
} from '@/features/plan/plan-actions'
import {
  carerLabel,
  PARENT_ROLES,
  parentLabel,
  fixedEntries,
  type FamilyEntry,
  type HouseholdId,
  type ParentRole,
  type Plan,
} from '@/features/plan/plan-schema'
import { CARER_STYLES, STAY_STYLES, stayTitle } from '@/features/plan/styles'
import { paddedRange } from '@/features/year-overview/zoom-range'
import { useNow } from '@/hooks/use-now'
import { cn } from '@/lib/cn'
import {
  addDays,
  daysBetween,
  eachDay,
  formatDay,
  formatDayFull,
  formatDayRange,
  isoWeekday,
  maxDay,
  minDay,
  today,
  WEEKDAY_LABELS,
  type IsoDay,
} from '@/lib/dates'
import {
  boxFor,
  createScale,
  dayAtOffset,
  DEFAULT_ZOOM_INDEX,
  dragPreview,
  MAX_RANGE_DAYS,
  ZOOM_LEVELS,
  type DragMode,
} from './gantt-scale'
import { GanttBar } from './GanttBar'
import { GanttEditor, type Selection } from './GanttEditor'

/** `idea`: the lanes below "Wo sind wir" for family entries that are not decided yet. */
type EditableRow = 'family' | 'idea' | ParentRole | HouseholdId

function selectionType(row: EditableRow): Selection['type'] {
  if (row === 'family' || row === 'idea') return 'family'
  return isHouseholdId(row) ? 'absence' : 'personal'
}

function addOn(plan: Plan, row: EditableRow, period: DayRange) {
  if (row === 'family') return addEntry(plan, period)
  if (row === 'idea') return addEntry(plan, period, true)
  if (isHouseholdId(row)) return addAbsence(plan, row, period)
  return addPersonalLeave(plan, row, period)
}

function updateOn(plan: Plan, row: EditableRow, id: string, period: DayRange) {
  if (row === 'family' || row === 'idea') return updateEntry(plan, id, period)
  if (isHouseholdId(row)) return updateAbsence(plan, id, period)
  return updatePersonalLeave(plan, id, period)
}

function removeOn(plan: Plan, row: EditableRow, id: string) {
  if (row === 'family' || row === 'idea') return removeEntry(plan, id)
  if (isHouseholdId(row)) return removeAbsence(plan, id)
  return removePersonalLeave(plan, id)
}

/** Ranges a bar in this row must not overlap. Ideas overlap anything. */
function blockersOn(plan: Plan, row: EditableRow, ignoreId?: string) {
  return row === 'idea' ? [] : blockersFor(plan, { row }, ignoreId)
}

/** Ideas stacked into as few lanes as possible; overlapping ideas get separate lanes. */
function ideaLanes(ideas: FamilyEntry[]) {
  const lanes: FamilyEntry[][] = []
  for (const idea of ideas.toSorted((a, b) => a.start.localeCompare(b.start))) {
    const lane = lanes.find((candidate) => candidate.at(-1)!.end < idea.start)
    if (lane) lane.push(idea)
    else lanes.push([idea])
  }
  return lanes
}

type Drag = {
  row: EditableRow
  mode: DragMode
  id: string | null
  anchor: IsoDay
  origin: DayRange
  window: DayRange
  preview: DayRange
  moved: boolean
}

type DetailGanttProps = {
  plan: Plan
  year: number
  calendar: Calendar
  range: DayRange
  onCommit: (plan: Plan, history?: 'push' | 'replace') => void
  onChangeRange: (range: DayRange, history?: 'push' | 'replace') => void
  onClose: () => void
  /** Show the other households (information only). */
  showOthers: boolean
  /** School holidays per federal state code, for the other households. */
  householdHolidays: Map<string, Period[]>
  onEditHouseholds: () => void
}

const rowClass = 'relative h-11 border-t border-zinc-200'
const labelClass = 'flex h-11 items-center border-t border-zinc-200 px-3 text-xs font-medium'
const ideaRowClass = 'relative h-9 border-t border-dashed border-zinc-200'
const ideaLabelClass =
  'flex h-9 items-center border-t border-dashed border-zinc-200 px-3 text-xs font-medium'
const IDEA_STYLES: Record<FamilyEntry['kind'], string> = {
  away: 'bg-sky-50 text-sky-900 shadow-none outline-2 -outline-offset-2 outline-sky-600 outline-dashed',
  home: 'bg-emerald-50 text-emerald-900 shadow-none outline-2 -outline-offset-2 outline-emerald-600 outline-dashed',
}
const toolButtonClass =
  'inline-flex h-8 items-center gap-1 rounded-md bg-white px-2.5 text-xs font-medium ring-1 ring-zinc-300 ring-inset hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-sky-600 disabled:opacity-40'

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`
}

/** Zoomed planning view: reference rows on top, draggable bars below. */
export function DetailGantt({
  plan,
  year,
  calendar,
  range,
  onCommit,
  onChangeRange,
  onClose,
  showOthers,
  householdHolidays,
  onEditHouseholds,
}: DetailGanttProps) {
  const now = useNow()
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)

  const scale = createScale(range, ZOOM_LEVELS[zoomIndex] ?? 28)
  const { dayWidth } = scale
  const days = eachDay(range.start, range.end)
  const todayDay = today(now)
  const todayBox = boxFor(scale, { start: todayDay, end: todayDay })

  function pointerDay(clientX: number) {
    const bounds = gridRef.current?.getBoundingClientRect()
    return dayAtOffset(scale, clientX - (bounds?.left ?? 0))
  }

  function capturePointer(event: PointerEvent<HTMLElement>) {
    try {
      scrollRef.current?.setPointerCapture(event.pointerId)
    } catch {
      // Untrusted or already-released pointers cannot capture.
    }
  }

  function createAt(row: EditableRow, period: DayRange) {
    const result = addOn(plan, row, period)
    onCommit(result.plan)
    setSelection({ type: selectionType(row), id: result.id })
  }

  function startCreate(row: EditableRow, event: PointerEvent<HTMLDivElement>) {
    // Touch scrolls the timeline; a tap creates instead (see handleRowClick).
    if (event.button !== 0 || event.pointerType === 'touch') return
    const day = pointerDay(event.clientX)
    const anchor = { start: day, end: day }
    const window = freeWindow(blockersOn(plan, row), anchor, range)
    if (!window) return
    event.preventDefault()
    capturePointer(event)
    setDrag({
      row,
      mode: 'create',
      id: null,
      anchor: day,
      origin: anchor,
      window,
      preview: anchor,
      moved: false,
    })
  }

  function handleRowClick(row: EditableRow, event: MouseEvent<HTMLDivElement>) {
    const native = event.nativeEvent
    if (!(native instanceof PointerEvent) || native.pointerType !== 'touch') return
    if (event.target !== event.currentTarget) return
    const day = pointerDay(event.clientX)
    const period = { start: day, end: day }
    if (freeWindow(blockersOn(plan, row), period, range)) createAt(row, period)
  }

  function startBarDrag(
    row: EditableRow,
    id: string,
    mode: DragMode,
    bar: DayRange,
    event: PointerEvent<HTMLDivElement>,
  ) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    // preventDefault suppresses focus; focus by hand so the arrow keys work after a click.
    event.currentTarget.closest<HTMLElement>('[role="button"]')?.focus()
    capturePointer(event)
    const limits = { start: minDay(range.start, bar.start), end: maxDay(range.end, bar.end) }
    const window = movableWindow(blockersOn(plan, row, id), bar, limits)
    setDrag({
      row,
      mode,
      id,
      anchor: pointerDay(event.clientX),
      origin: bar,
      window,
      preview: bar,
      moved: false,
    })
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag) return
    const preview = dragPreview(
      drag.mode,
      drag.origin,
      drag.anchor,
      pointerDay(event.clientX),
      drag.window,
    )
    if (preview.start === drag.preview.start && preview.end === drag.preview.end) return
    setDrag({ ...drag, preview, moved: true })
  }

  function handlePointerUp() {
    if (!drag) return
    setDrag(null)
    if (drag.id === null) {
      createAt(drag.row, drag.preview)
      return
    }
    setSelection({ type: selectionType(drag.row), id: drag.id })
    const changed = drag.preview.start !== drag.origin.start || drag.preview.end !== drag.origin.end
    if (!changed) return
    onCommit(updateOn(plan, drag.row, drag.id, drag.preview))
  }

  /** Arrow keys move, Shift+arrow resizes the end, Delete removes: the alternative to dragging. */
  function handleBarKey(
    row: EditableRow,
    id: string,
    bar: DayRange,
    event: KeyboardEvent<HTMLDivElement>,
  ) {
    const type = selectionType(row)
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setSelection({ type, id })
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      setSelection(null)
      onCommit(removeOn(plan, row, id))
      return
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const step = event.key === 'ArrowLeft' ? -1 : 1
    const window = movableWindow(blockersOn(plan, row, id), bar, ANY_DAY)
    const next = dragPreview(
      event.shiftKey ? 'resize-end' : 'move',
      bar,
      bar.end,
      addDays(bar.end, step),
      window,
    )
    if (next.start === bar.start && next.end === bar.end) return
    setSelection({ type, id })
    onCommit(updateOn(plan, row, id, next), 'replace')
  }

  function shown(row: EditableRow, id: string, bar: DayRange) {
    return drag && drag.row === row && drag.id === id ? drag.preview : bar
  }

  function barHandlers(row: EditableRow, id: string, bar: DayRange) {
    return {
      isDragging: drag?.row === row && drag.id === id,
      onMoveStart: (event: PointerEvent<HTMLDivElement>) =>
        startBarDrag(row, id, 'move', bar, event),
      onResizeStart: (event: PointerEvent<HTMLDivElement>) =>
        startBarDrag(row, id, 'resize-start', bar, event),
      onResizeEnd: (event: PointerEvent<HTMLDivElement>) =>
        startBarDrag(row, id, 'resize-end', bar, event),
      onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => handleBarKey(row, id, bar, event),
    }
  }

  function ghost(row: EditableRow) {
    if (!drag || drag.row !== row || drag.id !== null) return null
    const box = boxFor(scale, drag.preview)
    if (!box) return null
    const length = daysBetween(drag.preview.start, drag.preview.end) + 1
    return (
      <div
        className="pointer-events-none absolute inset-y-1.5 z-20 flex items-center overflow-hidden rounded-md bg-zinc-900/15 px-2 text-xs font-medium whitespace-nowrap text-zinc-900 ring-2 ring-zinc-900 ring-inset"
        style={{ left: box.left, width: box.width }}
      >
        {plural(length, 'Tag', 'Tage')}
      </div>
    )
  }

  const fixed = fixedEntries(plan)
  const lanes = ideaLanes(plan.entries.filter((entry) => entry.isIdea))

  // Toolbar: jump between school holidays, widen the range, zoom.
  const focusDay = addDays(range.start, 7)
  const previousHoliday = calendar.schoolHolidays.findLast((period) => period.start < focusDay)
  const nextHoliday = calendar.schoolHolidays.find((period) => period.start > focusDay)
  const canWiden = scale.dayCount + 7 <= MAX_RANGE_DAYS

  const months: Array<{ key: string; label: string; days: number }> = []
  for (const day of days) {
    const key = day.slice(0, 7)
    const last = months.at(-1)
    if (last?.key === key) last.days += 1
    else months.push({ key, label: formatDay(day, 'LLLL yyyy'), days: 1 })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button type="button" className={toolButtonClass} onClick={onClose}>
          <ArrowLeftIcon className="size-4" />
          Jahresübersicht
        </button>
        <h2 className="mr-auto text-base font-semibold">
          <DateRangeDisplay start={range.start} end={range.end} />
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={toolButtonClass}
            disabled={!previousHoliday}
            onClick={() => previousHoliday && onChangeRange(paddedRange(previousHoliday))}
          >
            <ChevronLeftIcon className="size-4" />
            Ferien
          </button>
          <button
            type="button"
            className={toolButtonClass}
            disabled={!nextHoliday}
            onClick={() => nextHoliday && onChangeRange(paddedRange(nextHoliday))}
          >
            Ferien
            <ChevronRightIcon className="size-4" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={toolButtonClass}
            disabled={!canWiden}
            onClick={() =>
              onChangeRange({ start: addDays(range.start, -7), end: range.end }, 'replace')
            }
          >
            <PlusIcon className="size-4" />
            Woche davor
          </button>
          <button
            type="button"
            className={toolButtonClass}
            disabled={!canWiden}
            onClick={() =>
              onChangeRange({ start: range.start, end: addDays(range.end, 7) }, 'replace')
            }
          >
            <PlusIcon className="size-4" />
            Woche danach
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={toolButtonClass}
            aria-label="Verkleinern"
            disabled={zoomIndex === 0}
            onClick={() => setZoomIndex(zoomIndex - 1)}
          >
            <MinusIcon className="size-4" />
          </button>
          <button
            type="button"
            className={toolButtonClass}
            aria-label="Vergrößern"
            disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            onClick={() => setZoomIndex(zoomIndex + 1)}
          >
            <PlusIcon className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] overflow-hidden rounded-lg bg-white shadow-xs ring-1 ring-zinc-200">
        <div className="border-r border-zinc-200 bg-zinc-50">
          <div className="h-13" />
          <div className={cn(labelClass, 'text-zinc-600')}>Ferien</div>
          <div className={cn(labelClass, 'text-zinc-600')}>Feiertage</div>
          <div className={labelClass}>Wo sind wir</div>
          {lanes.map((_, index) => (
            <div key={index} className={cn(ideaLabelClass, 'text-zinc-500')}>
              {index === 0 && 'Ideen'}
            </div>
          ))}
          <div className={cn(ideaLabelClass, 'text-zinc-400')}>+ Idee</div>
          {PARENT_ROLES.map((role) => (
            <div key={role} className={cn(labelClass, 'gap-2')}>
              <span className={cn('size-2 shrink-0 rounded-full', CARER_STYLES[role].dot)} />
              <span className="truncate">{parentLabel(plan, role)}</span>
            </div>
          ))}
          <div className={cn(labelClass, 'gap-2')}>
            <span className={cn('size-2 shrink-0 rounded-full', CARER_STYLES.grandparents.dot)} />
            Großeltern
          </div>
          {showOthers && plan.households.length > 0 && (
            <>
              <div className="flex h-7 items-center border-t border-zinc-200 px-3 text-[0.625rem] font-semibold tracking-wide text-zinc-500 uppercase">
                Andere Haushalte
              </div>
              {plan.households.map((household) => (
                <button
                  key={household.id}
                  type="button"
                  className={cn(
                    labelClass,
                    'w-full flex-col items-start justify-center gap-0 text-left leading-tight text-zinc-600 hover:bg-zinc-100',
                  )}
                  onClick={onEditHouseholds}
                >
                  <span className="w-full truncate">{household.name || 'Haushalt'}</span>
                  {household.federalState && (
                    <span className="text-[0.625rem] font-normal text-zinc-500">
                      Ferien {federalStateByCode(household.federalState).name}
                    </span>
                  )}
                </button>
              ))}
            </>
          )}
        </div>

        <div
          ref={scrollRef}
          className="overflow-x-auto overscroll-x-contain select-none"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => setDrag(null)}
        >
          <div ref={gridRef} className="relative" style={{ width: scale.dayCount * dayWidth }}>
            {/* Day columns behind all rows */}
            <div className="pointer-events-none absolute inset-0 flex" aria-hidden="true">
              {days.map((day) => (
                <div
                  key={day}
                  className={cn(
                    'h-full shrink-0 border-l border-zinc-100',
                    isoWeekday(day) > 5 && 'bg-zinc-100',
                    isoWeekday(day) === 1 && 'border-zinc-300',
                    calendar.days.get(day)?.publicHoliday && 'bg-rose-100/70',
                  )}
                  style={{ width: dayWidth }}
                />
              ))}
            </div>
            {todayBox && (
              <div
                className="pointer-events-none absolute inset-y-0 z-30 w-0.5 bg-red-500"
                style={{ left: todayBox.left + dayWidth / 2 }}
                aria-hidden="true"
              />
            )}

            {/* Header */}
            <div className="relative flex h-6 text-xs font-semibold">
              {months.map((month) => (
                <div
                  key={month.key}
                  className="shrink-0 overflow-hidden border-l border-zinc-300 px-1.5 leading-6 whitespace-nowrap"
                  style={{ width: month.days * dayWidth }}
                >
                  {month.label}
                </div>
              ))}
            </div>
            <div className="relative flex h-7 text-center text-[0.625rem] leading-3 text-zinc-500">
              {days.map((day) => {
                const info = calendar.days.get(day)
                const weekday = isoWeekday(day)
                const showLabel = dayWidth >= 20 || weekday === 1
                return (
                  <div
                    key={day}
                    className={cn(
                      'shrink-0 overflow-visible pt-0.5 tabular-nums',
                      info?.publicHoliday && 'font-semibold text-rose-700',
                      day === todayDay && 'font-bold text-red-600',
                    )}
                    style={{ width: dayWidth }}
                  >
                    {showLabel && (
                      <>
                        {dayWidth >= 20 && (
                          <span className="block">{WEEKDAY_LABELS[weekday - 1]}</span>
                        )}
                        <span className="block">{Number(day.slice(8, 10))}</span>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {/* School holidays */}
            <div className={rowClass}>
              {calendar.schoolHolidays.map((period) => {
                const box = boxFor(scale, period)
                if (!box) return null
                return (
                  <div
                    key={`${period.start}-${period.name}`}
                    className="absolute inset-y-1.5 rounded-md bg-amber-200 text-xs font-medium text-amber-950"
                    style={{ left: box.left, width: box.width }}
                  >
                    <Tooltip
                      className="size-full items-center overflow-hidden px-2"
                      content={`${period.name} · ${formatDayRange(period.start, period.end)}`}
                    >
                      <span className="truncate">{period.name}</span>
                    </Tooltip>
                  </div>
                )
              })}
            </div>

            {/* Public holidays and bridge days */}
            <div className={rowClass}>
              {calendar.publicHolidays.map((period) => {
                const box = boxFor(scale, period)
                if (!box) return null
                return (
                  <div
                    key={period.start}
                    className="absolute inset-y-1.5 rounded-md bg-rose-300 text-xs font-semibold text-rose-950"
                    style={{ left: box.left, width: box.width }}
                  >
                    <Tooltip
                      className="size-full items-center justify-center overflow-hidden"
                      content={`${period.name} · ${formatDayFull(period.start)}`}
                    >
                      <span aria-label={period.name}>F</span>
                    </Tooltip>
                  </div>
                )
              })}
              {calendar.bridgeDays.map((day) => {
                const box = boxFor(scale, { start: day, end: day })
                if (!box) return null
                return (
                  <div
                    key={day}
                    className="absolute inset-y-1.5 rounded-md text-xs font-semibold text-orange-800 outline-2 -outline-offset-2 outline-orange-500 outline-dashed"
                    style={{ left: box.left, width: box.width }}
                  >
                    <Tooltip
                      className="size-full items-center justify-center overflow-hidden"
                      content={`Brückentag · ${formatDayFull(day)}`}
                    >
                      <span aria-label="Brückentag">B</span>
                    </Tooltip>
                  </div>
                )
              })}
            </div>

            {/* Where: family entries */}
            <div
              className={cn(rowClass, 'cursor-crosshair bg-sky-50/40')}
              onPointerDown={(event) => startCreate('family', event)}
              onClick={(event) => handleRowClick('family', event)}
            >
              {fixed.map((entry) => {
                const period = shown('family', entry.id, entry)
                const box = boxFor(scale, period)
                if (!box) return null
                const length = daysBetween(period.start, period.end) + 1
                // Open care is only a to-do while the period is not over.
                const isOpen = entry.carers.length === 0 && entry.end >= todayDay
                return (
                  <GanttBar
                    key={entry.id}
                    box={box}
                    className={cn(
                      STAY_STYLES[entry.kind].bar,
                      isOpen && 'outline-2 -outline-offset-2 outline-red-500 outline-dashed',
                    )}
                    isSelected={selection?.type === 'family' && selection.id === entry.id}
                    ariaLabel={`${stayTitle(entry)}, ${formatDayRange(period.start, period.end)}`}
                    label={
                      <>
                        {isOpen && '⚠ '}
                        {stayTitle(entry)}
                      </>
                    }
                    tooltip={
                      <>
                        <span className="block">
                          {stayTitle(entry)} · {plural(length, 'Tag', 'Tage')}
                        </span>
                        <span className="block font-normal text-zinc-300">
                          {formatDayRange(period.start, period.end)}
                        </span>
                        <span className="block font-normal text-zinc-300">
                          {isOpen
                            ? 'Betreuung offen'
                            : entry.carers.map((carer) => carerLabel(plan, carer)).join(', ')}
                        </span>
                      </>
                    }
                    {...barHandlers('family', entry.id, entry)}
                  />
                )
              })}
              {ghost('family')}
            </div>

            {/* Ideas: not decided yet, may overlap each other and the fixed entries */}
            {lanes.map((lane, index) => (
              <div key={index} className={ideaRowClass}>
                {lane.map((entry) => {
                  const period = shown('idea', entry.id, entry)
                  const box = boxFor(scale, period)
                  if (!box) return null
                  const length = daysBetween(period.start, period.end) + 1
                  return (
                    <GanttBar
                      key={entry.id}
                      box={box}
                      className={IDEA_STYLES[entry.kind]}
                      isSelected={selection?.type === 'family' && selection.id === entry.id}
                      ariaLabel={`Idee: ${stayTitle(entry)}, ${formatDayRange(period.start, period.end)}`}
                      label={stayTitle(entry)}
                      tooltip={
                        <>
                          <span className="block">
                            Idee: {stayTitle(entry)} · {plural(length, 'Tag', 'Tage')}
                          </span>
                          <span className="block font-normal text-zinc-300">
                            {formatDayRange(period.start, period.end)}
                          </span>
                          {entry.carers.length > 0 && (
                            <span className="block font-normal text-zinc-300">
                              {entry.carers.map((carer) => carerLabel(plan, carer)).join(', ')}
                            </span>
                          )}
                        </>
                      }
                      {...barHandlers('idea', entry.id, entry)}
                    />
                  )
                })}
              </div>
            ))}
            <div
              className={cn(ideaRowClass, 'cursor-crosshair')}
              onPointerDown={(event) => startCreate('idea', event)}
              onClick={(event) => handleRowClick('idea', event)}
            >
              {lanes.length === 0 && (
                <span className="pointer-events-none sticky left-2 inline-block pt-2.5 pl-2 text-xs text-zinc-400">
                  Idee aufziehen, z. B. „Bei Oma & Opa“ – Ideen dürfen sich überschneiden
                </span>
              )}
              {ghost('idea')}
            </div>

            {/* Parents: leave from family entries plus their own leave */}
            {PARENT_ROLES.map((role) => (
              <div
                key={role}
                className={cn(rowClass, 'cursor-crosshair')}
                onPointerDown={(event) => startCreate(role, event)}
                onClick={(event) => handleRowClick(role, event)}
              >
                {fixed.map((entry) => (
                  <CarerSlot
                    key={entry.id}
                    box={boxFor(scale, shown('family', entry.id, entry))}
                    isActive={entry.carers.includes(role)}
                    activeClass={STAY_STYLES[entry.kind].bar}
                    name={parentLabel(plan, role)}
                    detail={`${rangeCost(plan, role, entry, calendar)} Urlaubstage`}
                    onToggle={() => onCommit(toggleCarer(plan, entry.id, role))}
                  />
                ))}
                {plan.personalLeave
                  .filter((leave) => leave.parent === role)
                  .map((leave) => {
                    const period = shown(role, leave.id, leave)
                    const box = boxFor(scale, period)
                    if (!box) return null
                    const cost = rangeCost(plan, role, period, calendar)
                    return (
                      <GanttBar
                        key={leave.id}
                        box={box}
                        className="bg-violet-500"
                        isSelected={selection?.type === 'personal' && selection.id === leave.id}
                        ariaLabel={`Eigener Urlaub ${parentLabel(plan, role)}, ${formatDayRange(period.start, period.end)}`}
                        label={leave.place.trim() || 'Urlaub'}
                        tooltip={
                          <>
                            <span className="block">
                              Eigener Urlaub · {plural(cost, 'Urlaubstag', 'Urlaubstage')}
                            </span>
                            <span className="block font-normal text-zinc-300">
                              {formatDayRange(period.start, period.end)}
                            </span>
                          </>
                        }
                        {...barHandlers(role, leave.id, leave)}
                      />
                    )
                  })}
                {/* Days that cost this parent no leave */}
                <div className="pointer-events-none absolute inset-0 z-20 flex" aria-hidden="true">
                  {days.map((day) => (
                    <div
                      key={day}
                      className={cn(
                        'h-full shrink-0',
                        !costsLeave(plan.parents[role], day, calendar) && 'bg-hatch',
                      )}
                      style={{ width: dayWidth }}
                    />
                  ))}
                </div>
                {ghost(role)}
              </div>
            ))}

            {/* Grandparents */}
            <div className={rowClass}>
              {fixed.map((entry) => (
                <CarerSlot
                  key={entry.id}
                  box={boxFor(scale, shown('family', entry.id, entry))}
                  isActive={entry.carers.includes('grandparents')}
                  activeClass={CARER_STYLES.grandparents.bar}
                  name="Großeltern"
                  detail="kein Urlaub nötig"
                  onToggle={() => onCommit(toggleCarer(plan, entry.id, 'grandparents'))}
                />
              ))}
            </div>

            {/* Other households: information only, never needs care or leave */}
            {showOthers && plan.households.length > 0 && (
              <>
                <div className="relative h-7 border-t border-zinc-200 bg-zinc-50/80" />
                {plan.households.map((household) => (
                  <div
                    key={household.id}
                    className={cn(rowClass, 'cursor-crosshair')}
                    onPointerDown={(event) => startCreate(household.id, event)}
                    onClick={(event) => handleRowClick(household.id, event)}
                  >
                    {(household.federalState
                      ? (householdHolidays.get(household.federalState) ?? [])
                      : []
                    ).map((period) => {
                      const box = boxFor(scale, period)
                      if (!box) return null
                      return (
                        <div
                          key={`${period.start}-${period.name}`}
                          className="pointer-events-none absolute inset-y-0 flex items-start overflow-hidden border-x border-amber-300/70 bg-amber-100/60 px-1.5 pt-0.5 text-[0.625rem] font-medium whitespace-nowrap text-amber-900/80"
                          style={{ left: box.left, width: box.width }}
                        >
                          {period.name}
                        </div>
                      )
                    })}
                    {household.absences.map((absence) => {
                      const period = shown(household.id, absence.id, absence)
                      const box = boxFor(scale, period)
                      if (!box) return null
                      const title = absence.place.trim() || 'Nicht zu Hause'
                      return (
                        <GanttBar
                          key={absence.id}
                          box={box}
                          className="top-3.5 bg-zinc-500"
                          isSelected={selection?.type === 'absence' && selection.id === absence.id}
                          ariaLabel={`${household.name}: ${title}, ${formatDayRange(period.start, period.end)}`}
                          label={title}
                          tooltip={
                            <>
                              <span className="block">
                                {household.name || 'Haushalt'} nicht zu Hause
                              </span>
                              <span className="block font-normal text-zinc-300">
                                {title} · {formatDayRange(period.start, period.end)}
                              </span>
                            </>
                          }
                          {...barHandlers(household.id, absence.id, absence)}
                        />
                      )
                    })}
                    {ghost(household.id)}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-zinc-600">
        {PARENT_ROLES.map((role) => {
          const account = leaveAccount(plan, role, year, calendar)
          return (
            <span key={role} className="flex items-center gap-1.5">
              <span className={cn('size-2 rounded-full', CARER_STYLES[role].dot)} />
              {parentLabel(plan, role)}:
              <strong
                className={cn(
                  'font-semibold tabular-nums',
                  account.remaining < 0 ? 'text-red-600' : 'text-zinc-900',
                )}
              >
                {account.remaining} von {account.budget}
              </strong>
              Urlaubstagen {year} übrig
            </span>
          )
        })}
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-hatch ring-1 ring-zinc-300" />
          kostet keinen Urlaubstag
        </span>
      </div>

      <GanttEditor
        plan={plan}
        calendar={calendar}
        selection={selection}
        onCommit={onCommit}
        onDeselect={() => setSelection(null)}
        onSelect={setSelection}
      />
    </div>
  )
}

type CarerSlotProps = {
  box: ReturnType<typeof boxFor>
  isActive: boolean
  activeClass: string
  name: string
  detail: string
  onToggle: () => void
}

/** The stretch of a family entry in a carer's row. Click switches that carer on or off. */
function CarerSlot({ box, isActive, activeClass, name, detail, onToggle }: CarerSlotProps) {
  if (!box) return null
  return (
    <div className="absolute inset-y-2.5 z-10" style={{ left: box.left, width: box.width }}>
      <Tooltip
        className="size-full"
        content={
          isActive ? `${name} betreut · ${detail}. Klick entfernt.` : `Klick: ${name} betreut`
        }
      >
        <button
          type="button"
          aria-pressed={isActive}
          aria-label={`${name} betreut`}
          className={cn(
            'size-full cursor-pointer overflow-hidden rounded-md px-2 text-left text-xs font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-zinc-900',
            isActive
              ? cn(activeClass, 'text-white shadow-sm')
              : 'text-transparent outline-1 -outline-offset-1 outline-zinc-300 outline-dashed hover:bg-zinc-100 hover:text-zinc-500',
          )}
          onPointerDown={(event: PointerEvent<HTMLButtonElement>) => event.stopPropagation()}
          onClick={(event: MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation()
            onToggle()
          }}
        >
          {isActive ? detail : '+ betreut'}
        </button>
      </Tooltip>
    </div>
  )
}
