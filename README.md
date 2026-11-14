# vacation.ingsparks.de

Familienurlaube planen und koordinieren.

A shared year planner for families: school holidays, public holidays and bridge days, where the
family is, who takes care of the children, and how many leave days each parent has left.

**App:** <https://vacation.ingsparks.de> (UI in German). Part of the ingsparks family, next to
<https://fly.ingsparks.de> and <https://check.ingsparks.de>.

## What you see

- **Year overview**: twelve month blocks with school holidays, public holidays, bridge days,
  planned periods, and school-free days nobody covers yet (red dots).
- **Detail planning**: click a day, a month or a holiday to zoom in. Drag in the row "Wo sind wir"
  to create a period, drag a bar to move it, drag its ends to resize it. Click a parent's or the
  grandparents' row to set who takes care. Keyboard: arrows move, Shift+arrows resize, Delete
  removes.
- **Leave days**: one account per parent with budget, planned days (child care at home, family
  vacation, own leave) and what is left. Days are only charged on working days that are not public
  holidays, so a four-day week or a bridge day on a day off is counted correctly.
- **Other households** (grandparents, cousins) are information only: their school holidays and
  when they are away, at no cost to anyone's leave.
- **Ideas**: periods that are not decided yet, which may overlap, until "Fest einplanen" makes one
  fixed.
- **Holidays** come from [mehr-schulferien.de](https://www.mehr-schulferien.de) for the chosen
  federal state. "Anpassen" corrects single dates and adds your own school-free days.

## How to use it

1. **You get a link.** Open it once; the app remembers it on that device, so the plain address works
   afterwards.
2. **Edit link or view link.** Every plan has two links. The edit link changes everything and saves
   automatically; the view link shows everything, including notes and leave accounts, and changes
   nothing ("Nur ansehen"). Send the view link to the grandparents, keep the edit link for the
   parents.
3. **Create your own plan.** On the start screen (no link yet), enter the invite word you got from
   us and press "Plan anlegen". You see both links once: save the edit link, for example in a
   password manager. Nobody, including us, can show them again.
4. **Renew a link.** In the menu "Gemeinsamer Plan", "Ansicht-Link erneuern" and
   "Bearbeiten-Link erneuern" issue a new link and invalidate the old one at once, on every device.
   Do this when a link was lost or went to someone who should not have it.

Several people can edit at the same time; if two saves collide, the later one is offered the chance
to overwrite ("Meine Änderung trotzdem speichern"). Without a connection the change stays on screen
and is saved when the connection is back.

## Privacy

There are no accounts, cookies, tracking or ads. Plans are stored in plain text on our own webspace
in Germany (all-inkl.com), readable by everyone with a link, by the operator and by the host; the
only third-party request is the holiday data from mehr-schulferien.de. Details:
[docs/datenschutz.md](docs/datenschutz.md) (German).

## Development

Requires [Bun](https://bun.sh) >= 1.3.14 and Docker (for the PHP API in development).

```bash
bun install
bun run dev       # Vite on http://localhost:5173, proxies /api to the API below
bun run dev-api   # PHP API on http://localhost:8787 (see api/README.md)
```

`bun run check` runs type-check, lint, format, tests and knip. The pre-push hook runs the same
checks (plus the PHP tests), so GitHub does not repeat them.

Stack: Vite, React 19 with React Compiler, TanStack Router and Query, Zod 4, date-fns, Tailwind
CSS 4, Motion, Headless UI; PHP + MySQL for the API.

- Deployment (all-inkl, FTPS, secrets, first plan): [docs/deploy.md](docs/deploy.md)
- API endpoints, limits and configuration: [api/README.md](api/README.md)
- Privacy: [docs/datenschutz.md](docs/datenschutz.md)

## License

[AGPL-3.0](LICENSE.md)
