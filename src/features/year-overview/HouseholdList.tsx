import { DateRangeDisplay } from '@/components/ui/DateDisplay'
import { federalStateByCode } from '@/features/holidays/federal-states'
import type { Period } from '@/features/holidays/periods'
import { touchesYear } from '@/features/plan/plan-actions'
import type { Household } from '@/features/plan/plan-schema'
import { cn } from '@/lib/cn'
import type { IsoDay } from '@/lib/dates'

type HouseholdListProps = {
  year: number
  households: Household[]
  /** School holidays per federal state code. */
  householdHolidays: Map<string, Period[]>
  today: IsoDay
  showOthers: boolean
  onShowOthers: (show: boolean) => void
  onEditHouseholds: () => void
}

const PAST_ROW_CLASS =
  'opacity-50 transition duration-150 hover:opacity-100 focus-within:opacity-100 motion-reduce:transition-none print:opacity-100'

const EDIT_BUTTON_CLASS =
  'rounded-md px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-sky-600 print:hidden'

/** Other households for information: their school holidays and times away from home. */
export function HouseholdList({
  year,
  households,
  householdHolidays,
  today,
  showOthers,
  onShowOthers,
  onEditHouseholds,
}: HouseholdListProps) {
  return (
    <section className="rounded-lg bg-white p-4 shadow-xs ring-1 ring-zinc-200">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Andere Haushalte {year}</h3>
        <button type="button" className={EDIT_BUTTON_CLASS} onClick={onEditHouseholds}>
          Bearbeiten
        </button>
      </div>

      {households.length === 0 ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600">
          <p>
            Füge Großeltern oder Cousinen als andere Haushalte hinzu, um ihre Schulferien und
            Abwesenheiten zu sehen. Das beeinflusst deine Planung nicht.
          </p>
          <button type="button" className={EDIT_BUTTON_CLASS} onClick={onEditHouseholds}>
            Haushalt hinzufügen
          </button>
        </div>
      ) : !showOthers ? (
        <div className="mt-2 flex items-center justify-between gap-3 text-sm text-zinc-600">
          <span>Ausgeblendet</span>
          <button type="button" className={EDIT_BUTTON_CLASS} onClick={() => onShowOthers(true)}>
            Einblenden
          </button>
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-zinc-100 text-sm">
          {households.map((household) => {
            const holidays = household.federalState
              ? (householdHolidays.get(household.federalState) ?? [])
                  .filter((period) => touchesYear(period, year))
                  .toSorted((a, b) => a.start.localeCompare(b.start))
              : []
            const absences = household.absences
              .filter((absence) => touchesYear(absence, year))
              .toSorted((a, b) => a.start.localeCompare(b.start))
            return (
              <li key={household.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{household.name}</span>
                  {household.federalState && (
                    <span className="text-xs text-zinc-500">
                      {federalStateByCode(household.federalState).name}
                    </span>
                  )}
                </div>

                {holidays.length > 0 && (
                  <ul className="space-y-1">
                    {holidays.map((period) => (
                      <li
                        key={`${period.start}-${period.name}`}
                        className={cn(
                          'flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5',
                          period.end < today && PAST_ROW_CLASS,
                        )}
                      >
                        <span className="text-zinc-700">{period.name}</span>
                        <span className="text-zinc-600">
                          <DateRangeDisplay start={period.start} end={period.end} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {absences.length > 0 ? (
                  <ul className="space-y-1">
                    {absences.map((absence) => (
                      <li
                        key={absence.id}
                        className={cn(
                          'flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5',
                          absence.end < today && PAST_ROW_CLASS,
                        )}
                      >
                        <span className="text-zinc-700">
                          nicht zu Hause
                          {absence.place && (
                            <span className="text-zinc-500"> · {absence.place}</span>
                          )}
                          {absence.note && <span className="text-zinc-500"> ({absence.note})</span>}
                        </span>
                        <span className="text-zinc-600">
                          <DateRangeDisplay start={absence.start} end={absence.end} />
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-zinc-500">Keine Abwesenheiten in {year}</p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
