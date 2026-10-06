import { TrashIcon } from '@heroicons/react/20/solid'
import { DateRangeDisplay } from '@/components/ui/DateDisplay'
import { DraftInput } from '@/components/ui/DraftInput'
import type { Calendar } from '@/features/holidays/periods'
import { rangeCost } from '@/features/plan/leave-account'
import {
  blockersFor,
  freeWindow,
  middleOf,
  removeEntry,
  removePersonalLeave,
  splitEntry,
  toggleCarer,
  updateEntry,
  updatePersonalLeave,
  type DayRange,
} from '@/features/plan/plan-actions'
import {
  CARERS,
  carerLabel,
  parentLabel,
  type FamilyEntry,
  type PersonalLeave,
  type Plan,
  type StayKind,
} from '@/features/plan/plan-schema'
import { CARER_STYLES, STAY_STYLES } from '@/features/plan/styles'
import { useNow } from '@/hooks/use-now'
import { cn } from '@/lib/cn'
import { daysBetween, formatDayShort, isIsoDay, today } from '@/lib/dates'

export type Selection = { type: 'family' | 'personal'; id: string }

type GanttEditorProps = {
  plan: Plan
  calendar: Calendar
  selection: Selection | null
  onCommit: (plan: Plan, history?: 'push' | 'replace') => void
  onDeselect: () => void
}

const FAR_LIMITS: DayRange = { start: '1990-01-01', end: '2100-12-31' }

/** Details of the selected bar, shown below the chart. */
export function GanttEditor({ plan, calendar, selection, onCommit, onDeselect }: GanttEditorProps) {
  const entry =
    selection?.type === 'family'
      ? plan.entries.find((candidate) => candidate.id === selection.id)
      : undefined
  const leave =
    selection?.type === 'personal'
      ? plan.personalLeave.find((candidate) => candidate.id === selection.id)
      : undefined

  if (entry) {
    return (
      <EntryEditor
        key={entry.id}
        plan={plan}
        calendar={calendar}
        entry={entry}
        onCommit={onCommit}
        onDeselect={onDeselect}
      />
    )
  }
  if (leave) {
    return (
      <LeaveEditor
        key={leave.id}
        plan={plan}
        calendar={calendar}
        leave={leave}
        onCommit={onCommit}
        onDeselect={onDeselect}
      />
    )
  }
  return (
    <p className="rounded-lg bg-white p-4 text-sm text-zinc-600 shadow-xs ring-1 ring-zinc-200">
      Ziehe in der Zeile <strong className="font-semibold text-zinc-900">Wo sind wir</strong> einen
      Zeitraum auf, um ihn zu planen. In den Zeilen der Eltern ziehst du eigenen Urlaub auf. Balken
      lassen sich verschieben und an den Griffen verlängern; ein Klick öffnet die Details.
    </p>
  )
}

type EntryEditorProps = Omit<GanttEditorProps, 'selection'> & { entry: FamilyEntry }

function EntryEditor({ plan, calendar, entry, onCommit, onDeselect }: EntryEditorProps) {
  const now = useNow()
  const length = daysBetween(entry.start, entry.end) + 1
  const window = freeWindow(blockersFor(plan, { row: 'family' }, entry.id), entry, FAR_LIMITS)

  function changeDates(range: DayRange) {
    if (!isIsoDay(range.start) || !isIsoDay(range.end) || range.start > range.end) return
    if (window && (range.start < window.start || range.end > window.end)) return
    onCommit(updateEntry(plan, entry.id, range))
  }

  return (
    <section className="space-y-4 rounded-lg bg-white p-4 shadow-xs ring-1 ring-zinc-200">
      <EditorHeader
        title="Zeitraum der Familie"
        range={entry}
        length={length}
        onDeselect={onDeselect}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DateFields range={entry} window={window} onChange={changeDates} />
        <KindField
          kind={entry.kind}
          onChange={(kind) => onCommit(updateEntry(plan, entry.id, { kind }))}
        />
        <label className="block text-sm font-medium">
          Ort
          <DraftInput
            className="mt-1"
            value={entry.place}
            placeholder={entry.kind === 'away' ? 'z. B. Dänemark' : 'Zuhause'}
            maxLength={60}
            onCommit={(place) => onCommit(updateEntry(plan, entry.id, { place }), 'replace')}
          />
        </label>
        <label className="block text-sm font-medium sm:col-span-2 lg:col-span-4">
          Notiz
          <DraftInput
            className="mt-1"
            value={entry.note}
            maxLength={120}
            onCommit={(note) => onCommit(updateEntry(plan, entry.id, { note }), 'replace')}
          />
        </label>
      </div>

      <div>
        <p className="text-sm font-medium">Wer betreut?</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {CARERS.map((carer) => {
            const active = entry.carers.includes(carer)
            return (
              <button
                key={carer}
                type="button"
                aria-pressed={active}
                className={cn(
                  'rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600',
                  active
                    ? cn(CARER_STYLES[carer].bar, 'text-white ring-transparent')
                    : 'bg-white text-zinc-600 ring-zinc-300 hover:bg-zinc-50',
                )}
                onClick={() => onCommit(toggleCarer(plan, entry.id, carer))}
              >
                {carerLabel(plan, carer)}
                {carer !== 'grandparents' && (
                  <span
                    className={cn('ml-1.5 text-xs', active ? 'text-white/80' : 'text-zinc-400')}
                  >
                    {rangeCost(plan, carer, entry, calendar)} Urlaubstage
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {entry.carers.length === 0 && entry.end >= today(now) && (
          <p className="mt-2 text-xs font-medium text-red-600">
            Betreuung ist noch offen. Die Ferientage in diesem Zeitraum gelten als ungeplant.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={length < 2}
          className="rounded-md px-3 py-1.5 text-sm font-medium ring-1 ring-zinc-300 ring-inset hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-sky-600 disabled:opacity-40"
          onClick={() => onCommit(splitEntry(plan, entry.id, middleOf(entry)))}
        >
          In der Mitte teilen
        </button>
        <DeleteButton
          onClick={() => {
            onDeselect()
            onCommit(removeEntry(plan, entry.id))
          }}
        />
      </div>
    </section>
  )
}

type LeaveEditorProps = Omit<GanttEditorProps, 'selection'> & { leave: PersonalLeave }

function LeaveEditor({ plan, calendar, leave, onCommit, onDeselect }: LeaveEditorProps) {
  const length = daysBetween(leave.start, leave.end) + 1
  const window = freeWindow(blockersFor(plan, { row: leave.parent }, leave.id), leave, FAR_LIMITS)

  function changeDates(range: DayRange) {
    if (!isIsoDay(range.start) || !isIsoDay(range.end) || range.start > range.end) return
    if (window && (range.start < window.start || range.end > window.end)) return
    onCommit(updatePersonalLeave(plan, leave.id, range))
  }

  return (
    <section className="space-y-4 rounded-lg bg-white p-4 shadow-xs ring-1 ring-zinc-200">
      <EditorHeader
        title={`Eigener Urlaub ${parentLabel(plan, leave.parent)}`}
        range={leave}
        length={length}
        onDeselect={onDeselect}
      />
      <p className="text-sm text-zinc-600">
        Kostet {parentLabel(plan, leave.parent)}{' '}
        <strong className="font-semibold text-zinc-900">
          {rangeCost(plan, leave.parent, leave, calendar)} Urlaubstage
        </strong>
        . Zählt nicht als Kinderbetreuung.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DateFields range={leave} window={window} onChange={changeDates} />
        <KindField
          kind={leave.kind}
          onChange={(kind) => onCommit(updatePersonalLeave(plan, leave.id, { kind }))}
        />
        <label className="block text-sm font-medium">
          Ort
          <DraftInput
            className="mt-1"
            value={leave.place}
            maxLength={60}
            onCommit={(place) =>
              onCommit(updatePersonalLeave(plan, leave.id, { place }), 'replace')
            }
          />
        </label>
        <label className="block text-sm font-medium sm:col-span-2 lg:col-span-4">
          Notiz
          <DraftInput
            className="mt-1"
            value={leave.note}
            maxLength={120}
            onCommit={(note) => onCommit(updatePersonalLeave(plan, leave.id, { note }), 'replace')}
          />
        </label>
      </div>
      <DeleteButton
        onClick={() => {
          onDeselect()
          onCommit(removePersonalLeave(plan, leave.id))
        }}
      />
    </section>
  )
}

type EditorHeaderProps = {
  title: string
  range: DayRange
  length: number
  onDeselect: () => void
}

function EditorHeader({ title, range, length, onDeselect }: EditorHeaderProps) {
  return (
    <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h3 className="text-sm font-semibold">
        {title}
        <span className="ml-2 font-normal text-zinc-600">
          <DateRangeDisplay start={range.start} end={range.end} /> · {length}{' '}
          {length === 1 ? 'Tag' : 'Tage'}
        </span>
      </h3>
      <button
        type="button"
        className="rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-sky-600"
        onClick={onDeselect}
      >
        Schließen
      </button>
    </header>
  )
}

type DateFieldsProps = {
  range: DayRange
  window: DayRange | null
  onChange: (range: DayRange) => void
}

function DateFields({ range, window, onChange }: DateFieldsProps) {
  const inputClass =
    'mt-1 block w-full rounded-md border-zinc-300 text-sm shadow-xs focus:border-sky-600 focus:ring-sky-600'
  return (
    <>
      <label className="block text-sm font-medium">
        Von
        <input
          type="date"
          className={inputClass}
          value={range.start}
          min={window?.start}
          max={range.end}
          title={formatDayShort(range.start)}
          onChange={(event) => onChange({ start: event.target.value, end: range.end })}
        />
      </label>
      <label className="block text-sm font-medium">
        Bis
        <input
          type="date"
          className={inputClass}
          value={range.end}
          min={range.start}
          max={window?.end}
          title={formatDayShort(range.end)}
          onChange={(event) => onChange({ start: range.start, end: event.target.value })}
        />
      </label>
    </>
  )
}

const KINDS: StayKind[] = ['home', 'away']

function KindField({ kind, onChange }: { kind: StayKind; onChange: (kind: StayKind) => void }) {
  return (
    <div>
      <p className="text-sm font-medium">Art</p>
      <div className="mt-1 flex rounded-md shadow-xs">
        {KINDS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={kind === option}
            className={cn(
              'h-9.5 flex-1 px-3 text-sm font-medium ring-1 ring-inset first:rounded-l-md last:-ml-px last:rounded-r-md focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-sky-600',
              kind === option
                ? cn(STAY_STYLES[option].bar, 'text-white ring-transparent')
                : 'bg-white text-zinc-600 ring-zinc-300 hover:bg-zinc-50',
            )}
            onClick={() => onChange(option)}
          >
            {STAY_STYLES[option].label}
          </button>
        ))}
      </div>
    </div>
  )
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-red-700 ring-1 ring-red-200 ring-inset hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600"
      onClick={onClick}
    >
      <TrashIcon className="size-4" />
      Löschen
    </button>
  )
}
