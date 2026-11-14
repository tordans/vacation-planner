import { ArrowUpTrayIcon } from '@heroicons/react/20/solid'
import { useState } from 'react'
import type { Period, YearPeriods } from '@/features/holidays/periods'
import { touchesYear } from '@/features/plan/plan-actions'
import { cn } from '@/lib/cn'
import { formatDayRange } from '@/lib/dates'
import { importStatus, parseIcs, type ImportStatus } from './ics-import'

const MAX_FILE_BYTES = 1_000_000

const STATUS_HINT: Record<ImportStatus, string | undefined> = {
  added: 'schon eingetragen',
  known: 'schon schulfrei (Ferien, Feiertag oder Wochenende)',
  new: undefined,
}

type Candidate = { event: Period; status: ImportStatus; isChecked: boolean }

type Loaded = { fileName: string; candidates: Candidate[]; otherYears: number }

type IcsImportProps = {
  year: number
  /** Holidays of the shown year with the family's corrections and own days. */
  calendar: YearPeriods
  customDays: Period[]
  onImport: (days: Period[]) => void
}

/**
 * Reads an iCal file (drag and drop or file picker) and offers its events of the shown year as
 * own school-free days. Days that are school-free already start unchecked.
 */
export function IcsImport({ year, calendar, customDays, onImport }: IcsImportProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  async function read(file: File | undefined) {
    setError(null)
    setLoaded(null)
    if (!file) return
    if (file.size > MAX_FILE_BYTES) return setError('Die Datei ist zu groß (höchstens 1 MB).')
    const text = await file.text()
    if (!/BEGIN:VCALENDAR/i.test(text)) return setError('Das ist keine iCal-Datei (.ics).')
    const events = parseIcs(text)
    const inYear = events.filter((event) => touchesYear(event, year))
    if (inYear.length === 0) {
      return setError(
        events.length === 0
          ? 'In der Datei stehen keine Termine.'
          : `In der Datei stehen keine Termine für ${year}. Wechsle das Jahr und lade sie dort.`,
      )
    }
    setLoaded({
      fileName: file.name,
      otherYears: events.length - inYear.length,
      candidates: inYear.map((event) => {
        const status = importStatus(event, calendar, customDays)
        return { event, status, isChecked: status === 'new' }
      }),
    })
  }

  if (loaded) {
    const checked = loaded.candidates.filter((candidate) => candidate.isChecked)
    return (
      <div className="space-y-3 rounded-lg bg-zinc-50 p-3 ring-1 ring-zinc-200">
        <p className="text-sm">
          <span className="font-medium">{loaded.fileName}</span>: {loaded.candidates.length}{' '}
          {loaded.candidates.length === 1 ? 'Termin' : 'Termine'} für {year}. Wähle aus, welche als
          schulfrei gelten sollen.
          {loaded.otherYears > 0 &&
            ` ${loaded.otherYears} weitere aus anderen Jahren: dort die Datei noch einmal laden.`}
        </p>
        <ul className="space-y-1">
          {loaded.candidates.map((candidate, index) => (
            <li key={`${candidate.event.start}-${candidate.event.end}-${candidate.event.name}`}>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded-sm border-zinc-300 text-sky-600 focus:ring-sky-600"
                  checked={candidate.isChecked}
                  disabled={candidate.status === 'added'}
                  onChange={(event) =>
                    setLoaded({
                      ...loaded,
                      candidates: loaded.candidates.map((other, position) =>
                        position === index ? { ...other, isChecked: event.target.checked } : other,
                      ),
                    })
                  }
                />
                <span className={cn(candidate.status === 'added' && 'text-zinc-400')}>
                  <span className="tabular-nums">
                    {formatDayRange(candidate.event.start, candidate.event.end)}
                  </span>{' '}
                  {candidate.event.name}
                  {STATUS_HINT[candidate.status] && (
                    <span className="block text-xs text-zinc-500">
                      {STATUS_HINT[candidate.status]}
                    </span>
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-300 ring-inset hover:bg-white"
            onClick={() => setLoaded(null)}
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={checked.length === 0}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:opacity-40"
            onClick={() => {
              onImport(checked.map((candidate) => candidate.event))
              setLoaded(null)
            }}
          >
            {checked.length === 1 ? '1 Tag übernehmen' : `${checked.length} übernehmen`}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <label
        className={cn(
          'flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 p-3 text-sm text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 has-focus-visible:outline-2 has-focus-visible:outline-sky-600',
          isDragging && 'border-sky-600 bg-sky-50 text-sky-900',
        )}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          void read(event.dataTransfer.files[0])
        }}
      >
        <ArrowUpTrayIcon className="size-4 shrink-0" />
        <span>iCal-Datei (.ics) hierher ziehen oder auswählen</span>
        <input
          type="file"
          accept=".ics,text/calendar"
          className="sr-only"
          onChange={(event) => {
            void read(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </label>
      {error && <p className="mt-1 text-xs text-amber-800">{error}</p>}
    </div>
  )
}
