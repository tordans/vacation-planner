# Vacation Planner

Plan a family's year: school holidays, public holidays and bridge days, where the family is, who
takes care of the children, and how many vacation days each parent has left.

**App:** <https://tordans.github.io/vacation-planner/> (UI in German: "Urlaubsplaner")

The whole plan lives in the URL. There is no server and no account; sharing the link shares the
plan. The link also carries a readable `saved=` timestamp, shown in the tab title and under the
app title, so an old bookmark is recognisable as old.

## How it works

- **Year overview** (read-only): twelve month blocks with school holidays, public holidays, bridge
  days, planned periods and school-free days nobody covers yet. A leave account per parent shows
  budget, planned days (child care at home, family vacation, own leave) and what is left.
- **Detail planning**: click a day, a month or a holiday to zoom in. Drag in the row "Wo sind wir"
  to create a period, drag a bar to move it, drag its ends to resize it. Click a parent's or the
  grandparents' row to set who takes care. Drag in a parent's row for leave they take on their own.
  Keyboard: arrows move, Shift+arrows resize, Delete removes.
- **Leave days** are only charged on a parent's working days that are not public holidays, so a
  four-day week or a bridge day on a day off is accounted for correctly.
- **Holidays** come from [mehr-schulferien.de](https://www.mehr-schulferien.de) for the selected
  federal state (default Berlin), loaded once per year and cached in the browser.
  "Anpassen" lists them all so single dates can be corrected or removed, and adds the family's
  own school-free days (training days, after-school care closed). These edits live in the link.

## URL parameters

| Param   | Example            | Purpose                                                 |
| ------- | ------------------ | ------------------------------------------------------- |
| `year`  | `2027`             | Selected year, defaults to the current year             |
| `from`  | `2027-06-24`       | Detail view start; `from` and `to` open the detail view |
| `to`    | `2027-08-21`       | Detail view end                                         |
| `saved` | `2026-10-06T14:32` | Last change of the plan, Europe/Berlin, plain text      |
| `plan`  | `N4Ig…`            | The plan, LZ-compressed JSON (`src/features/plan`)      |

## Development

Requires [Bun](https://bun.sh) ≥ 1.3.14.

```bash
bun install
bun run dev
```

| Script                    | Role                                                     |
| ------------------------- | -------------------------------------------------------- |
| `dev`                     | Vite dev server                                          |
| `build` / `preview`       | Production build and local preview                       |
| `type-check`              | `tsc --noEmit` (TypeScript 7)                            |
| `lint` / `lint-check`     | Oxlint (mutating / read-only)                            |
| `format` / `format-check` | oxfmt (mutating / read-only)                             |
| `test-run`                | Vitest                                                   |
| `check`                   | Local verify: type-check, lint, format, tests, knip-warn |
| `check-ci`                | Read-only verify used by CI                              |

Stack: Vite 8, React 19 with React Compiler, TanStack Router (search params validated with Zod 4),
TanStack Query, date-fns with `@date-fns/tz`, Tailwind CSS 4, Motion, Headless UI.

Deployment: every push to `main` runs the checks and publishes to GitHub Pages
(`.github/workflows/deploy-pages.yml`).

The product plan and its decisions are in [PLAN.md](PLAN.md).

## License

[AGPL-3.0](LICENSE.md)
