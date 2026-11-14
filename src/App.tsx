import { ChevronLeftIcon, ChevronRightIcon, Cog6ToothIcon } from '@heroicons/react/20/solid'
import { useState } from 'react'
import { INFO_TOPICS, InfoFooter, showInfoTopic } from '@/components/InfoFooter'
import { buttonClass } from '@/components/ui/classes'
import { DetailGantt } from '@/features/detail-gantt/DetailGantt'
import { MAX_RANGE_DAYS } from '@/features/detail-gantt/gantt-scale'
import { federalStateByCode } from '@/features/holidays/federal-states'
import { useCalendar } from '@/features/holidays/use-calendar'
import { useHouseholdHolidays } from '@/features/holidays/use-household-holidays'
import { PlanProvider } from '@/features/plan/PlanProvider'
import { usePlan, useServerControls, useView } from '@/features/plan/use-plan'
import { AccessMenu } from '@/features/server/AccessMenu'
import { useKeyState } from '@/features/server/key-store'
import { NoKeyScreen } from '@/features/server/NoKeyScreen'
import { SaveStatus } from '@/features/server/SaveStatus'
import { ServerNotices } from '@/features/server/ServerNotices'
import { CalendarDialog } from '@/features/settings/CalendarDialog'
import { HouseholdsDialog } from '@/features/settings/HouseholdsDialog'
import { SettingsDialog } from '@/features/settings/SettingsDialog'
import { YearOverview } from '@/features/year-overview/YearOverview'
import { addDays, daysBetween, formatSavedCompact, yearOf } from '@/lib/dates'

export default function App() {
  const { key, revoked } = useKeyState()
  // No key (or the server turned it down): no planner and no requests, only the way in.
  if (key === null) return <NoKeyScreen revoked={revoked} />
  return (
    <PlanProvider planKey={key}>
      <AppGate />
    </PlanProvider>
  )
}

/** The shared plan has to arrive before the first screen: what is shown first depends on it. */
function AppGate() {
  const server = useServerControls()
  if (server.load === 'ready') return <Planner />
  return (
    <div className="mx-auto max-w-[96rem] space-y-3 px-4 py-6 sm:px-6">
      <title>Urlaubsplaner</title>
      <h1 className="text-xl font-semibold tracking-tight">Urlaubsplaner</h1>
      {server.load === 'loading' ? (
        <p className="text-sm text-zinc-600">Gemeinsamer Plan wird geladen …</p>
      ) : (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-red-800">
          Der gemeinsame Plan konnte nicht geladen werden. Bitte die Verbindung prüfen.
          <button
            type="button"
            className="font-semibold underline underline-offset-2"
            onClick={server.reload}
          >
            Erneut versuchen
          </button>
          <button
            type="button"
            className="font-semibold underline underline-offset-2"
            onClick={server.signOut}
          >
            Auf diesem Gerät abmelden
          </button>
        </p>
      )}
    </div>
  )
}

function Planner() {
  const { plan, commit, saved, hasPlan, readOnly } = usePlan()
  const view = useView()
  const { year } = view
  const [settingsOpen, setSettingsOpen] = useState(!readOnly && !hasPlan)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [householdsOpen, setHouseholdsOpen] = useState(false)

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
  const householdHolidays = useHouseholdHolidays(plan.households, years)
  const federalState = federalStateByCode(plan.federalState)

  return (
    <div className="mx-auto max-w-[96rem] space-y-6 px-4 py-6 sm:px-6">
      <title>
        {saved
          ? `Urlaubsplaner ${year} – Stand ${formatSavedCompact(saved)}`
          : `Urlaubsplaner ${year}`}
      </title>

      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xl font-semibold tracking-tight">
            Urlaubsplaner
            {readOnly && (
              <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium tracking-normal text-zinc-700">
                Nur ansehen
              </span>
            )}
          </h1>
          <p className="mt-0.5 text-sm text-zinc-600">
            <SaveStatus />
            <button
              type="button"
              className="ml-2 text-sky-700 underline underline-offset-2 hover:text-sky-900 print:hidden"
              onClick={() => showInfoTopic(INFO_TOPICS.keeping)}
            >
              Wo liegt der Plan?
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
          {readOnly ? (
            <span className="px-1 text-sm font-medium text-zinc-700">{federalState.name}</span>
          ) : (
            <button type="button" className={buttonClass} onClick={() => setSettingsOpen(true)}>
              <Cog6ToothIcon className="size-4 text-zinc-500" />
              {federalState.name}
            </button>
          )}
          <AccessMenu />
        </div>
      </header>

      <ServerNotices />

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
            showOthers={view.showOthers}
            householdHolidays={householdHolidays}
            onEditHouseholds={() => setHouseholdsOpen(true)}
            readOnly={readOnly}
          />
        ) : (
          <YearOverview
            plan={plan}
            year={year}
            calendar={calendar}
            onOpenRange={(next) => view.openRange(next.start, next.end)}
            onEditCalendar={readOnly ? undefined : () => setCalendarOpen(true)}
            showOthers={view.showOthers}
            onShowOthers={view.setShowOthers}
            householdHolidays={householdHolidays}
            onEditHouseholds={readOnly ? undefined : () => setHouseholdsOpen(true)}
          />
        )}
      </main>

      <InfoFooter />

      {!readOnly && (
        <>
          <HouseholdsDialog
            open={householdsOpen}
            onClose={() => setHouseholdsOpen(false)}
            plan={plan}
            year={year}
            onCommit={commit}
          />
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
        </>
      )}
    </div>
  )
}
