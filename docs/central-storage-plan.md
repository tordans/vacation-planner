# Plan: central storage with an admin link and a view link

Status: proposal, not built. Written 2026-10-20, revised the same day.

Decided (2026-10-20):

- App and API are both served from the all-inkl webspace, uploaded via FTPS by **one** GitHub
  Actions workflow. GitHub Pages is dropped.
- Conflicts: last save wins, with a notice and one click to re-apply your own change. No lock.
- The view link shows everything (notes and leave accounts included).

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

Browser ──HTTPS──> https://urlaub.<your-domain>/        app (static Vite build)
   │
   └──HTTPS, Authorization: Bearer <key>──> /api/…    PHP ──> MySQL table `plan`
```

Same host for app and API: no CORS, relative API URL (`/api`), one certificate.

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
- `Cache-Control: no-store` on all API responses. No CORS headers in production (same origin);
  local development uses Vite's dev-server proxy for `/api`, so no CORS is needed there either.

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

Code layout in the repository (plain PHP, no framework, no Composer):

```
api/
  index.php            # thin entry, copied to public/api/index.php on deploy
  src/                 # bootstrap.php, auth.php, db.php, http.php, mcp.php
  migrations/0001_init.sql
  tests/               # PHP built-in server + MariaDB in Docker for local tests
deploy/
  .htaccess            # the web server rules below, copied to public/.htaccess
```

## Server layout

One folder per app in the FTP account; only `public/` is reachable from the web. In KAS the
subdomain's target directory is set to `urlaub/public/` once.

```
urlaub/                    # FTP root of the dedicated FTP user
  config/config.php        # generated on deploy: DB credentials, key hashes, commit (not public)
  api/src/, api/migrations/ # PHP code (not public)
  logs/api.log             # our own log (not public)
  public/                  # document root of urlaub.<your-domain>
    .htaccess
    index.html             # Vite build
    assets/                # Vite build, hashed file names
    favicon.svg
    api/index.php          # require __DIR__ . '/../../api/src/bootstrap.php'
```

PHP on all-inkl may read files outside the document root of the same account, so `config/`,
`api/src/` and `logs/` never have to be public.

## `.htaccess` for the Vite app and the API

What the rules must achieve for this app:

- HTTPS only.
- `/api/…` goes to the PHP entry, with the `Authorization` header passed through (PHP runs as
  FastCGI on all-inkl and drops it otherwise).
- Real files (the build) are served directly.
- Any other path returns `index.html`, so a reload or a bookmarked path never ends in a 404. The app
  today has a single route with search params, so this is mostly a safety net.
- A missing file under `/assets/` returns a real 404 instead of `index.html`. Otherwise an old tab
  asking for a JavaScript file from a previous build would get HTML back and fail with a confusing
  MIME error.
- Hashed build files are cached for a year; `index.html` is always revalidated, so a new deploy
  is picked up on the next load.
- No directory listings, no dotfiles, basic security headers.

```apache
Options -Indexes -MultiViews
DirectoryIndex index.html
AddDefaultCharset utf-8
AddType text/javascript .js .mjs
AddType image/svg+xml .svg
AddType font/woff2 .woff2

RewriteEngine On

# HTTPS only
RewriteCond %{HTTPS} !=on
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]

# Hand the Authorization header to PHP (FastCGI strips it)
RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]

# Never serve dotfiles, but keep /.well-known/ open for the Let's Encrypt validation
RewriteRule (^|/)\.(?!well-known/) - [F,L]

# API: everything under /api to the PHP entry; END stops further rewriting of the result
RewriteRule ^api(/.*)?$ api/index.php [QSA,END]

# Existing files and folders are served as they are
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

# Missing build files stay 404
RewriteRule ^assets/ - [R=404,L]

# Everything else is the app
RewriteRule ^ index.html [L]

<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "no-referrer"
  Header always set X-Frame-Options "DENY"
  Header always set Strict-Transport-Security "max-age=31536000"

  <If "%{REQUEST_URI} =~ m#^/assets/#">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </If>
  <If "%{REQUEST_URI} == '/' || %{REQUEST_URI} == '/index.html'">
    Header set Cache-Control "no-cache"
  </If>
</IfModule>

<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css text/javascript application/javascript application/json image/svg+xml
</IfModule>
```

Notes and things to verify on the first deploy:

- `[END]` and `<If>` need Apache 2.4; all-inkl runs Apache 2.4 as far as known, but this is
  verified by the deploy check below, not assumed.
- `CGIPassAuth On` would be the cleaner way to pass `Authorization`, but it is not always allowed
  in `.htaccess` on shared hosting; the rewrite rule works everywhere. PHP reads
  `$_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']`.
- `mod_headers` and `mod_deflate` are wrapped in `<IfModule>` so a missing module does not break
  the site; the deploy check reports whether the cache header arrives.
- `Referrer-Policy: no-referrer` is an extra guard; the key is in the URL fragment anyway.
- `/.well-known/` stays reachable: all-inkl's Let's Encrypt renewal may validate through it.
- Vite builds with `base: '/'` (the existing `PAGES_BASE_PATH` logic is removed).
- The deploy check requests: `/` (200, HTML, `no-cache`), an existing asset (200, `immutable`),
  `/assets/does-not-exist.js` (404), `/some/path` (200, HTML), `/api/health` (200, JSON with the
  commit), `/api/plan` without key (401), `/.ftp-deploy-sync-state.json` (403 or 404).

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

`.github/workflows/deploy.yml` replaces the GitHub Pages workflow. On push to `main` and manually
via "Run workflow":

1. Install, `bun run check-ci`, `php -l` on all API files.
2. `bun run build` (Vite, `base: '/'`).
3. Assemble the upload folder: `dist/` → `public/`, `deploy/.htaccess` → `public/.htaccess`,
   `api/index.php` → `public/api/index.php`, `api/src` and `api/migrations` next to `public/`, and
   generate `config/config.php` from the secrets (DB credentials, SHA-256 hashes of the keys,
   `github.sha`).
4. Upload in two passes with `SamKirkland/FTP-Deploy-Action@v4.4.0` (`protocol: ftps`, port 21,
   incremental sync, never "clean slate"):
   - pass 1: everything except `public/index.html`, so the new `assets/` and the new PHP code
     are in place first;
   - pass 2: only `public/index.html` (own `state-name`), which switches visitors to the new build.

   Old hashed assets are removed by the incremental sync; an open tab of the previous version
   needs a reload, which is fine for a single-bundle app.

5. `POST /api/migrate` with `DEPLOY_KEY`.
6. Run the deploy check from the `.htaccess` section (curl): health with the commit hash, the
   routing and caching expectations, and the 401 without key. Fail the run if anything is off.
7. Write a short summary to the GitHub run page (deployed commit, check results).

The GitHub repository's homepage link and the README then point to `https://urlaub.<your-domain>/`.

## App changes

- **Opening `#key=…`:** load the plan from the API, keep the key in `sessionStorage` for reloads,
  remove it from the address bar so it is not copied by accident. The role decides the view.
- **Admin view:** everything as today. Each change updates the screen immediately and is saved
  about one second later with `If-Match`. Header status: "Gespeichert 14:32", "Speichert …",
  "Nicht gespeichert – keine Verbindung".
- **Conflicts (decided: last save wins):** on `409` load the newer plan and show "Inzwischen von
  jemand anderem geändert"; your last change can be applied again with one click. No lock, no
  automatic merging.
- **Updates from others:** reload on window focus and every 60 seconds.
- **View role (decided: shows everything):** the same views including notes and leave accounts,
  without drag, editor, settings and "Anpassen"; a badge "Nur ansehen".
- **URL mode stays:** without `#key` the app works as today. Admins get "Als Link ohne Server
  exportieren" (snapshot) and, once, "Diesen Link-Plan auf den Server übernehmen".
- **Info texts:** "Gut zu wissen" explains where the data lives, who can read it and how links are
  changed.

## Agent access (MCP)

Without SSH, agents need a door into the running system. Two pieces:

**1. An MCP endpoint in our own API** (`POST /api/mcp`, stateless Streamable HTTP, JSON responses
only). It is protected by its own secret `MCP_KEY` (GitHub secret, same rotation as the plan
keys) and is the only way to look inside the server besides the health check. Tools:

| Tool         | Does                                                                                                                               | Writes? |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `status`     | PHP version, loaded extensions, deployed commit, schema version, DB reachable, disk use of the app folder                          | no      |
| `read_log`   | Last N lines of our own `api.log` (requests with status and duration, errors with stack trace; keys never logged), optional filter | no      |
| `query`      | Read-only SQL (`SELECT` only, checked server-side, row limit), for `plan` and `schema_migrations`                                  | no      |
| `get_plan`   | Current plan JSON with version and `updated_at`                                                                                    | no      |
| `list_files` | Deployed files with size and hash, to compare with the commit                                                                      | no      |
| `put_plan`   | Replace the plan (with `If-Match`), e.g. to repair or restore                                                                      | yes     |
| `migrate`    | Apply pending migrations                                                                                                           | yes     |

Write tools are off unless `MCP_ALLOW_WRITE=1` is set in the deploy; read tools are enough for
debugging.

Implementation: the official PHP SDK (`modelcontextprotocol/php-sdk`, maintained by the PHP
Foundation and Symfony, still marked experimental) supports HTTP transports, but needs Composer
dependencies; they would be installed in the GitHub Actions job and uploaded as `vendor/`. With
seven tools a hand-written endpoint (JSON-RPC `initialize`, `tools/list`, `tools/call`, ~200
lines) is simpler and has no dependency to keep up to date. Recommendation: hand-written, with the
SDK as the upgrade path if we ever need resources, prompts or streaming.

**2. File access over FTPS from the agent's machine** with an existing FTP MCP server in
**read-only mode**, limited to the app's folder, e.g. `ftp-mcp` (Kynlos: read-only mode, dry-run
sync, connection reuse) or `vielhuber/ftpmcp` (path jail, read-only). This lets an agent read
the all-inkl access and error logs, which all-inkl provides as files, and check what was uploaded.
Not yet verified which of these is maintained; check before use. Deploys stay in GitHub Actions,
never through the agent.

Direct MySQL access from outside: not verified whether all-inkl allows it on Privat+; the plan
does not depend on it, `query` covers it.

## Phases

1. API with local tests (PHP + MariaDB in Docker), MCP endpoint with read tools, deploy workflow
   with a dry run, first deploy and health check.
2. App: API client, opening `#key`, admin view with autosave and conflict handling.
3. App: view role, info texts, README; generate both links and share them.

## Fallback if FTPS turns out to be painful

The same four endpoints as a Cloudflare Worker with D1 on your own Cloudflare account, still inside
this repository, deployed with `wrangler` from the same workflow. Data then lies with Cloudflare
instead of all-inkl. Free tier: 100,000 requests/day, D1 5 GB and 100,000 row writes/day
(<https://developers.cloudflare.com/workers/platform/pricing/>, checked 2026-10-20).

## Open questions

1. Subdomain name, e.g. `urlaub.<your-domain>`, and which of your domains.
2. Owner steps before the first deploy (cannot be done from the repository): create the subdomain
   with target `urlaub/public/` and Let's Encrypt, the MySQL database, a dedicated FTP user limited
   to `urlaub/`, and the GitHub environment `production` with the secrets above.

## Risks

- Whoever has a link has its access until the key is changed; the links must not be posted in
  public places. Changing a key is quick, but every holder needs the new link.
- No SSH: debugging relies on our own log file, the health check and the MCP endpoint; a leaked
  `MCP_KEY` gives read access to the plan, so it is rotated like the plan keys.
- An interrupted FTPS upload can leave a half-updated state; the health check with the commit hash
  makes that visible and a rerun fixes it.
