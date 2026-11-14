# Release plan: one shared plan on all-inkl

Status: in progress, started 2026-11-14.

The app moves from GitHub Pages (plan only in the URL) to the all-inkl webspace with a small PHP
API and one shared plan. We copy the setup of **Checking Sparks**
(`../health-tracker`, live at <https://check.ingsparks.de> since 2026-11-07). That repository was
itself built from our earlier storage plan, and its deploy has been running without problems, so
the same steps, KAS settings and scripts are known to work on this account.

Earlier analyses (central storage, Google Sheets, home NAS) are in [archive/](archive/).

## What we take over unchanged from Checking Sparks

- Server layout: FTP root `<app>/` with `config/`, `api/`, `logs/` next to `public/` (document
  root). Subdomain target in KAS is `<folder>/public/`.
- PHP 8.5, no framework, PDO, MariaDB in production, SQLite in memory for PHPUnit, Docker image for
  local PHP tests (`bun run test-php`), Composer only for dev tools (PHPUnit).
- `.htaccess` (HTTPS, `Authorization` passthrough, `/api` → `api/index.php [QSA,END]`, dotfiles
  denied except `/.well-known/`, real 404 for missing `/assets/`, SPA fallback, cache headers,
  security headers, CSP).
- One workflow `.github/workflows/deploy.yml`, GitHub environment `production`: build, assemble,
  generate `config/config.php` from secrets, two-pass FTPS upload (`index.html` last),
  `api/deploy/check.sh` against the live site, summary on the run page. The API applies its
  migrations itself (no migrate call from the workflow).
- Keys: the server stores only SHA-256 digests; the keys travel in the URL fragment (`#key=…`);
  `scripts/setup-deploy-secrets.sh` generates keys, asks for FTP/DB values and writes all secrets
  with `gh secret set --env production`.

## What is different here

| Checking Sparks                           | Vacation Planner                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| One family key, data encrypted in browser | Two keys: **edit** and **view**, plan stored as plain JSON                                 |
| Web Push, VAPID, cron job, PWA            | none of it                                                                                 |
| Several documents and tables              | one table `plan` with one row                                                              |
| Tests and linters in GitHub (`ci.yml`)    | none: `bun run check-pre-push` and `bun run test-php` run locally in a Husky pre-push hook |
| Deploy step `POST /api/migrate`           | none: the API applies pending migrations before the first request that needs the database  |

No encryption: the view link must work for the grandparents without a passphrase, and the earlier
decision was "the view link shows everything". Whoever has the server and database password can
read the plan; that is the same trust as for any data on our own webspace.

No MCP endpoint for the release. Checking Sparks shipped without one, and the deploy check plus
`api.log` via FTP were enough. It can come later.

## Domain

`https://urlaub.ingsparks.de` (KAS folder `urlaub.ingsparks.de/`), next to `check.ingsparks.de`.
It is one constant (`SITE_URL` in `deploy.yml`, plus the secrets script); change it there before
the KAS steps if another name is wanted.

## API contract

JSON in and out, `Cache-Control: no-store`, errors `{ "error": "<code>" }`, same origin (no CORS
in production; local development via the Vite proxy `/api` → `http://localhost:8787`).

Auth: `Authorization: Bearer <key>`. The server compares `sha256(key)` with
`edit_key_sha256` and `view_key_sha256` (`hash_equals`) and sets the role `edit` or `view`.
Unknown or missing key: `401`.

| Method + path     | Auth       | Result                                                                                                                                                                                                                                                                   |
| ----------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/health` | none       | `200 { ok: true, commit }`, works without database                                                                                                                                                                                                                       |
| `GET /api/plan`   | edit, view | `200 { role, plan: { version, updatedAt, data } \| null }` + `ETag: "<version>"` when a plan exists. `plan` is `null` before the first save                                                                                                                              |
| `PUT /api/plan`   | edit       | body `{ data }`. `If-Match: "<version>"` updates, `If-None-Match: *` creates. `200 { version, updatedAt }` + `ETag`. `409 { plan: { version, updatedAt, data } }` when the version is stale or a plan already exists; `428` without precondition; `403` for the view key |

- Migrations are not an endpoint: the API applies pending `migrations/*.sql` before the first request
  that needs the database (`/api/plan`). `GET /api/health` never touches the database.
- `data` is the plan in the **wire format of the URL** (`wirePlanSchema`, version `v: 1`),
  uncompressed. The server checks only that it is a JSON object and at most 64 KiB; it never
  interprets it.
- `updatedAt` is ISO 8601 UTC with milliseconds.
- Body larger than 64 KiB: `413`. Malformed JSON: `400 invalid_json`. Unknown path `404`, wrong
  method `405` with `Allow`.
- Logging as in Checking Sparks: only short error lines, never keys, bodies or plan data.

Table:

```sql
CREATE TABLE plan (
  id TINYINT UNSIGNED PRIMARY KEY,   -- always 1
  data LONGTEXT NOT NULL,            -- JSON text, returned unchanged
  version INT UNSIGNED NOT NULL,
  updated_at DATETIME(3) NOT NULL
);
```

(plus the migrations table from Checking Sparks).

## Secrets (environment `production`)

Nine secrets: `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`, `DB_HOST`, `DB_NAME`, `DB_USER`,
`DB_PASSWORD`, `EDIT_KEY_SHA256`, `VIEW_KEY_SHA256`. Changing a key = new value via the secrets
script (or `gh secret set`), "Run workflow"; the old link stops working.

Links: `https://urlaub.ingsparks.de/#key=<editKey>` (parents) and `…/#key=<viewKey>`
(grandparents).

## App behaviour

- **Opening `#key=…`:** store the key in `localStorage` (so the bare URL keeps working on that
  device, e.g. from a home-screen icon), remove the fragment from the address bar, load the plan.
  Settings get "Auf diesem Gerät abmelden".
- **Server mode** (a key is stored): the plan comes from the API, not from `plan=`/`saved=` in the
  URL. `year`, `from`, `to`, `others` stay URL params. The header shows the save state:
  "Gespeichert 14:32" (from `updatedAt`), "Speichert …", "Nicht gespeichert – keine Verbindung"
  (retry on next change / on focus).
- **Edit role:** everything as today. Each change updates the screen at once and is saved about a
  second later with `If-Match`.
- **Conflict (last save wins):** on `409` the app shows the server plan and a notice "Inzwischen
  von jemand anderem geändert" with "Meine Änderung trotzdem speichern", which saves the local plan
  over the new version.
- **Updates from others:** reload on window focus and every 60 s while nothing is unsaved.
- **View role:** same views including notes and leave accounts, but no dragging, no editors, no
  settings dialogs; a badge "Nur ansehen".
- **Wrong or revoked key (`401`):** notice "Dieser Link gilt nicht mehr", key removed, app falls
  back to URL mode.
- **URL mode stays:** without a stored key the app works exactly as today (plan in the link).
  - Edit role with an empty server plan and a plan in the URL or in "last plan": offer "Diesen
    Plan auf den Server übernehmen" once.
  - Edit role: "Als Link ohne Server kopieren" exports a snapshot link (today's format).
  - A link with `plan=` opened while a key is stored opens in URL mode with a banner and the buttons
    "Zum gemeinsamen Plan" and (edit role) "Auf den Server übernehmen".
- **"Gut zu wissen":** where the plan lives (all-inkl in Germany, our own webspace), who can read
  it (anyone with one of the two links), how links are changed, and that the link-only mode still
  exists.

## Steps

1. **API and deploy** (`api/`, `scripts/`, `.github/workflows/`, `docs/deploy.md`,
   `vite.config.ts`, `package.json` scripts): copy and trim from Checking Sparks, remove the GitHub
   Pages workflow and `PAGES_BASE_PATH`.
2. **App** (`src/`, `tests/`): API client, key handling, server-backed plan source with autosave,
   conflict and polling, view role, info texts, README.
3. **Verify** with checks, PHPUnit and a local run (PHP + MariaDB in Docker, `check.sh` against
   it).
4. **Owner steps** (KAS, secrets, first deploy) — see the README / `docs/deploy.md` checklist.
5. After the first green deploy: turn off GitHub Pages in the repository settings, update the
   repository homepage link, send the two links.
