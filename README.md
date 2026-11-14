# Vacation Planner

Plan a family's year: school holidays, public holidays and bridge days, where the family is, who
takes care of the children, and how many vacation days each parent has left.

**App:** <https://urlaub.ingsparks.de> (UI in German: "Urlaubsplaner")

One shared plan for the family, kept on our own webspace (all-inkl, Germany). The plan lives only on
the server; the address bar holds no plan data.

## Two links

The family gets two links. Opening one stores its key in the browser (`localStorage`) and removes it
from the address bar, so the bare address keeps working on that device.

| Link                                         | Role | Can do                                                                                 |
| -------------------------------------------- | ---- | -------------------------------------------------------------------------------------- |
| `https://urlaub.ingsparks.de/#key=<editKey>` | edit | Everything. Changes show at once and are saved after about a second (`If-Match`).      |
| `https://urlaub.ingsparks.de/#key=<viewKey>` | view | Look at everything including notes and leave accounts, change nothing ("Nur ansehen"). |

Without a stored key the app shows a small screen instead of the planner ("Du brauchst den Link, den
du bekommen hast.") and makes no API calls. A key the server no longer knows (401) is removed and
the same screen adds "Dieser Link gilt nicht mehr". "Auf diesem Gerät abmelden" removes the key by
hand.

The plan is loaded again when the tab gets focus while nothing is unsaved, so a tab left open for
weeks shows the current plan when you come back; there is no polling. If someone else saved first,
the app shows their version with "Meine Änderung trotzdem speichern" (last save wins). Without a
connection the change stays on screen, the header says "Nicht gespeichert – keine Verbindung", and
saving is retried on the next change and on focus. The tab title and "Gespeichert …" come from the
server's `updatedAt`.

Server API and deployment: [docs/release-plan.md](docs/release-plan.md) (contract) and
[docs/deploy.md](docs/deploy.md) (KAS, secrets, first deploy, changing the keys).

## How it works

- **Year overview** (read-only): twelve month blocks with school holidays, public holidays, bridge
  days, planned periods and school-free days nobody covers yet. A leave account per parent shows
  budget, planned days (child care at home, family vacation, own leave) and what is left.
- **Detail planning**: click a day, a month or a holiday to zoom in. Drag in the row "Wo sind wir"
  to create a period, drag a bar to move it, drag its ends to resize it. Click a parent's or the
  grandparents' row to set who takes care. Drag in a parent's row for leave they take on their own.
  Keyboard: arrows move, Shift+arrows resize, Delete removes.
- **Other households** (grandparents, cousins) are information only: add a name and optionally a
  federal state to see its school holidays, and enter when they are not at home, in grey bars in
  their row. They never need care, cost no leave and create no unplanned days. Hide the rows with
  the "Andere Haushalte" switch.
- **Ideas**: below "Wo sind wir", drag out ideas that are not decided yet, e.g. "with one set of
  grandparents" and "with the other set". Ideas may overlap each other and fixed periods, cost no
  leave and cover no care until "Fest einplanen" turns one into a fixed period.
- **Leave days** are only charged on a parent's working days that are not public holidays, so a
  four-day week or a bridge day on a day off is accounted for correctly.
- **Holidays** come from [mehr-schulferien.de](https://www.mehr-schulferien.de) for the selected
  federal state (default Berlin), loaded once per year and cached in the browser.
  "Anpassen" lists them all so single dates can be corrected or removed, and adds the family's
  own school-free days (training days, after-school care closed). These edits are part of the plan.

## URL parameters

The address only holds the view; the plan itself is never part of it.

| Param    | Example      | Purpose                                                 |
| -------- | ------------ | ------------------------------------------------------- |
| `year`   | `2027`       | Selected year, defaults to the current year             |
| `from`   | `2027-06-24` | Detail view start; `from` and `to` open the detail view |
| `to`     | `2027-08-21` | Detail view end                                         |
| `others` | `hide`       | Hides the other households' rows; absent means shown    |

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
| `check-ci`                | Read-only verify, run by the pre-push hook               |

Stack: Vite 8, React 19 with React Compiler, TanStack Router (search params validated with Zod 4),
TanStack Query, date-fns with `@date-fns/tz`, Tailwind CSS 4, Motion, Headless UI.

Deployment: see [docs/deploy.md](docs/deploy.md). The app talks to `/api/plan` on the same origin;
during development the Vite proxy forwards `/api` to the local PHP server.

The product plan and its decisions are in [PLAN.md](PLAN.md).

## License

[AGPL-3.0](LICENSE.md)
