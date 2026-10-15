import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { ArrowUturnLeftIcon, PlusIcon, TrashIcon } from '@heroicons/react/20/solid'
import { useState } from 'react'
import { DraftInput } from '@/components/ui/DraftInput'
import type { Period, YearPeriods } from '@/features/holidays/periods'
import {
  addCustomDay,
  adjustHoliday,
  removeCustomDay,
  touchesYear,
  updateCustomDay,
} from '@/features/plan/plan-actions'
import type { Plan } from '@/features/plan/plan-schema'
import { cn } from '@/lib/cn'
import { formatDayShort, isIsoDay } from '@/lib/dates'

type CalendarDialogProps = {
  open: boolean
  onClose: () => void
  plan: Plan
  year: number
  /** Holidays as imported, before the family's corrections. */
  source: YearPeriods
  federalStateName: string
  onCommit: (plan: Plan, history?: 'push' | 'replace') => void
}

const dateClass =
  'block w-full rounded-md border-zinc-300 text-sm shadow-xs focus:border-sky-600 focus:ring-sky-600 disabled:bg-zinc-50 disabled:text-zinc-400'
const iconButtonClass =
  'inline-flex size-9 shrink-0 items-center justify-center rounded-md text-zinc-500 ring-1 ring-zinc-300 ring-inset hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-sky-600'

/** All school-free days of the year: the imported ones can be corrected, own ones added. */
export function CalendarDialog({
  open,
  onClose,
  plan,
  year,
  source,
  federalStateName,
  onCommit,
}: CalendarDialogProps) {
  const customDays = plan.customDays
    .map((day, index) => ({ day, index }))
    .filter(({ day }) => touchesYear(day, year))
    .toSorted((a, b) => a.day.start.localeCompare(b.day.start))

  return (
    <Dialog open={open} onClose={onClose} className="relative z-40">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-zinc-950/30 transition duration-150 data-closed:opacity-0"
      />
      <div className="fixed inset-0 overflow-y-auto p-4">
        <div className="flex min-h-full items-start justify-center">
          <DialogPanel
            transition
            className="w-full max-w-3xl space-y-6 rounded-xl bg-white p-6 shadow-xl transition duration-150 data-closed:scale-95 data-closed:opacity-0"
          >
            <div>
              <DialogTitle className="text-lg font-semibold">
                Ferien und Feiertage {year} anpassen
              </DialogTitle>
              <p className="mt-1 text-sm text-zinc-600">
                Ferien und Feiertage für {federalStateName} kommen von mehr-schulferien.de. Du
                kannst sie hier korrigieren oder entfernen und eigene schulfreie Tage ergänzen. Alle
                Änderungen werden im Link gespeichert.
              </p>
            </div>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Eigene schulfreie Tage</h3>
              <p className="text-xs text-zinc-600">
                Zum Beispiel Studientag, Hort oder Kita geschlossen. Sie zählen wie Ferien: Das Kind
                ist zu Hause und der Tag braucht eine Betreuung.
              </p>
              {customDays.map(({ day, index }) => (
                <PeriodRow
                  key={index}
                  period={day}
                  onChange={(next) => onCommit(updateCustomDay(plan, index, next), 'replace')}
                  action={
                    <button
                      type="button"
                      className={iconButtonClass}
                      aria-label={`${day.name || 'Eintrag'} löschen`}
                      onClick={() => onCommit(removeCustomDay(plan, index))}
                    >
                      <TrashIcon className="size-4" />
                    </button>
                  }
                />
              ))}
              <AddCustomDay year={year} onAdd={(day) => onCommit(addCustomDay(plan, day))} />
            </section>

            <ImportedSection
              title="Ferien"
              kind="school"
              periods={source.schoolHolidays.filter((period) => touchesYear(period, year))}
              plan={plan}
              onCommit={onCommit}
            />
            <ImportedSection
              title="Feiertage"
              kind="public"
              periods={source.publicHolidays.filter((period) => touchesYear(period, year))}
              plan={plan}
              onCommit={onCommit}
            />

            <div className="flex justify-end">
              <button
                type="button"
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
                onClick={onClose}
              >
                Fertig
              </button>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  )
}

type ImportedSectionProps = {
  title: string
  kind: 'school' | 'public'
  periods: Period[]
  plan: Plan
  onCommit: (plan: Plan, history?: 'push' | 'replace') => void
}

function ImportedSection({ title, kind, periods, plan, onCommit }: ImportedSectionProps) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {periods.length === 0 && <p className="text-sm text-zinc-500">Noch nichts geladen.</p>}
      {periods.map((original) => {
        const adjustment = plan.adjustments.find(
          (candidate) =>
            candidate.kind === kind &&
            candidate.start === original.start &&
            candidate.end === original.end,
        )
        const isRemoved = adjustment?.replacement === null
        const shown = adjustment?.replacement ?? original
        const key = { kind, start: original.start, end: original.end }
        return (
          <PeriodRow
            key={`${original.start}-${original.end}`}
            period={shown}
            isRemoved={isRemoved}
            hint={
              isRemoved
                ? 'entfernt'
                : adjustment
                  ? `geändert, importiert: ${original.name}, ${formatDayShort(original.start)}${
                      original.start === original.end ? '' : ` bis ${formatDayShort(original.end)}`
                    }`
                  : undefined
            }
            onChange={(next) => {
              const merged = { ...shown, ...next }
              const isOriginal =
                merged.name === original.name &&
                merged.start === original.start &&
                merged.end === original.end
              onCommit(adjustHoliday(plan, key, isOriginal ? undefined : merged), 'replace')
            }}
            action={
              adjustment ? (
                <button
                  type="button"
                  className={iconButtonClass}
                  aria-label={`${original.name} zurücksetzen`}
                  title="Zurücksetzen"
                  onClick={() => onCommit(adjustHoliday(plan, key, undefined))}
                >
                  <ArrowUturnLeftIcon className="size-4" />
                </button>
              ) : (
                <button
                  type="button"
                  className={iconButtonClass}
                  aria-label={`${original.name} entfernen`}
                  title="Entfernen"
                  onClick={() => onCommit(adjustHoliday(plan, key, null))}
                >
                  <TrashIcon className="size-4" />
                </button>
              )
            }
          />
        )
      })}
    </section>
  )
}

type PeriodRowProps = {
  period: Period
  isRemoved?: boolean
  hint?: string
  onChange: (patch: Partial<Period>) => void
  action: React.ReactNode
}

function PeriodRow({ period, isRemoved = false, hint, onChange, action }: PeriodRowProps) {
  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_9.5rem_9.5rem_auto]">
        <DraftInput
          aria-label="Name"
          value={period.name}
          disabled={isRemoved}
          maxLength={60}
          className={cn('disabled:bg-zinc-50 disabled:text-zinc-400', isRemoved && 'line-through')}
          onCommit={(name) => onChange({ name })}
        />
        <input
          type="date"
          aria-label="Von"
          className={cn(dateClass, 'max-sm:col-start-1')}
          value={period.start}
          max={period.end}
          disabled={isRemoved}
          onChange={(event) => {
            const start = event.target.value
            if (isIsoDay(start) && start <= period.end) onChange({ start })
          }}
        />
        <input
          type="date"
          aria-label="Bis"
          className={cn(dateClass, 'max-sm:col-start-1')}
          value={period.end}
          min={period.start}
          disabled={isRemoved}
          onChange={(event) => {
            const end = event.target.value
            if (isIsoDay(end) && end >= period.start) onChange({ end })
          }}
        />
        <div className="max-sm:col-start-2 max-sm:row-start-1">{action}</div>
      </div>
      {hint && <p className="mt-1 text-xs text-amber-800">{hint}</p>}
    </div>
  )
}

function AddCustomDay({ year, onAdd }: { year: number; onAdd: (day: Period) => void }) {
  const [name, setName] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const lastDay = end || start
  const isValid = isIsoDay(start) && isIsoDay(lastDay) && start <= lastDay

  return (
    <form
      className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg bg-zinc-50 p-3 ring-1 ring-zinc-200 sm:grid-cols-[minmax(0,1fr)_9.5rem_9.5rem_auto]"
      onSubmit={(event) => {
        event.preventDefault()
        if (!isValid) return
        onAdd({ name: name.trim() || 'Schulfrei', start, end: lastDay })
        setName('')
        setStart('')
        setEnd('')
      }}
    >
      <input
        type="text"
        aria-label="Name des schulfreien Tags"
        placeholder="z. B. Studientag"
        maxLength={60}
        className={dateClass}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <input
        type="date"
        aria-label="Von"
        className={cn(dateClass, 'max-sm:col-start-1')}
        value={start}
        min={`${year - 1}-01-01`}
        max={`${year + 1}-12-31`}
        onChange={(event) => setStart(event.target.value)}
      />
      <input
        type="date"
        aria-label="Bis (leer lassen für einen einzelnen Tag)"
        title="Leer lassen für einen einzelnen Tag"
        className={cn(dateClass, 'max-sm:col-start-1')}
        value={end}
        min={start || undefined}
        onChange={(event) => setEnd(event.target.value)}
      />
      <button
        type="submit"
        disabled={!isValid}
        aria-label="Schulfreien Tag hinzufügen"
        className="inline-flex size-9 items-center justify-center rounded-md bg-zinc-900 text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:opacity-40 max-sm:col-start-2 max-sm:row-start-1"
      >
        <PlusIcon className="size-4" />
      </button>
    </form>
  )
}
