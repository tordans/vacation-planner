# Plan: Vacation Planner

A small, static web app to plan a family's year: when are school holidays, public holidays and
bridge days, when are we away (and where), when do we stay home, and who covers child care in each
of those periods. All state lives in the URL, so a link is the document.

Source: voice transcripts (DE) from 2026-10-06.

Sibling apps used as references:

- `../holiday-overlap` — holiday loading logic only (older app, tooling not up to date).
- `../timezonehelper` — drag interaction of the range selection, and current tooling, CI and
  GitHub Pages deployment.

## 1. Name

- **Repository / folder / URL slug:** `vacation-planner`
- **URL:** `https://tordans.github.io/vacation-planner/`
- **UI title (DE):** "Urlaubsplaner"

## 2. Goals and non-goals

**Goals**

1. See the whole year at a glance: school holidays, public holidays, bridge days, our own entries.
2. Plan each period: where we are (away + destination, or at home) and who takes care.
3. Track each parent's leave account: vacation days per year minus **all** leave the plan
   contains — child-care time, family vacation and personal vacation alone — taking their
   individual working days into account (e.g. a Mon–Thu four-day week).
4. Switch between years (previous / next) to plan ahead.
5. Share the plan by sharing the URL. The URL is the single source of truth.
6. Always show which version of the plan you are looking at (last-saved timestamp in the tab
   title, in the app header and as plain text in the URL), so an old bookmark or link is
   recognisable as old.

**Non-goals (v1)**

- No backend, no accounts, no sync other than the link.
- No distinction between individual grandparents; "grandparents" is one carer.
- No more than two parents (fixed roles: mother, father).
- No editing in the year overview; it is read-only navigation.

## 3. Domain model

Terms (code in English, UI in German):

| Term           | DE               | Meaning                                                       |
| -------------- | ---------------- | ------------------------------------------------------------- |
| School holiday | Ferien           | Imported range per federal state, e.g. Sommerferien           |
| Public holiday | Feiertag         | Imported single day                                           |
| Bridge day     | Brückentag       | Derived working day between a public holiday and a weekend    |
| Family entry   | Familienzeitraum | A user-planned period: where the family is and who takes care |
| Personal leave | Eigener Urlaub   | Leave one parent takes on their own, unrelated to child care  |
| Carer          | Betreuung        | `mother`, `father`, or `grandparents`                         |
| Leave budget   | Urlaubstage      | Vacation days a parent has in a year                          |
| Working days   | Arbeitstage      | ISO weekdays a parent works, e.g. `[1,2,3,4]`                 |

```ts
type Parent = {
  role: 'mother' | 'father'
  name?: string // optional display name
  workingDays: number[] // ISO weekdays 1–7
  leaveDaysByYear: Record<number, number> // budget can differ per year
}

type FamilyEntry = {
  id: string
  start: string // yyyy-MM-dd, inclusive
  end: string // yyyy-MM-dd, inclusive
  kind: 'away' | 'home'
  place?: string // destination when away
  note?: string
  carers: Array<'mother' | 'father' | 'grandparents'> // at least one
}

type PersonalLeave = {
  id: string
  parent: 'mother' | 'father'
  start: string
  end: string
  kind: 'away' | 'home'
  place?: string
  note?: string
}

type Plan = {
  v: 1
  federalState: string // e.g. 'BE'
  parents: [Parent, Parent]
  entries: FamilyEntry[] // all years in one list; filtered by the selected year
  personalLeave: PersonalLeave[]
}
```

**Rules**

- A family entry covers a period with one care setup. If care changes halfway through a trip,
  split it into two entries (the detail view offers "split here").
- A parent listed as carer of a family entry is on leave for it. If `carers` is only
  `grandparents`, no parent leave is consumed.
- Personal leave is a parent's own vacation (alone, or simply days off) and is independent of
  child care: it consumes that parent's leave but does not count as care coverage.
- Vacation with the whole family is a family entry with both parents as carers. Family entries
  are not limited to school holidays, so any family trip shows up in both leave accounts.
- **Leave days consumed** = days on which the parent is on leave (family entry as carer, or
  personal leave) that are in the parent's `workingDays` and are not public holidays. Weekends
  and the parent's regular day off cost nothing. A day is never counted twice.
- The leave account shows, per parent and year: budget, planned, remaining — with planned broken
  down into **child care at home**, **family vacation (away)** and **personal leave**.
- Leave is attributed to the calendar year of each day, so a period spanning New Year splits its
  cost across both budgets.
- Family entries may not overlap each other; a parent's personal leave may not overlap family
  entries where that parent is already a carer (enforced while dragging: clamp to the neighbour).
- **Coverage gaps:** school-holiday working days with no family entry are highlighted as
  "unplanned" — this is the main thing the overview should make visible.

## 4. Holiday data (reuse from `holiday-overlap`)

Port and adapt `src/lib/holidays/*` and `src/lib/dates.ts`:

- `fetch-periods.ts` — client for `https://www.mehr-schulferien.de/api/v2.1` (school vacations and
  public holidays per federal state and year), incl. the vacation name labels.
- `bundeslaender.ts` — list of federal states and API slugs. Change the default to Berlin (`BE`).
- `merge-periods.ts` — de-duplication of API rows with identical ranges.
- `bridge-days.test.ts` — keep as a starting point for the test suite.

**Changes for this app**

- **Bridge days become their own days**, not an expansion of the holiday bar. Today
  `expandBridgeDayPeriod` stretches a Thursday holiday into a Thu–Sun bar. Here we need the Friday
  itself as a distinct "bridge day", because it is what costs a leave day — and whether it costs
  one depends on the parent (a Friday bridge day is free for someone who never works Fridays).
  New function: `deriveBridgeDays(publicHolidays): IsoDate[]` (Thu holiday → Fri, Tue holiday → Mon).
- Fetch with **TanStack Query** (`queryKey: ['periods', state, year, kind]`, `staleTime: Infinity`)
  instead of a hand-rolled `sessionStorage` cache; persist the query cache to `localStorage` so
  the yearly load really happens once per browser.
- Load the selected year plus the adjacent year edges (Christmas holidays span New Year).
- **Imported data is not stored in the URL.** It is fully determined by `federalState` + year and
  refetched/cached on the recipient's side. This keeps links short. Only user-created data goes
  into the URL. (See open question 1.)

## 5. Views

### 5.1 Year overview (read-only)

- Classic calendar layout: twelve month blocks side by side (4×3 on desktop, 2×6 / 1×12 on narrow
  screens), weeks starting Monday, ISO week numbers.
- Per day cell: background for school holiday / public holiday / bridge day / weekend, plus a
  coloured band for the entry covering that day (away vs home), and a marker for unplanned
  school-holiday days.
- Header: title with the last-saved timestamp below it (see 6.1), year switcher
  (← 2026 · **2027** · 2028 →), federal state, and the **leave account** per parent: budget,
  planned (child care / family vacation / personal), remaining (red when negative).
- Per day cell additionally: a small marker per parent who is on personal leave.
- List of family entries and personal leave below the calendar (date range, place, carers, leave
  cost per parent).
- Clicking a school-holiday block, an entry or any week opens the detail view zoomed to that range
  (a holiday period is padded by one week on each side).

### 5.2 Detail planning (Gantt)

- Horizontal day axis for the zoomed range, with month/week/day headers; scrollable and zoomable
  (zoom in/out buttons, "fit period", jump to previous/next school holiday).
- Rows:
  1. School holidays (read-only)
  2. Public holidays and bridge days (read-only)
  3. **Where** — the editable entry bars (away: destination label; home: "Zuhause")
  4. Mother, 5. Father — show the parent's leave: bars derived from family entries where they
     are carer (click toggles the carer on the entry above), plus their own editable
     **personal leave** bars. Each parent row shades their non-working weekdays so the cost of a
     bar is visible at a glance.
  5. Grandparents — derived from the entries' carers; click toggles.
- Interactions on the "Where" row and, for personal leave, on the parent rows (pointer events
  with pointer capture, snapping to whole days):
  - drag on empty space → create an entry
  - drag a bar → move it
  - drag a bar's left/right edge → resize it
  - click a bar → popover to edit kind, place, note, carers; split; delete
  - keyboard: arrow keys move, Shift+arrow resizes, Delete removes (accessible alternative to drag)
- While dragging, state is local; the URL is written once on pointer-up, so history stays clean.
- A live footer shows the leave cost of the selected entry per parent and the remaining budgets.

**Drag implementation — modelled on `timezonehelper`**
(`src/components/TimezoneTableGrid.tsx`, `src/state/ui-store.ts`), whose range selection feels
right and is the reference for behaviour and feel:

- Plain pointer events, no drag-and-drop library. `onPointerDown/Move/Up/Cancel` live on the
  scroll container, which takes `setPointerCapture` (in a `try/catch`), so a drag keeps tracking
  when the pointer leaves the bar or the row.
- A small drag state `{ mode, anchor }` with modes `create | resize-start | resize-end`, extended
  here by `move` and by the id of the bar being dragged (several bars instead of one selection).
- Position → value through the grid's `getBoundingClientRect()`, then round to the step and clamp.
  The step here is one day; neighbours and the visible range are the clamp bounds.
- Resize handles are separate small pill elements straddling the bar's edges
  (`cursor-ew-resize`, `touch-manipulation`, `stopPropagation` on pointer-down); the bar body
  itself is the move target.
- `select-none` on the timeline; pointer-down on buttons/links/inputs inside it is ignored.
- Touch: `timezonehelper` sets `touch-none` on the whole timeline, which works for a 24-hour
  strip. This timeline is much wider and must stay scrollable by finger, so `touch-none` goes
  only on bars and handles; creating by drag on empty space is mouse/pen only, and touch creates
  an entry by tapping a day (one-day bar, then resize with the handles).
- Bars animate `left`/`width` with `motion` using a short spring, switched off while dragging and
  for `prefers-reduced-motion`.
- DOM grid with CSS grid/subgrid for rows and day columns (not SVG), so bars, labels and popovers
  are normal elements.

Differences to `timezonehelper`: it writes the URL on every pointer move, which is fine for two
short params. Here each write re-compresses the plan and bumps `saved`, so the drag updates a
local preview and the URL is written once on pointer-up. The drag state can live in component
state; a Zustand store is only needed if several components have to react to an active drag.

`holiday-overlap`'s Gantt is a static SVG edited through a form drawer, without drag handling;
nothing is ported from it.

### 5.3 Settings

A dialog/drawer for: federal state, both parents (name, working days as weekday toggles, leave
days for the selected year). Opens automatically on first visit with an empty URL.

### 5.4 Dates and times in the UI

All date handling goes through `date-fns` with `@date-fns/tz` (`TZDate`, `tz('Europe/Berlin')`
passed as the `in` option) and the `de` locale, wrapped in `lib/dates.ts`. No `Date` arithmetic,
`toLocaleString` or `Intl` formatting scattered in components.

Every date or time shown in the UI comes as a pair — one form visible, the other in a tooltip —
through one shared `<DateDisplay>` component with two variants:

| Variant    | Visible                      | Tooltip on hover/focus  | Used for                         |
| ---------- | ---------------------------- | ----------------------- | -------------------------------- |
| `relative` | "in 3 Wochen", "vor 2 Tagen" | "Montag, 12. Juli 2027" | entry list, upcoming periods     |
| `absolute` | "Mo, 12.07.2027" / with time | "in 3 Wochen"           | last-saved stamp, bars, popovers |

- Relative text via `formatDistanceToNowStrict` / `formatRelative` with `addSuffix`; for date
  ranges the visible form is the range ("12.–30.07.2027, 15 Arbeitstage") and the tooltip adds
  the relative start ("beginnt in 3 Wochen").
- Rendered as `<time dateTime="…">` so the machine-readable value is always present.
- The tooltip is a real component, not the native `title` attribute: animated with `motion`
  (`AnimatePresence`, short fade + slight offset, disabled for `prefers-reduced-motion`),
  portalled, clamped to the viewport, opening on hover and on keyboard focus, and on tap for
  touch. Start from `timezonehelper/src/components/ui/tooltip.tsx` (portal, placement and
  viewport clamping) and its `shared/motion.tsx` wrappers.
- Relative texts refresh on a slow clock tick (once a minute is enough) so a tab left open does
  not show stale wording.

## 6. URL as state

Single route (`/`), everything in search params validated with Zod in `validateSearch`.

| Param   | Example            | Purpose                                                        |
| ------- | ------------------ | -------------------------------------------------------------- |
| `year`  | `2027`             | Selected year; defaults to the current year                    |
| `from`  | `2027-07-01`       | Detail view range start; presence of `from`/`to` = detail view |
| `to`    | `2027-08-31`       | Detail view range end                                          |
| `saved` | `2026-10-06T14:32` | Last-saved timestamp, plain text (see 6.1)                     |
| `plan`  | `N4Ig…`            | The `Plan` object, LZ-compressed JSON (`lz-string`, URL-safe)  |

- `plan` uses short keys in its serialized form and a version field `v`, with a migration function
  per version, so old shared links keep working.
- Invalid or missing `plan` falls back to an empty plan (never crashes on a bad link).
- View params (`year`, `from`, `to`) use `replace: false` so back/forward navigates between
  overview and detail; edits to `plan` use `replace: true` except on discrete commits
  (create/delete/drop), which push a history entry and thereby give undo via the back button.
- Wire `parseSearch` / `stringifySearch` per the `tanstack-router-conventions` skill (as in
  `timezonehelper/src/lib/router-search.ts`) so the non-compressed params stay readable.
- Share button copies the current URL. No `localStorage` copy of the plan — the URL is the state.
  (Convenience: remember the last-opened URL locally and offer "continue where you left off" on an
  empty visit.)

### 6.1 Visible plan version ("last saved")

The goal: when opening an old bookmark or an old shared link, it must be obvious at a glance how
old that state is.

- Every change to `plan` (entries, personal leave, settings) sets `saved` to the current local
  time, minute precision, in the same navigation that writes `plan`. Pure view changes (`year`,
  `from`, `to`) do not touch it.
- `saved` is a **separate, human-readable search param**, deliberately not part of the compressed
  payload, and placed before `plan` so it stays visible in the address bar and in pasted links.
  Format `yyyy-MM-ddTHH:mm` (Europe/Berlin), no percent-encoding thanks to `routerSearch`.
- Shown in three places, all derived from the URL param:
  1. **Tab / window title:** `Urlaubsplaner 2027 – Stand 06.10.2026 14:32` (also what bookmarks
     and browser history store).
  2. **App header**, directly under the title: `Stand: Di, 06.10.2026, 14:32 Uhr`, with the
     relative form ("vor 3 Wochen") in the tooltip (see 5.4). If the state is older than a week,
     the relative form is shown inline as well, since that is exactly the stale-link case.
  3. **The URL itself.**
- An empty plan has no `saved` and shows "Noch nicht gespeichert".

## 7. Tech stack

Per the global `tech-stack` skill; scaffold order per `new-project-setup` (git init → AGPL-3.0
license → skills → dev tooling, one commit each via `finish-work`).

- Bun (≥ 1.3.14), Vite 8, React 19 with React Compiler, TypeScript 7 (`tsc --noEmit`)
- TanStack Router (SPA, file-based routes, `validateSearch` with Zod 4), TanStack Query
- `date-fns` + `@date-fns/tz` (fixed `Europe/Berlin`, `de` locale), ISO date strings in state;
  display rules in 5.4
- Tailwind CSS 4 (+ `@tailwindcss/forms`), `tailwind-merge`, Fontsource Inter
- `lz-string` for the URL payload
- oxlint + oxfmt (skill templates), Knip, Vitest; no Playwright in v1
- Scripts: `dev`, `build`, `type-check`, `lint`, `lint-check`, `format`, `format-check`,
  `test-run`, `check`, `check-ci`
- `motion` for bar animations and tooltips; Headless UI for popover/dialog
- No Zustand unless the drag state needs sharing across components (see 5.2)
- Browser target via `browserslist`; `bunfig.toml` with `minimumReleaseAge`
- Dependabot: monthly, first Friday (private OSS schedule), one open PR per ecosystem

**Scaffolding source:** the current skill templates (`tech-stack/examples/*`), with
`timezonehelper` as the working example of them in a Router SPA on GitHub Pages: its
`package.json` scripts, `oxlint.config.mjs`, `oxfmt.config.mjs`, `knip.config.mjs`,
`tsconfig.app.json`, `bunfig.toml`, `vite.config.ts`, `src/router.tsx` and
`src/lib/router-search.ts` are the starting point. `holiday-overlap` predates these conventions
and is not used for tooling, config or CI — only its holiday-loading logic is ported, and brought
up to the conventions on the way in.

**Deployment:** GitHub Pages via GitHub Actions, taken from
`timezonehelper/.github/workflows/deploy-pages.yml`: `configure-pages` provides the base path
(`PAGES_BASE_PATH` → Vite `base`, so the repo name is not hard-coded), `bun install
--frozen-lockfile`, `bun run check-ci` gates the build, `dist/index.html` is copied to `404.html`,
then `upload-pages-artifact` / `deploy-pages`. `ci.yml` for pull requests (dependency review +
`check-ci`) from the same repo. Dependabot from the skill template with the private-OSS schedule.

## 8. Proposed structure

```
src/
  routes/__root.tsx, index.tsx        # search schema, view switch
  router.tsx, lib/router-search.ts
  features/
    plan/        plan-schema.ts, plan-url.ts (encode/decode/migrate), plan-actions.ts,
                 leave-account.ts, coverage-gaps.ts, saved-at.ts   (+ tests)
    holidays/    fetch-periods.ts, federal-states.ts, merge-periods.ts, bridge-days.ts,
                 usePeriods.ts                                      (+ tests)
    year-overview/   YearOverview.tsx, MonthBlock.tsx, LeaveAccount.tsx, EntryList.tsx
    detail-gantt/    DetailGantt.tsx, GanttAxis.tsx, GanttRow.tsx, EntryBar.tsx, PersonalLeaveBar.tsx,
                     EntryPopover.tsx, useBarDrag.ts, gantt-scale.ts (+ tests)
    settings/        SettingsDialog.tsx
  components/ui/  tooltip.tsx, DateDisplay.tsx
  lib/dates.ts, lib/cn.ts
```

## 9. Milestones

1. **Scaffold & deploy** — repo, license, tooling, empty app live on GitHub Pages.
2. **Plan model & URL** — `lib/dates.ts`, `<DateDisplay>` + tooltip, schema, encode/decode/migrate, `saved` timestamp, leave account,
   coverage gaps; all pure functions with Vitest coverage (4-day week, public holiday inside an
   entry, entry across New Year, grandparents-only entry, personal leave next to a family entry).
3. **Holiday import** — port from `holiday-overlap`, bridge days as distinct days, Query + cache.
4. **Settings** — federal state and parents.
5. **Year overview** — calendar blocks, year switcher, leave account, entry list, click-to-zoom,
   last-saved display in header and tab title.
6. **Detail Gantt, read-only** — axis, reference rows, entry bars, zoom/scroll.
7. **Detail Gantt, editing** — create/move/resize by drag for family entries and personal leave,
   popover, split, delete, keyboard.
8. **Polish** — unplanned-day highlighting, share button, empty state, print stylesheet for the
   year overview, README.

## 10. Status of the first build (2026-10-06)

Milestones 1–8 are implemented. Where the build deviates from the sections above:

- **Routing:** one code-based route in `src/router.tsx` (as in `timezonehelper`) instead of
  file-based routes; with a single route the generator adds nothing.
- **Holiday cache:** TanStack Query with `staleTime: Infinity`; the once-per-browser cache is a
  plain `localStorage` entry written by the query function, not a persisted query cache.
- **Editing a bar:** the details open in a panel below the chart instead of a popover on the bar.
  It stays usable on phones and does not cover the timeline while planning.
- **Open care:** a family entry may have no carer yet. It is marked "Betreuung offen" and its
  school-free days still count as unplanned.
- **Split:** "In der Mitte teilen" splits at the middle of the entry; resize the halves afterwards.
- **Tests** live in `tests/` (as in `timezonehelper`), not next to the sources.
- **Not built yet:** remembering the zoom level, auto-scroll while dragging past the visible edge.

## 11. Open questions

1. **Imported holidays in the URL?** Plan says no (refetch by state + year, cached locally). The
   transcript's "fill once per year" could also mean a snapshot stored in the plan — more robust if
   the API disappears, but noticeably longer links.
2. **Extra closure days** (Kita/Hort closing days, school training days) — add a manual "custom
   day off" list in v1, or later?
3. **Half days and carry-over leave** (Resturlaub from the previous year) — assumed out of scope
   for v1; the per-year budget can simply be entered including carry-over.
4. **UI language** — assumed German only.
