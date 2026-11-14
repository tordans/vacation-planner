# Vacation Planner API

PHP 8.5, no framework, PDO. MariaDB 10.11 in production (all-inkl), SQLite in memory in the tests.
The API stores one shared plan. The app works without it (plan in the link); with it, parents and
grandparents see the same plan. The contract is in [../docs/release-plan.md](../docs/release-plan.md)
("API contract"); this file covers what is specific to the PHP code.

The server never interprets the plan. It checks that `data` is a JSON object, stores it as JSON
text and returns it unchanged.

## Endpoints

JSON in and out. Every response has `Cache-Control: no-store`. Errors are `{ "error": "<code>" }`.

| Method + path     | Auth         | Result                                                                                                                                                                                                                                                                                                                        |
| ----------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health` | none         | `200 { ok: true, commit }` (works without a database)                                                                                                                                                                                                                                                                         |
| `GET /api/plan`   | edit or view | `200 { role, plan: { version, updatedAt, data } \| null }` + `ETag: "<version>"`; `plan` is `null` before the first save                                                                                                                                                                                                      |
| `PUT /api/plan`   | edit         | body `{ data }`. `If-Match: "<version>"` updates, `If-None-Match: *` creates. `200 { version, updatedAt }` + `ETag`. `409 { error: "conflict", plan }` when the version is stale or a plan exists already (`plan` is `null` when `If-Match` is sent but there is no plan). `428` without precondition. `403` for the view key |

Database migrations are not an endpoint: the API applies pending `migrations/*.sql` itself before
the first request that needs the database (see [Migrations](#migrations)). `GET /api/health` never
touches the database.

Other rules:

- **Keys:** `Authorization: Bearer <key>`. The server compares `sha256(key)` with `edit_key_sha256`
  and `view_key_sha256` using `hash_equals` and sets the role `edit` or `view`. Missing or unknown:
  `401`. A key that is not configured (empty hash) never matches.
- **Malformed JSON:** an empty or unparseable body is `400 { "error": "invalid_json" }`.
- **Body over 64 KiB:** `413`. Unknown path: `404`. Known path, wrong method: `405` with `Allow`.
- **Plan body:** must be a JSON object with a `data` object, otherwise `422 invalid_plan`.
- **If-Match** takes the current version (`"3"`, `W/"3"` or `3`). Any other value, including `*` and
  garbage, counts as a stale precondition: `409` with the current plan (not `428`).
- **Writes are atomic:** the update is `UPDATE ... WHERE version = ?`; if another save got in
  between, the answer is `409` with the new plan. The server never overwrites a newer version on
  its own; "save my change anyway" is a second `PUT` by the client, with the version it was just
  shown.
- **Same origin only:** no CORS headers are sent. Local development reaches the API through Vite's
  proxy for `/api`, production serves the API from the same host.
- **Logging:** only short error lines (exception class/message, or SQLSTATE for database errors).
  Request bodies, plans, keys and query strings are never logged.

## Configuration

`config.example.php` documents every key: `db` (dsn/user/password), `edit_key_sha256`,
`view_key_sha256`, `commit`, `log_file`. The deploy workflow
generates the real `config.php` from secrets and uploads it outside the document root. Lookup
order: `$PLAN_CONFIG`, `api/config.php` (git-ignored, local development), `../config/config.php`
next to the api folder (deployed).

### Generate keys

```sh
# random keys (keep them in GitHub secrets / a password manager; the setup script does this)
openssl rand -base64 36 | tr '+/' '-_' | tr -d '=\n'   # edit key and view key: one each

# the sha256 hex digests go into config.php
printf '%s' '<key>' | shasum -a 256 | cut -d' ' -f1
```

## Deployed folder layout (all-inkl)

One FTP user, one folder; only `public/` is the document root of `urlaub.ingsparks.de`.
The API has no runtime dependencies: `api/` holds only `src/` and `migrations/`, and
`src/bootstrap.php` autoloads the classes itself (no Composer on the server).

```
urlaub.ingsparks.de/           FTP root of the dedicated FTP user
  config/config.php            generated on deploy: DB, key digests, commit (not public)
  api/
    src/                       PHP code
    migrations/                SQL files
  logs/                        api.log (not public, .htaccess denies all)
  public/                      document root (KAS subdomain target: urlaub.ingsparks.de/public/)
    .htaccess                  from api/deploy/htaccess
    index.html, assets/, favicon.svg   the Vite build (dist/)
    api/index.php              copy of api/public/index.php
```

`public/api/index.php` finds the code in `../../api`; in the repository `api/public/index.php`
finds it in `..`.

### `.htaccess` (`deploy/htaccess`)

Apache 2.4. HTTPS only; passes the `Authorization` header to PHP (FastCGI would drop it); `/api/*`
to `api/index.php`; existing files served as they are; missing `/assets/*` is a real 404; everything
else falls back to `index.html` (SPA). `/` and `index.html` are `no-cache`, `/assets/*` is
`immutable` for one year; dotfiles are denied (except `/.well-known/`); no directory listing;
security headers, including a strict `Content-Security-Policy` (everything `'self'`, plus
`https://www.mehr-schulferien.de` for the holiday data, no inline script or style, no framing). Keep
it in sync with `preview.headers` in `vite.config.ts`. `deploy/check.sh` fails without the CSP header.

## Local development

`bun run dev-api` builds the image from `Dockerfile.test` and starts PHP's built-in server on port 8787 with `config.dev.php` (SQLite in `api/dev/`, dummy keys). Run it
next to `bun run dev`; Vite proxies `/api` to it in both `dev` and `preview`.

```sh
bun run dev-api                                                             # terminal 1 (creates the tables on the first /api/plan request)
bun run dev                                                                 # terminal 2
# open http://localhost:5173/#key=dev-edit-key  (or #key=dev-view-key for read only)
```

`api/config.dev.php` is committed on purpose: its keys are dummies and it is never deployed (the
deploy workflow writes `config.php` from secrets). To use your own local config, copy
`config.example.php` to `api/config.php` and set `PLAN_CONFIG` if needed.

Without local PHP, use Docker (image from `Dockerfile.test`). From the repository root,
`bun run test-php` builds the image, runs `composer install` and PHPUnit.

## Tests

PHPUnit 12 against SQLite in memory. PHP is not needed locally:

```sh
bun run test-php
```

Optional: the same tests against MariaDB 10.11 (checks that the SQL is portable):

```sh
docker network create vp-test
docker run -d --rm --name vp-mariadb --network vp-test -e MARIADB_ROOT_PASSWORD=root -e MARIADB_DATABASE=plan mariadb:10.11
docker run --rm --network vp-test -v "$PWD/api":/app -w /app \
  -e TEST_DB_DSN='mysql:host=vp-mariadb;dbname=plan;charset=utf8mb4' -e TEST_DB_USER=root -e TEST_DB_PASSWORD=root \
  vacation-planner-api-test vendor/bin/phpunit
docker rm -f vp-mariadb && docker network rm vp-test
```

There is no PHP CI on GitHub: the tests run locally before each push (Husky pre-push hook, see
[docs/deploy.md](../docs/deploy.md), "Local checks").

## Migrations

Plain SQL files (`NNN_name.sql`), idempotent (`IF NOT EXISTS`), no semicolons inside string literals,
portable between MariaDB and SQLite. Never edit an applied file; add a new one.

The API applies pending files itself: `App::db()` runs `Migrator` before the first request that
needs the database (`/api/plan`), so there is no deploy step and no endpoint. Each such request
costs one query for the names already applied; nothing is applied when nothing is pending. Requests
that start at the same time may both run a new file: the statements are idempotent and the
`migrations` primary key makes the second record a no-op, so neither request fails. `/api/health`
never touches the database, so it works before the first migration.
