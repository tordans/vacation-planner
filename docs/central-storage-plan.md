# Plan: central storage with an admin link and a view link

Status: proposal, not built. Written 2026-10-20, revised twice the same day.

## Goal

Today the whole plan lives in the URL. That works without a server, but every change produces a
new link, and old links silently show old states. Central storage should give:

- **One plan on a server** that always has the latest state.
- **An admin link** (edit) for the two parents, so both work on the same plan.
- **A view link** (read only) for the grandparents.
- **No user accounts, no login service.** Access works only through these two protected links.
- **Links changed on the server side:** the secrets behind the links are GitHub Actions secrets;
  changing a secret and redeploying invalidates the old link.
- **Data on the webspace we already have,** in Germany.
- **Self-contained:** the API is part of this repository, written for this app only, and deployed
  by this repository's GitHub Actions. No shared service, no dependency on other projects. A
  similar app later starts by copying this repository.

The URL-only mode stays as a fallback (trying things out, exporting a snapshot).

## Hosting facts (all-inkl Privat+)

- PHP 8.4 (selectable per subdomain), MariaDB 10.11 (used exactly like MySQL, `pdo_mysql`,
  phpMyAdmin in KAS), automatic MySQL backups.
- HTTPS with Let's Encrypt per subdomain; many subdomains included.
- **No SSH.** Upload only via FTPS (explicit FTPS on port 21; no SFTP). Anything that has to run on
  the server (e.g. a database migration) must be an HTTP endpoint we build.
- No long-running processes; PHP runs per request.

## Architecture

```
GitHub repository (this one)
├── src/            React app (as today)
├── api/            PHP API, written only for this app
└── .github/workflows/deploy.yml
        builds the app, generates the API config from secrets,
        uploads via FTPS, migrates, checks health

Browser ──HTTPS──> app (static files)
   │
   └──HTTPS, Authorization: Bearer <key>──> api (PHP) ──> MySQL table `plans`
```

Everything is hard-wired: the app knows its API URL at build time, the API knows its allowed
origin, its database and the two key hashes from a config file generated during deploy.

## API

One JSON document, read and written as a whole.

- `GET /api/plan` → `{ data, version, updated_at, role: 'admin' | 'viewer' }`
- `PUT /api/plan` with `If-Match: "<version>"` and body `{ data }` → `{ version, updated_at }`.
  Only the admin key may write (`403` otherwise). If the stored version is newer, `409` with the
  current version, so the app can tell the user that someone else saved in the meantime.
- `GET /api/health` → `{ ok, commit }`, no key needed. Used by the deploy to confirm the new
  version is live.
- `POST /api/migrate` with the deploy key → applies pending SQL files, idempotent.

Rules:

- Every plan request carries the key from the link as `Authorization: Bearer <key>`. The API
  compares its SHA-256 hash with the two configured hashes (`hash_equals`) and decides the role.
  Unknown key → `401`; a simple per-IP counter slows down guessing.
- `data` is validated as JSON object, at most 64 KiB. The API does not interpret the plan; the app
  owns the format (the same wire format as the URL today, uncompressed).
- `Cache-Control: no-store` on all responses. If app and API run on different hosts, CORS allows
  only the app's origin and `http://localhost:*`.
- `.htaccess` forces HTTPS and passes the `Authorization` header through to PHP (all-inkl runs PHP
  as FastCGI, which drops it otherwise).

Database:

```sql
CREATE TABLE plan (
  id          TINYINT UNSIGNED PRIMARY KEY,  -- always 1: one plan
  data        JSON NOT NULL,
  version     INT UNSIGNED NOT NULL,
  updated_at  DATETIME(3) NOT NULL
);

CREATE TABLE schema_migrations (
  name        VARCHAR(100) PRIMARY KEY,
  applied_at  DATETIME(3) NOT NULL
);
```

Code layout (plain PHP, no framework, no Composer):

```
api/
  public/index.php     # routes the four endpoints
  public/.htaccess     # HTTPS, Authorization passthrough, everything to index.php
  src/                 # auth.php, db.php, http.php (JSON responses, CORS)
  migrations/0001_init.sql
  tests/               # PHP built-in server + MariaDB in Docker for local tests
```

## Secrets and links

GitHub environment `production` holds:

| Secret                                         | Purpose                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`   | FTPS upload with a dedicated FTP user limited to this app's folders |
| `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | MySQL database created once in KAS                                  |
| `PLAN_ADMIN_KEY`                               | Secret behind the admin link (random, at least 32 characters)       |
| `PLAN_VIEW_KEY`                                | Secret behind the view link                                         |
| `DEPLOY_KEY`                                   | Protects the migration endpoint                                     |

- The deploy job writes `config.php` **outside the document root** with the DB credentials and
  only the SHA-256 hashes of the two plan keys.
- The links are: `<app URL>/#key=<PLAN_ADMIN_KEY>` and `<app URL>/#key=<PLAN_VIEW_KEY>`. The key
  sits after `#`, so it never appears in web server logs or in the `Referer` header; only the
  app's own API request carries it.
- **To revoke a link:** generate a new value, update the secret in GitHub, start the workflow with
  "Run workflow". After the deploy the old link stops working; send the new link to whoever should
  keep access.

## Deploy (one workflow)

On push to `main` and manually via "Run workflow":

1. Install, `bun run check-ci`, `php -l` on all API files.
2. Build the app with `VITE_PLAN_API_URL` set.
3. Generate `config.php` from the secrets.
4. Upload via FTPS (`SamKirkland/FTP-Deploy-Action@v4.4.0`, `protocol: ftps`, port 21, incremental
   sync, never "clean slate").
5. `POST /api/migrate` with `DEPLOY_KEY`.
6. `GET /api/health` and compare the reported commit with `github.sha`; fail the run otherwise.
7. Write a short summary to the GitHub run page.

## Where the app runs

Recommended: **app and API both on the all-inkl subdomain** (e.g. `urlaub.<your-domain>` with the
app at `/` and the API at `/api`). Reasons: one deploy, one host, no CORS, and the app is no longer
on a public `github.io` address. GitHub Pages and its workflow are then removed.

Alternative: keep the app on GitHub Pages and only put the API on all-inkl. Then there are two
deploy targets and CORS has to allow the GitHub Pages origin.

## App changes

- **Opening `#key=…`:** load the plan from the API, keep the key in `sessionStorage` for reloads,
  remove it from the address bar so it is not copied by accident. The role decides the view.
- **Admin view:** everything as today. Each change updates the screen immediately and is saved
  about one second later with `If-Match`. Header status: "Gespeichert 14:32", "Speichert …",
  "Nicht gespeichert – keine Verbindung".
- **Conflicts:** on `409` load the newer plan and show "Inzwischen von jemand anderem geändert";
  your last change can be applied again with one click. No automatic merging.
- **Updates from others:** reload on window focus and every 60 seconds.
- **View role:** the same views without drag, editor, settings and "Anpassen"; a badge
  "Nur ansehen".
- **URL mode stays:** without `#key` the app works as today. Admins get "Als Link ohne Server
  exportieren" (snapshot) and, once, "Diesen Link-Plan auf den Server übernehmen".
- **Info texts:** "Gut zu wissen" explains where the data lives, who can read it and how links are
  changed.

## Phases

1. API with local tests (PHP + MariaDB in Docker), deploy workflow with a dry run, first deploy and
   health check.
2. App: API client, opening `#key`, admin view with autosave and conflict handling.
3. App: view role, info texts, README; generate both links and share them.

## Fallback if FTPS turns out to be painful

The same four endpoints as a Cloudflare Worker with D1 on your own Cloudflare account, still inside
this repository, deployed with `wrangler` from the same workflow. Data then lies with Cloudflare
instead of all-inkl. Free tier: 100,000 requests/day, D1 5 GB and 100,000 row writes/day
(<https://developers.cloudflare.com/workers/platform/pricing/>, checked 2026-10-20).

## Open questions

1. App and API together on all-inkl (recommended), or keep the app on GitHub Pages?
2. Conflicts: is "last save wins, with a notice and one click to re-apply mine" enough, or should
   there be a lock ("Tobias bearbeitet gerade")?
3. Should the view link show everything, or hide parts such as notes and the leave accounts?

## Risks

- Whoever has a link has its access until the key is changed; the links must not be posted in
  public places. Changing a key is quick, but every holder needs the new link.
- No SSH: debugging relies on our own log file and the health check.
- An interrupted FTPS upload can leave a half-updated state; the health check with the commit hash
  makes that visible and a rerun fixes it.
