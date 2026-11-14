# Deployment (all-inkl, `urlaub.ingsparks.de`)

The app (static Vite build) and the PHP API are served from one all-inkl webspace. One GitHub
Actions workflow ([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)) builds, uploads
via FTPS and checks that the new commit is live. There are no tests in GitHub: the checks run on
your machine before each push (section 7). The API applies database migrations itself. The layout
and the API contract are in [api/README.md](../api/README.md) and [release-plan.md](release-plan.md).
The same setup runs in production for the sibling app Checking Sparks (`check.ingsparks.de`).

```
local (before each push)
  Husky pre-push hook: bun run check-ci -> knip -> bun run test-php (read-only) (PHPUnit in Docker)

GitHub (push to main / "Run workflow")
  bun run build -> assemble folder -> FTPS upload -> api/deploy/check.sh (routing, 401s, commit from /api/health)

first request to /api/plan on the server
  API applies pending api/migrations/*.sql (once, then nothing to do)

all-inkl webspace (folder name as KAS creates it: urlaub.ingsparks.de/; called urlaub/ below)
  urlaub/                       FTP root of the dedicated FTP user
    config/config.php           generated from secrets on every deploy (not public)
    api/{src,migrations}        PHP code (not public, no vendor/: no runtime dependencies)
    logs/                       api.log (not public, .htaccess denies all)
    public/                     document root of urlaub.ingsparks.de
      .htaccess  index.html  assets/  favicon.svg  api/index.php
```

The plan lives in one database row. The server stores only SHA-256 digests of the two keys. The
keys travel in the link fragment (`#key=...`), which the browser does not send to the server.
Secrets never live in the repository; `config.php` is generated in the workflow and exists only on
the server.

## 1. One-time setup in KAS (all-inkl)

Do these once, in this order.

1. **Subdomain.** KAS > Domain > Subdomain > add `urlaub` under `ingsparks.de`. KAS creates the
   folder `/urlaub.ingsparks.de/` and points the subdomain at it. Change the target ("Ziel >
   Webspace") to its subfolder **`/urlaub.ingsparks.de/public/`**, so `config/`, `api/` and `logs/`
   next to it are not reachable from the web (create `public/` via FTP first if KAS insists on an
   existing folder). The FTP user's path stays `/urlaub.ingsparks.de/`.
2. **TLS.** KAS > Domain > the subdomain > SSL: enable Let's Encrypt for `urlaub.ingsparks.de`.
   Wait until `https://urlaub.ingsparks.de/` answers (a 403/404 page is fine before the first deploy).
   The `.htaccess` redirects HTTP to HTTPS and sends HSTS, so TLS must work before the first deploy.
3. **PHP.** KAS > Tools > PHP version (or the subdomain's PHP setting): **PHP 8.5** for the
   subdomain. Required extensions: `pdo_mysql`, `mbstring`, `curl`, `openssl`.
4. **Database.** KAS > Tools > Databases > new MariaDB database (utf8mb4). Note host (usually
   `localhost`), database name, user and password: they become `DB_HOST`, `DB_NAME`, `DB_USER`,
   `DB_PASSWORD`. The first request to `/api/plan` creates the table (migration `001_init.sql`, applied
   by the API itself).
5. **FTP user.** KAS > Tools > FTP > new user, **restricted to the folder `urlaub.ingsparks.de/`**
   (its FTP root is that folder, so it can never touch other sites of the account). FTPS (explicit,
   port 21) is the only protocol the workflow uses. Host, user and password become `FTP_SERVER`,
   `FTP_USERNAME`, `FTP_PASSWORD`. Use a long random password just for this user.

There is no cron job: the plan is only written when someone saves it.

## 2. Generate keys and secrets

**Guided:** `scripts/setup-deploy-secrets.sh` does all of section 2 and section 3 in one go: it
generates the edit and view keys, asks for the FTP and database passwords (hidden input), writes
every secret to the GitHub environment `production` with `gh secret set`, and at the end shows the
two family links once for your password manager. Nothing is written to disk.

```sh
scripts/setup-deploy-secrets.sh            # uses the current repository; or pass owner/repo
```

By hand: two random keys (URL-safe on purpose, the edit and view keys travel in the link):

```sh
openssl rand -base64 36 | tr '+/' '-_' | tr -d '=\n'   # run twice: edit, view
# sha256 hex digests of the edit key and the view key (the server stores only these)
printf '%s' '<editKey>' | shasum -a 256 | cut -d' ' -f1
printf '%s' '<viewKey>' | shasum -a 256 | cut -d' ' -f1
```

Do not add a trailing newline when storing a secret in GitHub.

## 3. GitHub: environment and secrets

Repository > Settings > Environments > **production** (optionally require a reviewer), then add
these **environment secrets** (the workflow uses `environment: production`):

| Secret            | Value                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| `FTP_SERVER`      | FTP host from KAS                                                                                   |
| `FTP_USERNAME`    | the dedicated FTP user (restricted to `urlaub.ingsparks.de/`)                                       |
| `FTP_PASSWORD`    | its password                                                                                        |
| `DB_HOST`         | database host from KAS (usually `localhost`)                                                        |
| `DB_NAME`         | database name                                                                                       |
| `DB_USER`         | database user                                                                                       |
| `DB_PASSWORD`     | database password                                                                                   |
| `EDIT_KEY_SHA256` | sha256 hex of the edit key (the key itself stays in your password manager and in the parents' link) |
| `VIEW_KEY_SHA256` | sha256 hex of the view key (the key itself is in the grandparents' link)                            |

Nine secrets in all. An older setup may still have a `DEPLOY_KEY` secret from the time when the
workflow called `/api/migrate`; nothing reads it any more, so delete it once:
`gh secret delete DEPLOY_KEY --env production`.

The workflow fails before uploading if a secret is missing or a digest is not 64 hex characters.
The site URL (`SITE_URL`) is set at the top of `deploy.yml`.

**Rotating a key:** generate a new value, update the digest secret (`EDIT_KEY_SHA256` or
`VIEW_KEY_SHA256`) and run the workflow again ("Run workflow"). The old link stops working after the
deploy. Send the new link to the family.

## 4. What the workflow does

1. `bun install --frozen-lockfile` (this also installs the Husky hooks, see section 7), then
   `bun run build` (Vite, `dist/`). No tests and no linters run in GitHub.
2. Assemble `deploy-out/` exactly like the layout above (`dist/` + `api/deploy/htaccess` as
   `.htaccess` + `api/public/index.php` as `public/api/index.php`; `api/{src,migrations}`;
   `config/config.php` generated from secrets, with the commit; `logs/.htaccess`). `index.html` is
   held back in `deploy-index/`. The upload needs no Composer.
3. **Upload pass 1** (`SamKirkland/FTP-Deploy-Action`, pinned to the commit of v4.4.0, `protocol:
ftps`, port 21, `security: strict`, incremental sync, never a clean slate): everything except
   `index.html`, so hashed assets and the new API code are in place first.
4. **Upload pass 2**: only `index.html` (own sync state file), which switches visitors to the new
   build. The sync state files sit in the FTP root (`urlaub.ingsparks.de/`), outside the document root.
5. `api/deploy/check.sh https://urlaub.ingsparks.de <commit>`: `/` is HTML, `no-cache`, and sends the
   CSP (which allows the holiday API); an asset is 200 and `immutable`; a missing `/assets/...` is a
   real 404; a deep link falls back to the app; `/api/health` shows the commit just deployed;
   `GET` and `PUT /api/plan` without a key and with a wrong key answer 401; dotfiles are not served.
   A failed check fails the run; the output is also in the run summary.
   Missing `mod_headers` fails the check (no CSP) and produces warnings for the cache headers. You can
   run the script by hand against the live site.

**Migrations** are not a deploy step. The API applies pending `api/migrations/*.sql` before the
first request that needs the database (`/api/plan`), so a new migration file is applied by the first
request after the deploy. `/api/health` does not touch the database. The check script cannot
exercise `/api/plan` with a key (GitHub holds only the key digests), so a broken migration shows on
the first save, not in the run.

Deploys on pushes to `main` never run in parallel (`concurrency`) and are never cancelled half way.
An interrupted upload leaves a half-updated state that the health check makes visible; re-running
the workflow fixes it.

`security: strict` makes the FTPS client verify the server certificate. If all-inkl presents a
certificate for a different host name than `FTP_SERVER`, use the host name from the certificate or,
as a last resort, change it to `loose` in both upload steps.

## 5. First deploy checklist

- [ ] KAS: subdomain `urlaub.ingsparks.de` -> `/urlaub.ingsparks.de/public/`, Let's Encrypt active,
      PHP 8.5, database created, FTP user restricted to `urlaub.ingsparks.de/`.
- [ ] Keys generated (`scripts/setup-deploy-secrets.sh`); all 9 secrets set in the `production`
      environment.
- [ ] `bun run check-ci && bun run knip && bun run test-php` green locally (Docker running).
- [ ] Merge to `main` (or "Run workflow"). All steps green, including "Check the live site".
- [ ] Open <https://urlaub.ingsparks.de/> (loads), `/api/health` (`{"ok":true,"commit":"..."}`).
- [ ] Open `https://urlaub.ingsparks.de/#key=<editKey>` on a phone, make a change, reload: it is still there.
      (The first request to `/api/plan` applies the migrations and creates the table.)
- [ ] Open `https://urlaub.ingsparks.de/#key=<viewKey>` on a second device: the plan shows, no editing.
- [ ] Look at `urlaub/logs/api.log` (via FTP) once; it should be empty or only contain short error lines.
- [ ] Turn off GitHub Pages in the repository settings and update the repository homepage link
      (release plan, step 5).

If the log shows `db error sqlstate=...` or `/api/health` works but everything else gives 500, check
`config/config.php` on the server (DB host/name/user) and the PHP version of the subdomain.

## 6. Sharing the links

- **Edit link** (`https://urlaub.ingsparks.de/#key=<editKey>`) for the parents: read and write.
- **View link** (`https://urlaub.ingsparks.de/#key=<viewKey>`) for the grandparents: read only, with
  the same views and a "Nur ansehen" badge.

Send each link over a private channel. Anyone with a link can read the plan; the edit link can also
change it. The app keeps the key in the browser (`localStorage`), so the bare address works on that
device afterwards; "Auf diesem Gerät abmelden" in the settings removes it.

## 7. Local checks

There are no checks in GitHub, so they run on your machine before every push. Husky installs a
`pre-push` hook (`.husky/pre-push`), which runs:

```sh
bun run check-ci && bun run knip && bun run test-php
```

- `check-ci` and `knip`: types, lint, format, unit tests and unused code, read-only. If the push is
  blocked, run `bun run check` (fixes lint and format in place), commit and push again.
- `test-php`: PHPUnit for the API, in Docker (Docker must be running; the image is built from
  `api/Dockerfile.test`, no local PHP needed). Not part of `bun run check`.

The hook is installed by `bun install`: its `prepare` script runs `husky`. If it is missing (for
example after a fresh clone with `--ignore-scripts`), run `bunx husky` once. Skipping it with
`git push --no-verify` is possible, but then the push is not checked.

Other local tools:

- `bun run dev-api` starts the API on port 8787 with a local SQLite database (dummy keys, see
  [api/README.md](../api/README.md), "Local development"); `bun run dev` proxies `/api` to it. The
  migrations run on the first `/api/plan` request, so nothing has to be set up first.
- Production-like test without all-inkl: serve the assembled folder with `php:8.5-apache`
  (`mod_rewrite`, `mod_headers`, `AllowOverride All`, `pdo_mysql`) next to a `mariadb:10.11`
  container; point `config/config.php` at it, open `http://localhost:8080/#key=<editKey>` once (the
  first `/api/plan` request applies the migrations), then `api/deploy/check.sh http://localhost:8080 <commit>`.
  Remove the HTTPS redirect from the copy of `.htaccess` for plain `http://localhost`, and remove
  Debian's `Alias /icons/`.
