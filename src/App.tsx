import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  LinkIcon,
} from '@heroicons/react/20/solid'
import { useState } from 'react'
import { INFO_TOPICS, InfoFooter, showInfoTopic } from '@/components/InfoFooter'
import { SavedDisplay } from '@/components/ui/DateDisplay'
import { DetailGantt } from '@/features/detail-gantt/DetailGantt'
import { MAX_RANGE_DAYS } from '@/features/detail-gantt/gantt-scale'
import { federalStateByCode } from '@/features/holidays/federal-states'
import { useCalendar } from '@/features/holidays/use-calendar'
import { readLastPlan } from '@/features/plan/last-plan'
import { usePlan, useView } from '@/features/plan/use-plan'
import { CalendarDialog } from '@/features/settings/CalendarDialog'
import { SettingsDialog } from '@/features/settings/SettingsDialog'
import { YearOverview } from '@/features/year-overview/YearOverview'
import { addDays, daysBetween, formatSavedCompact, formatSavedFull, yearOf } from '@/lib/dates'

const buttonClass =
  'inline-flex h-9 items-center gap-1.5 rounded-md bg-white px-3 text-sm font-medium ring-1 ring-zinc-300 ring-inset hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-sky-600'

export default function App() {
  const { plan, commit, saved, hasPlan } = usePlan()
  const view = useView()
  const { year } = view
  const [lastPlan] = useState(() => (hasPlan ? null : readLastPlan()))
  const [settingsOpen, setSettingsOpen] = useState(!hasPlan && lastPlan === null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // Guard against hand-edited links with absurd ranges.
  const range =
    view.range && daysBetween(view.range.start, view.range.end) < MAX_RANGE_DAYS
      ? view.range
      : view.range && {
          start: view.range.start,
          end: addDays(view.range.start, MAX_RANGE_DAYS - 1),
        }

  const years = [year]
  if (range) {
    for (let other = yearOf(range.start); other <= yearOf(range.end); other++) {
      if (!years.includes(other)) years.push(other)
    }
  }
  const { calendar, source, isPending, isError, missingYears, refetch } = useCalendar(
    plan.federalState,
    years,
    plan,
  )
  const federalState = federalStateByCode(plan.federalState)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: the address bar still has the link.
    }
  }

  return (
    <div className="mx-auto max-w-[96rem] space-y-6 px-4 py-6 sm:px-6">
      <title>
        {saved
          ? `Urlaubsplaner ${year} – Stand ${formatSavedCompact(saved)}`
          : `Urlaubsplaner ${year}`}
      </title>

      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Urlaubsplaner</h1>
          <p className="mt-0.5 text-sm text-zinc-600">
            <SavedDisplay stamp={saved} />
            <button
              type="button"
              className="ml-2 text-sky-700 underline underline-offset-2 hover:text-sky-900 print:hidden"
              onClick={() => showInfoTopic(INFO_TOPICS.keeping)}
            >
              Wie sichere ich den Plan?
            </button>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <div className="flex items-center rounded-md bg-white ring-1 ring-zinc-300">
            <button
              type="button"
              aria-label={`Jahr ${year - 1}`}
              className="flex size-9 items-center justify-center rounded-l-md hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-sky-600"
              onClick={() => view.setYear(year - 1)}
            >
              <ChevronLeftIcon className="size-5" />
            </button>
            <span className="min-w-14 text-center text-sm font-semibold tabular-nums">{year}</span>
            <button
              type="button"
              aria-label={`Jahr ${year + 1}`}
              className="flex size-9 items-center justify-center rounded-r-md hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-sky-600"
              onClick={() => view.setYear(year + 1)}
            >
              <ChevronRightIcon className="size-5" />
            </button>
          </div>
          <button type="button" className={buttonClass} onClick={() => setSettingsOpen(true)}>
            <Cog6ToothIcon className="size-4 text-zinc-500" />
            {federalState.name}
          </button>
          <button type="button" className={buttonClass} onClick={() => void copyLink()}>
            <LinkIcon className="size-4 text-zinc-500" />
            {copied ? 'Link kopiert' : 'Link kopieren'}
          </button>
          <button
            type="button"
            className="text-sm text-sky-700 underline underline-offset-2 hover:text-sky-900"
            onClick={() => showInfoTopic(INFO_TOPICS.storage)}
          >
            Was steckt im Link?
          </button>
        </div>
      </header>

      {lastPlan && !hasPlan && (
        <p className="rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-950 ring-1 ring-sky-200">
          In diesem Browser wurde zuletzt ein Plan mit {formatSavedFull(lastPlan.saved)} bearbeitet.{' '}
          <button
            type="button"
            className="font-semibold underline underline-offset-2"
            onClick={() => view.openPlan(lastPlan)}
          >
            Diesen Plan öffnen
          </button>
        </p>
      )}

      {isError && (
        <p className="flex flex-wrap items-center gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-900 ring-1 ring-red-200">
          Ferien und Feiertage konnten nicht geladen werden. Urlaubstage werden ohne Feiertage
          berechnet.
          <button type="button" className="font-semibold underline" onClick={refetch}>
            Erneut versuchen
          </button>
        </p>
      )}
      {!isError && missingYears.length > 0 && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-200">
          Für {missingYears.join(', ')} sind in {federalState.name} noch keine Ferien
          veröffentlicht.
        </p>
      )}
      {isPending && <p className="text-sm text-zinc-500">Ferien und Feiertage werden geladen …</p>}

      <main>
        {range ? (
          <DetailGantt
            plan={plan}
            year={year}
            calendar={calendar}
            range={range}
            onCommit={commit}
            onChangeRange={(next, history) => view.openRange(next.start, next.end, history)}
            onClose={view.closeRange}
          />
        ) : (
          <YearOverview
            plan={plan}
            year={year}
            calendar={calendar}
            onOpenRange={(next) => view.openRange(next.start, next.end)}
            onEditCalendar={() => setCalendarOpen(true)}
          />
        )}
      </main>

      <InfoFooter />

      <CalendarDialog
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        plan={plan}
        year={year}
        source={source}
        federalStateName={federalState.name}
        onCommit={commit}
      />
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        plan={plan}
        year={year}
        onCommit={commit}
      />
    </div>
  )
}
