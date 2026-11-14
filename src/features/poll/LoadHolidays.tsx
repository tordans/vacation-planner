import { useMutation } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { buttonClass, inputClass, linkClass } from '@/components/ui/classes'
import { FEDERAL_STATES, federalStateByCode } from '@/features/holidays/federal-states'
import { fetchYearPeriods } from '@/features/holidays/fetch-periods'
import { holidayRanges } from './holiday-ranges'
import type { RangeInput } from './poll-schema'

const DEFAULT_FEDERAL_STATE = 'BE'
const FIRST_YEAR = 2020
const LAST_YEAR = 2040

type LoadHolidaysProps = {
  /** The family's federal state from an earlier load. */
  federalState: string | undefined
  defaultYear: number
  onLoad: (federalState: string, ranges: RangeInput[]) => void
}

type Request = { code: string; year: number; withPublicHolidays: boolean }

/**
 * School holidays (optionally public holidays and bridge days) of a federal state and year
 * from mehr-schulferien.de, through the same cache the planner uses.
 */
export function LoadHolidays({ federalState, defaultYear, onLoad }: LoadHolidaysProps) {
  const id = useId()
  const [code, setCode] = useState(federalState ?? DEFAULT_FEDERAL_STATE)
  const [year, setYear] = useState(defaultYear)
  const [withPublicHolidays, setWithPublicHolidays] = useState(false)
  const [empty, setEmpty] = useState(false)
  const mutation = useMutation({
    mutationFn: async ({ code, year, withPublicHolidays }: Request) =>
      holidayRanges(
        await fetchYearPeriods(federalStateByCode(code).slug, year),
        withPublicHolidays,
      ),
  })

  function load() {
    setEmpty(false)
    mutation.mutate(
      { code, year, withPublicHolidays },
      {
        onSuccess: (ranges) => {
          if (ranges.length === 0) setEmpty(true)
          else onLoad(code, ranges)
        },
      },
    )
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault()
        load()
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <label htmlFor={`${id}-state`} className="block text-xs font-medium text-zinc-600">
            Bundesland
          </label>
          <select
            id={`${id}-state`}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className={inputClass}
          >
            {FEDERAL_STATES.map((state) => (
              <option key={state.code} value={state.code}>
                {state.name}
              </option>
            ))}
          </select>
        </div>
        <div className="w-24">
          <label htmlFor={`${id}-year`} className="block text-xs font-medium text-zinc-600">
            Jahr
          </label>
          <input
            id={`${id}-year`}
            type="number"
            min={FIRST_YEAR}
            max={LAST_YEAR}
            value={year}
            onChange={(event) => setYear(Number(event.target.value) || defaultYear)}
            className={inputClass}
          />
        </div>
        <button type="submit" className={buttonClass} disabled={mutation.isPending}>
          {mutation.isPending ? 'Wird geladen …' : 'Ferien laden'}
        </button>
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={withPublicHolidays}
          onChange={(event) => setWithPublicHolidays(event.target.checked)}
          className="rounded border-zinc-300 text-sky-700 focus:ring-sky-600"
        />
        Feiertage und Brückentage mit laden
      </label>
      {mutation.isError && (
        <p role="alert" className="text-sm text-red-800">
          Ferien konnten nicht geladen werden. Bitte später noch einmal versuchen.
        </p>
      )}
      {empty && (
        <p role="status" className="text-sm text-amber-900">
          Für {year} sind in {federalStateByCode(code).name} noch keine Ferien veröffentlicht.
        </p>
      )}
      <p className="text-xs text-zinc-500">
        Daten von{' '}
        <a
          className={linkClass}
          href="https://www.mehr-schulferien.de"
          target="_blank"
          rel="noreferrer"
        >
          mehr-schulferien.de
        </a>
        .
      </p>
    </form>
  )
}
