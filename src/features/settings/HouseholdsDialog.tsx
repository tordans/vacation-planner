import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { PlusIcon, TrashIcon } from '@heroicons/react/20/solid'
import { useState } from 'react'
import { DraftInput } from '@/components/ui/DraftInput'
import { FEDERAL_STATES } from '@/features/holidays/federal-states'
import {
  addAbsence,
  addHousehold,
  removeAbsence,
  removeHousehold,
  touchesYear,
  updateAbsence,
  updateHousehold,
} from '@/features/plan/plan-actions'
import type { Absence, Household, Plan } from '@/features/plan/plan-schema'
import { cn } from '@/lib/cn'
import { isIsoDay } from '@/lib/dates'

type HouseholdsDialogProps = {
  open: boolean
  onClose: () => void
  plan: Plan
  year: number
  onCommit: (plan: Plan, history?: 'push' | 'replace') => void
}

const fieldClass =
  'block w-full rounded-md border-zinc-300 text-sm shadow-xs focus:border-sky-600 focus:ring-sky-600 disabled:bg-zinc-50 disabled:text-zinc-400'
const iconButtonClass =
  'inline-flex size-9 shrink-0 items-center justify-center rounded-md text-zinc-500 ring-1 ring-zinc-300 ring-inset hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-sky-600'

/** Other households next to our plan, for information only: name, federal state, absences. */
export function HouseholdsDialog({ open, onClose, plan, year, onCommit }: HouseholdsDialogProps) {
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
              <DialogTitle className="text-lg font-semibold">Andere Haushalte</DialogTitle>
              <p className="mt-1 text-sm text-zinc-600">
                Diese Haushalte werden neben deinem Plan als Information angezeigt, zum Beispiel
                wenn die Großeltern Schulferien haben oder die Cousinen verreist sind. Sie brauchen
                keine Betreuung und kosten keine Urlaubstage. Alle Angaben werden im Link
                gespeichert.
              </p>
            </div>

            {plan.households.length === 0 && (
              <p className="text-sm text-zinc-500">Noch keine anderen Haushalte angelegt.</p>
            )}
            {plan.households.map((household) => (
              <HouseholdSection
                key={household.id}
                household={household}
                plan={plan}
                year={year}
                onCommit={onCommit}
              />
            ))}

            <AddHouseholdForm onAdd={(household) => onCommit(addHousehold(plan, household).plan)} />

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

type HouseholdSectionProps = {
  household: Household
  plan: Plan
  year: number
  onCommit: (plan: Plan, history?: 'push' | 'replace') => void
}

function HouseholdSection({ household, plan, year, onCommit }: HouseholdSectionProps) {
  const absences = household.absences
    .filter((absence) => touchesYear(absence, year))
    .toSorted((a, b) => a.start.localeCompare(b.start))
  const absencesInOtherYears = household.absences.length - absences.length

  return (
    <section className="space-y-3 rounded-lg p-4 ring-1 ring-zinc-200">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
        <DraftInput
          aria-label="Name des Haushalts"
          placeholder="z. B. Oma & Opa"
          value={household.name}
          maxLength={60}
          onCommit={(name) => onCommit(updateHousehold(plan, household.id, { name }), 'replace')}
        />
        <select
          aria-label="Bundesland"
          className={cn(fieldClass, 'max-sm:col-start-1')}
          value={household.federalState ?? ''}
          onChange={(event) =>
            onCommit(
              updateHousehold(plan, household.id, { federalState: event.target.value || null }),
              'push',
            )
          }
        >
          <option value="">Kein Bundesland</option>
          {FEDERAL_STATES.map((state) => (
            <option key={state.code} value={state.code}>
              {state.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={cn(iconButtonClass, 'max-sm:col-start-2 max-sm:row-start-1')}
          aria-label={`${household.name || 'Haushalt'} löschen`}
          title="Haushalt löschen"
          onClick={() => onCommit(removeHousehold(plan, household.id))}
        >
          <TrashIcon className="size-4" />
        </button>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Nicht zu Hause</h4>
        {absences.length === 0 && (
          <p className="text-sm text-zinc-500">In {year} keine Abwesenheit eingetragen.</p>
        )}
        {absences.map((absence) => (
          <AbsenceRow
            key={absence.id}
            absence={absence}
            onChange={(patch) => onCommit(updateAbsence(plan, absence.id, patch), 'replace')}
            onRemove={() => onCommit(removeAbsence(plan, absence.id))}
          />
        ))}
        {absencesInOtherYears > 0 && (
          <p className="text-xs text-zinc-500">
            + {absencesInOtherYears} {absencesInOtherYears === 1 ? 'Eintrag' : 'Einträge'} in
            anderen Jahren
          </p>
        )}
        <AddAbsenceForm
          year={year}
          onAdd={(range, place) => {
            const added = addAbsence(plan, household.id, range)
            const next = place ? updateAbsence(added.plan, added.id, { place }) : added.plan
            onCommit(next)
          }}
        />
      </div>
    </section>
  )
}

type AbsenceRowProps = {
  absence: Absence
  onChange: (patch: Partial<Absence>) => void
  onRemove: () => void
}

function AbsenceRow({ absence, onChange, onRemove }: AbsenceRowProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_9.5rem_9.5rem_auto]">
      <DraftInput
        aria-label="Ort"
        placeholder="Ort, z. B. Mallorca"
        value={absence.place}
        maxLength={60}
        onCommit={(place) => onChange({ place })}
      />
      <input
        type="date"
        aria-label="Von"
        className={cn(fieldClass, 'max-sm:col-start-1')}
        value={absence.start}
        max={absence.end}
        onChange={(event) => {
          const start = event.target.value
          if (isIsoDay(start) && start <= absence.end) onChange({ start })
        }}
      />
      <input
        type="date"
        aria-label="Bis"
        className={cn(fieldClass, 'max-sm:col-start-1')}
        value={absence.end}
        min={absence.start}
        onChange={(event) => {
          const end = event.target.value
          if (isIsoDay(end) && end >= absence.start) onChange({ end })
        }}
      />
      <button
        type="button"
        className={cn(iconButtonClass, 'max-sm:col-start-2 max-sm:row-start-1')}
        aria-label={
          absence.place ? `Abwesenheit in ${absence.place} löschen` : 'Abwesenheit löschen'
        }
        title="Löschen"
        onClick={onRemove}
      >
        <TrashIcon className="size-4" />
      </button>
    </div>
  )
}

type AddAbsenceFormProps = {
  year: number
  onAdd: (range: { start: string; end: string }, place: string) => void
}

function AddAbsenceForm({ year, onAdd }: AddAbsenceFormProps) {
  const [place, setPlace] = useState('')
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
        onAdd({ start, end: lastDay }, place.trim())
        setPlace('')
        setStart('')
        setEnd('')
      }}
    >
      <input
        type="text"
        aria-label="Ort der Abwesenheit"
        placeholder="Ort, z. B. Mallorca"
        maxLength={60}
        className={fieldClass}
        value={place}
        onChange={(event) => setPlace(event.target.value)}
      />
      <input
        type="date"
        aria-label="Von"
        className={cn(fieldClass, 'max-sm:col-start-1')}
        value={start}
        min={`${year - 1}-01-01`}
        max={`${year + 1}-12-31`}
        onChange={(event) => setStart(event.target.value)}
      />
      <input
        type="date"
        aria-label="Bis (leer lassen für einen einzelnen Tag)"
        title="Leer lassen für einen einzelnen Tag"
        className={cn(fieldClass, 'max-sm:col-start-1')}
        value={end}
        min={start || undefined}
        onChange={(event) => setEnd(event.target.value)}
      />
      <button
        type="submit"
        disabled={!isValid}
        aria-label="Abwesenheit hinzufügen"
        className="inline-flex size-9 items-center justify-center rounded-md bg-zinc-900 text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:opacity-40 max-sm:col-start-2 max-sm:row-start-1"
      >
        <PlusIcon className="size-4" />
      </button>
    </form>
  )
}

type AddHouseholdFormProps = {
  onAdd: (household: { name: string; federalState: string | null }) => void
}

function AddHouseholdForm({ onAdd }: AddHouseholdFormProps) {
  const [name, setName] = useState('')
  const [federalState, setFederalState] = useState('')
  const trimmed = name.trim()

  return (
    <form
      className="grid gap-2 rounded-lg bg-zinc-50 p-3 ring-1 ring-zinc-200 sm:grid-cols-[minmax(0,1fr)_12rem_auto]"
      onSubmit={(event) => {
        event.preventDefault()
        if (!trimmed) return
        onAdd({ name: trimmed, federalState: federalState || null })
        setName('')
        setFederalState('')
      }}
    >
      <input
        type="text"
        aria-label="Name des neuen Haushalts"
        placeholder="z. B. Oma & Opa"
        maxLength={60}
        className={fieldClass}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <select
        aria-label="Bundesland des neuen Haushalts"
        className={fieldClass}
        value={federalState}
        onChange={(event) => setFederalState(event.target.value)}
      >
        <option value="">Kein Bundesland</option>
        {FEDERAL_STATES.map((state) => (
          <option key={state.code} value={state.code}>
            {state.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={!trimmed}
        className="inline-flex items-center justify-center gap-1 rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:opacity-40"
      >
        <PlusIcon className="size-4" />
        Haushalt hinzufügen
      </button>
    </form>
  )
}
