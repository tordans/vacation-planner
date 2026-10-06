import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { DraftInput } from '@/components/ui/DraftInput'
import { FEDERAL_STATES } from '@/features/holidays/federal-states'
import { updateParent } from '@/features/plan/plan-actions'
import { leaveBudget, PARENT_LABELS, PARENT_ROLES, type Plan } from '@/features/plan/plan-schema'
import { CARER_STYLES } from '@/features/plan/styles'
import { cn } from '@/lib/cn'
import { WEEKDAY_LABELS } from '@/lib/dates'

type SettingsDialogProps = {
  open: boolean
  onClose: () => void
  plan: Plan
  year: number
  onCommit: (plan: Plan, history?: 'push' | 'replace') => void
}

export function SettingsDialog({ open, onClose, plan, year, onCommit }: SettingsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-40">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-zinc-950/30 transition duration-150 data-closed:opacity-0"
      />
      <div className="fixed inset-0 overflow-y-auto p-4">
        <div className="flex min-h-full items-start justify-center sm:items-center">
          <DialogPanel
            transition
            className="w-full max-w-2xl space-y-5 rounded-xl bg-white p-6 shadow-xl transition duration-150 data-closed:scale-95 data-closed:opacity-0"
          >
            <div>
              <DialogTitle className="text-lg font-semibold">Einstellungen</DialogTitle>
              <p className="mt-1 text-sm text-zinc-600">
                Alles hier wird wie der Plan selbst im Link gespeichert.
              </p>
            </div>

            <label className="block text-sm font-medium">
              Bundesland für Ferien und Feiertage
              <select
                className="mt-1 block w-full rounded-md border-zinc-300 text-sm shadow-xs focus:border-sky-600 focus:ring-sky-600"
                value={plan.federalState}
                onChange={(event) => onCommit({ ...plan, federalState: event.target.value })}
              >
                {FEDERAL_STATES.map((state) => (
                  <option key={state.code} value={state.code}>
                    {state.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              {PARENT_ROLES.map((role) => {
                const parent = plan.parents[role]
                return (
                  <fieldset key={role} className="space-y-3 rounded-lg p-4 ring-1 ring-zinc-200">
                    <legend className="flex items-center gap-2 px-1 text-sm font-semibold">
                      <span className={cn('size-2.5 rounded-full', CARER_STYLES[role].dot)} />
                      {PARENT_LABELS[role]}
                    </legend>
                    <label className="block text-sm font-medium">
                      Name (optional)
                      <DraftInput
                        className="mt-1"
                        value={parent.name}
                        placeholder={PARENT_LABELS[role]}
                        maxLength={30}
                        onCommit={(name) => onCommit(updateParent(plan, role, { name }), 'replace')}
                      />
                    </label>
                    <div>
                      <p className="text-sm font-medium">Arbeitstage</p>
                      <div className="mt-1 flex gap-1">
                        {WEEKDAY_LABELS.map((label, index) => {
                          const weekday = index + 1
                          const active = parent.workingDays.includes(weekday)
                          return (
                            <button
                              key={label}
                              type="button"
                              aria-pressed={active}
                              className={cn(
                                'h-9 flex-1 rounded-md text-xs font-medium ring-1 ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600',
                                active
                                  ? 'bg-zinc-900 text-white ring-zinc-900'
                                  : 'bg-white text-zinc-500 ring-zinc-300 hover:bg-zinc-50',
                              )}
                              onClick={() =>
                                onCommit(
                                  updateParent(plan, role, {
                                    workingDays: active
                                      ? parent.workingDays.filter((day) => day !== weekday)
                                      : [...parent.workingDays, weekday],
                                  }),
                                  'replace',
                                )
                              }
                            >
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <label className="block text-sm font-medium">
                      Urlaubstage {year}
                      <DraftInput
                        className="mt-1"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={366}
                        value={String(leaveBudget(parent, year))}
                        onCommit={(value) => {
                          const days = Number(value)
                          if (!Number.isFinite(days) || days < 0 || days > 366) return
                          onCommit(
                            updateParent(plan, role, {
                              leaveDaysByYear: { ...parent.leaveDaysByYear, [year]: days },
                            }),
                            'replace',
                          )
                        }}
                      />
                    </label>
                  </fieldset>
                )
              })}
            </div>

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
