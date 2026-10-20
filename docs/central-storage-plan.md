# Plan: central storage with read and write links

Status: proposal, not built. Written 2026-10-20.

## Goal

Today the whole plan lives in the URL. That works without a server, but every change produces a
new link, and old links silently show old states. Central storage should give:

- **One stable link per plan** that always shows the latest state.
- **A read link** to share with the grandparents: they see the plan, they cannot change it.
- **A write link** to share with the spouse: both edit the same plan.
- **No user accounts.** Whoever has a link has its access level ("capability links").
- **Data on infrastructure we control,** ideally in Germany.
- **Automated deploy** from GitHub Actions.

The URL-only mode stays as it is. Central storage is an optional "Online speichern" step.

## What already exists

The all-inkl Privat+ webspace and the planned **key-value-db** service
(`FMC/key-value-db/.cursor/plans/php_kv_api_on_all-inkl_e659fdf8.plan.md`) cover most of the
infrastructure:

- PHP 8.4 and MariaDB 10.11 (used as MySQL), HTTPS via Let's Encrypt, a subdomain per service.
- No SSH: deploy via FTPS from GitHub Actions (`SamKirkland/FTP-Deploy-Action` v4.4.0, explicit
  FTPS on port 21), DB migrations through an authenticated HTTP endpoint, health check after deploy.
- Projects with origin allowlist, CORS, JSON entries with `version` and `If-Match` conflict check,
  admin via MCP.

What it does **not** have: its write model requires a verified OpenStreetMap login. The planner has
no login; grandparents and spouse should not need an OSM account.

## Options

|               | A) Extend key-value-db (all-inkl)                 | B) Cloudflare Worker + D1                                  | C) Separate PHP app on all-inkl                      |
| ------------- | ------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------- |
| Data location | Germany, own contract                             | Cloudflare (US company), EU residency not verified         | Germany, own contract                                |
| Cost          | Already paid                                      | Free tier: 100k requests/day, D1 5 GB, 100k row writes/day | Already paid                                         |
| Build effort  | Small on top of key-value-db: one new access mode | Medium: Worker, D1 schema, token logic                     | Medium: everything key-value-db already plans, again |
| Deploy        | FTPS workflow from key-value-db                   | `wrangler` in GitHub Actions, clean                        | FTPS, a second workflow to maintain                  |
| Logs, ops     | Self-written log files                            | Real logs, cron triggers                                   | Self-written log files                               |
| Dependency    | key-value-db must be built first (Phase 0–1)      | None                                                       | None                                                 |

Cloudflare numbers from <https://developers.cloudflare.com/workers/platform/pricing/> (checked
2026-10-20); a changelog mention of D1 free-plan changes on 2026-09-01 was not confirmed on the
pricing page.

## Recommendation: A, extend key-value-db with "link documents"

Reasons: the data stays in Germany on the contract you already pay for; the hosting, deploy,
migration and CORS work is planned once in key-value-db and reused; the extra feature is small and
also useful for other SPAs that want sharing without login. Cloudflare (B) is the fallback if
key-value-db is not going to be built soon; the API below ports 1:1 to a Worker.

### Server side (in key-value-db)

New table, separate from OSM-authenticated `entries`:

```sql
CREATE TABLE link_docs (
  pk           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id   INT UNSIGNED NOT NULL,
  doc_id       CHAR(22) NOT NULL,          -- random, base64url, public part of the link
  read_hash    CHAR(64) NOT NULL,          -- sha256 of the read token
  write_hash   CHAR(64) NOT NULL,          -- sha256 of the write token
  data         JSON NOT NULL,              -- the plan (wire format, uncompressed)
  version      INT UNSIGNED NOT NULL DEFAULT 1,
  created_at   DATETIME(3) NOT NULL,
  updated_at   DATETIME(3) NOT NULL,
  UNIQUE KEY uq_project_doc (project_id, doc_id),
  CONSTRAINT fk_docs_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

Endpoints (project key + origin check as for all `/v1/projects/*` requests):

- `POST /v1/projects/{slug}/docs` body `{ data }` → `201 { id, version, read_token, write_token }`.
  Tokens are 128-bit random, returned once, stored only as hashes. Rate limit per IP (e.g. 20/h).
- `GET /v1/projects/{slug}/docs/{id}` with `Authorization: Bearer <read or write token>` →
  `{ data, version, updated_at, can_write }`, `ETag: "<version>"`.
- `PUT /v1/projects/{slug}/docs/{id}` with the write token and `If-Match: "<version>"` →
  `200 { version, updated_at }`, or `409 version_conflict` with the current version.
- `POST /v1/projects/{slug}/docs/{id}/rotate` with the write token → new read and/or write token
  (revokes links that leaked).
- `DELETE /v1/projects/{slug}/docs/{id}` with the write token.

Limits: `data` ≤ 64 KiB; constant-time hash compare; `Cache-Control: no-store`; HTTPS only.

### Client side (vacation planner)

- **Links.** Online plans use `?doc=<id>#w=<write token>` (write) and `?doc=<id>#r=<read token>`
  (read). The token sits in the URL fragment, so it never reaches GitHub Pages' server logs or the
  `Referer` header; only the app's own API request carries it.
- **"Online speichern"** in the header: creates the doc from the current URL plan, switches to the
  write link and shows both links to copy ("Zum Ansehen" / "Zum Mitplanen").
- **Write view:** every commit updates local state immediately and saves to the API after a short
  pause (about 1 s, debounced) with `If-Match`. Status in the header: "Gespeichert 14:32",
  "Speichert …", "Offline – Änderungen noch nicht gespeichert".
- **Conflicts:** on `409` the app loads the newer version and shows "Inzwischen von jemand anderem
  geändert – deine letzte Änderung wurde nicht gespeichert"; the overwritten change stays available
  to re-apply via a "Meine Version trotzdem speichern" button. No merging in v1.
- **Updates from others:** refetch on window focus and every 60 s (TanStack Query
  `refetchInterval`), so the spouse and the grandparents see changes without reloading.
- **Read view:** same views, but no drag, no editor panel, no settings or "Anpassen" buttons; a
  small badge "Nur ansehen".
- **`saved` timestamp:** in online mode the header shows the server's `updated_at`; the link no
  longer needs it because it always shows the latest state.
- **Local mode stays:** without `doc` everything works as today. "Als Link ohne Server
  exportieren" turns an online plan back into a URL-only link.
- **Info texts:** the "Gut zu wissen" topics on storage, external services and keeping the link
  are rewritten for both modes (data on the all-inkl server in Germany, who can read it, how to
  revoke links).

### Deploy

- key-value-db deploys itself (its own FTPS workflow); the planner project is created there via the
  MCP admin tools with origins `https://tordans.github.io` and `http://localhost:*`.
- The planner stays on GitHub Pages. The API base URL and the public project key are build-time
  env vars (`VITE_KV_URL`, `VITE_KV_PROJECT_KEY`) set as repository variables in GitHub Actions.

### Phases

1. key-value-db Phase 0–1 (as planned there), plus `link_docs` and its endpoints with tests.
2. Planner: API client, "Online speichern", write view with autosave and conflict handling.
3. Planner: read view, token rotation, info texts, README.

## Open questions

1. Extend key-value-db (recommended) or build a separate small PHP app just for the planner?
2. Is the token in the URL fragment (`#w=…`) acceptable, knowing that anyone with the full link
   has that access until the link is rotated?
3. Conflicts: is "last save wins, with a warning and the option to save mine anyway" enough, or do
   you want a lock ("Tobias bearbeitet gerade")?
4. Read view for the grandparents: the full app read-only (recommended), or a simpler page with
   just the year overview and the list?
5. Should online plans expire or be deleted after some time without access, or keep forever?

## Risks

- Capability links leak through chat history, screenshots and forwarded messages; rotation is the
  only remedy, so the UI must make it easy.
- all-inkl FTPS deploys and the missing SSH make debugging slower than on Cloudflare.
- key-value-db is not built yet; this feature depends on it.
