# Plan: central storage with an admin link and a view link

Status: proposal, not built. Written 2026-10-20, revised the same day.

## Goal

Today the whole plan lives in the URL. That works without a server, but every change produces a
new link, and old links silently show old states. Central storage should give:

- **One stable plan** on a server that always has the latest state.
- **An admin link** (edit) for the two parents, so both work on the same plan.
- **A view link** (read only) for the grandparents.
- **No user accounts, no third-party login.** Access works only through these two protected links.
- **Links changed on the server side:** the secrets behind the links are configured as GitHub
  Actions secrets; changing a secret and redeploying invalidates the old link.
- **Data on infrastructure we control,** ideally in Germany.
- **Automated deploy** from GitHub Actions.

The URL-only mode stays as a fallback (e.g. for trying things out or exporting a snapshot).

## Starting point

- **all-inkl Privat+ webspace** (paid already): PHP 8.4, MariaDB 10.11 (used as MySQL), HTTPS via
  Let's Encrypt, subdomains, no SSH. Deploy only via FTPS (explicit FTPS on port 21; no SFTP).
  These facts come from the earlier research in
  `FMC/key-value-db/.cursor/plans/php_kv_api_on_all-inkl_e659fdf8.plan.md`; nothing was built on
  all-inkl.
- **key-value-db** (FixMyBerlin, open source, AGPL) is built and runs as a **Cloudflare Worker
  with D1** on the company's Cloudflare account. Its access model is built around OpenStreetMap
  logins and projects with tags, which this app does not need. Reusing it would mean either a
  private copy of a company project or a second, different access model inside it. It is a useful
  reference for code and deploy setup (Hono, D1, `wrangler` in GitHub Actions), not a base to
  extend.

## What the app needs from a server

Very little: one JSON document (the plan, a few KB), read it, write it, and know whether the
caller may write.

- `GET /plan` → `{ data, version, updated_at, role: 'admin' | 'viewer' }`
- `PUT /plan` with `If-Match: "<version>"` → `{ version, updated_at }`, or `409` when someone else
  saved in the meantime. Only the admin key may write.
- Every request carries the key from the link as `Authorization: Bearer <key>`. The server compares
  its SHA-256 hash with the two configured hashes (constant-time) and decides the role. Unknown
  key → `401`.
- Optional later: several plans (e.g. a second family) by adding a plan slug to the path and a
  key pair per plan.

## Options

|                    | A) Small PHP API on all-inkl                                 | B) Small Worker on your own Cloudflare account                       | C) Reuse key-value-db                 |
| ------------------ | ------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------- |
| Data location      | Germany, own contract                                        | Cloudflare (US company), EU residency not verified                   | Company Cloudflare account            |
| Cost               | Already paid                                                 | Free tier (100k requests/day, D1 5 GB, 100k row writes/day)          | Free, but company resources           |
| Code to write      | One PHP file plus a small migration, ~150 lines              | One Worker, ~100 lines, TypeScript                                   | New access mode in someone else's API |
| Deploy             | FTPS from GitHub Actions; config file generated from secrets | `wrangler deploy` from GitHub Actions; secrets via `wrangler secret` | Existing pipeline                     |
| Changing the links | Change the GitHub secret, rerun the deploy                   | Change the GitHub secret, rerun the deploy                           | Admin tools of key-value-db           |
| Debugging          | Log file over FTP, no shell                                  | Real logs (`wrangler tail`)                                          | Real logs                             |
| Backups            | all-inkl's automatic MySQL backups                           | D1 time travel                                                       | D1 time travel                        |

Cloudflare numbers from <https://developers.cloudflare.com/workers/platform/pricing/> (checked
2026-10-20).

## Recommendation: A, a small PHP API on all-inkl

Reasons: the data stays in Germany on the webspace you already pay for, the server part is tiny
(one document), and the two keys fit naturally into the deploy as secrets. B is the fallback if the
FTPS deploy turns out to be painful; the API above ports 1:1 to a Worker. C is not recommended: it
mixes a private family plan into a company project and needs an access model it does not have.

### Server (PHP on all-inkl)

Lives in this repo under `api/` and is deployed to its own subdomain, e.g.
`urlaub-api.<your-domain>`.

```
api/
  public/index.php     # router: GET/PUT /plan, OPTIONS, health
  public/.htaccess     # HTTPS redirect, pass Authorization header to PHP, rewrite to index.php
  migrations/0001.sql  # CREATE TABLE plans (...)
  src/                 # small functions: auth, cors, db, json responses
```

```sql
CREATE TABLE plans (
  slug        VARCHAR(64) PRIMARY KEY,   -- 'default' for now
  data        JSON NOT NULL,
  version     INT UNSIGNED NOT NULL DEFAULT 1,
  updated_at  DATETIME(3) NOT NULL
);
```

- `config.php` sits **outside** the document root and is generated in the deploy job from GitHub
  secrets. It contains the DB credentials and the **SHA-256 hashes** of the admin key and the view
  key, never the keys themselves.
- CORS allows only `https://tordans.github.io` and `http://localhost:*`. Responses use
  `Cache-Control: no-store`. Request body limit 64 KiB. Simple rate limit per IP for failed keys.
- A one-time migration endpoint protected by a separate deploy key runs `0001.sql` after the
  first upload; afterwards the deploy job calls it on every run (idempotent).
- `GET /health` returns `{ ok, commit }`; the deploy job checks it to confirm the new version is
  live.

### Secrets and link rotation

GitHub environment `all-inkl` holds:

| Secret                                         | Purpose                                                     |
| ---------------------------------------------- | ----------------------------------------------------------- |
| `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`   | FTPS upload (dedicated, jailed FTP user for the API folder) |
| `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | MySQL database created once in KAS                          |
| `PLAN_ADMIN_KEY`                               | Secret behind the admin link (random, ≥ 32 characters)      |
| `PLAN_VIEW_KEY`                                | Secret behind the view link                                 |
| `DEPLOY_KEY`                                   | Protects the migration endpoint                             |

- The deploy job hashes `PLAN_ADMIN_KEY` and `PLAN_VIEW_KEY` and writes the hashes into
  `config.php`.
- **To revoke a link:** generate a new value, update the secret in GitHub, rerun the workflow
  ("Run workflow" button). The old link stops working immediately after the deploy; send the new
  link to whoever should keep access.
- The links themselves are built by hand once:
  `https://tordans.github.io/vacation-planner/#key=<PLAN_ADMIN_KEY>` and the same with
  `PLAN_VIEW_KEY`. The key sits in the URL fragment (`#`), so it never reaches GitHub Pages' server
  logs or the `Referer` header; only the app's own API request carries it.

### Deploy workflow (GitHub Actions)

1. On push to `main` with changes under `api/` (and manually via "Run workflow"):
   `php -l` on all files.
2. Generate `config.php` from the secrets.
3. Upload with `SamKirkland/FTP-Deploy-Action@v4.4.0`, `protocol: ftps`, port 21, incremental
   sync, never "clean slate"; `config.php` goes to the folder above the document root.
4. Call the migration endpoint with `DEPLOY_KEY`.
5. Call `/health` and compare the reported commit with `github.sha`; fail the job otherwise.

The frontend keeps deploying to GitHub Pages as today. The API URL is a build-time variable
(`VITE_PLAN_API_URL`), set as a repository variable.

Alternative worth considering: also serve the frontend from all-inkl (same upload, different
folder). Then everything is on one host, no CORS, and the app is not on a public `github.io`
address. Downside: the GitHub Pages deploy we have today would be replaced by FTPS.

### App (vacation planner)

- **Opening `#key=…`:** the app loads the plan from the API, keeps the key in memory and in
  `sessionStorage` for reloads, and removes it from the address bar so it is not copied by
  accident. The role decides the view.
- **Admin view:** everything as today. Each change updates the screen at once and is saved to the
  API after about one second, with `If-Match`. Header status: "Gespeichert 14:32", "Speichert …",
  "Nicht gespeichert – keine Verbindung".
- **Conflicts:** on `409` the app loads the newer plan and shows "Inzwischen von jemand anderem
  geändert"; your last change can be applied again with one click. No automatic merging in v1.
- **Updates from others:** reload on window focus and every 60 seconds, so both parents and the
  grandparents see the latest state.
- **View role:** the same views without drag, editor, settings and "Anpassen"; a badge
  "Nur ansehen".
- **URL mode stays:** without `#key` the app works as today. Admins get "Als Link ohne Server
  exportieren" (snapshot in the URL) and, once, "Diesen Link-Plan auf den Server übernehmen".
- **Info texts:** "Gut zu wissen" explains both modes: where the data lives (all-inkl, Germany),
  who can read it (whoever has one of the two links), how links are changed.

### Phases

1. API: PHP endpoints, migration, CORS, tests against a local PHP + MariaDB (Docker), deploy
   workflow with a dry run, first deploy and health check.
2. App: API client, opening `#key`, admin view with autosave and conflict handling.
3. App: view role, info texts, README; generate the two links and share them.

## Open questions

1. Is one plan enough, or should the server hold several plans from the start (e.g. per family)?
2. Frontend: stay on GitHub Pages (as today) or move it to all-inkl together with the API?
3. Conflicts: is "last save wins, with a notice and one click to re-apply mine" enough, or should
   there be a lock ("Tobias bearbeitet gerade")?
4. Should the view link show everything, or hide parts such as notes and the leave accounts?

## Risks

- Whoever has a link has its access until the key is changed; the links must not be posted in
  public places. Changing a key is quick, but every holder needs the new link.
- all-inkl has no SSH; debugging relies on our own log file and the health check.
- Free-form FTPS deploys can leave half-uploaded states if a run is interrupted; the health check
  with the commit hash makes that visible.
