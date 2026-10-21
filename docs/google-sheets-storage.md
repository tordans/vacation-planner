# Idea: store the plan in a Google Spreadsheet

Status: analysis, not decided, not built. Written 2026-10-21.
Compares with the current proposal in [central-storage-plan.md](central-storage-plan.md)
(own PHP API and MySQL on the all-inkl webspace).

## The question

Can the app read and write its data in a Google Sheet, ideally straight from the browser, and is
that better than the PHP plan? Same requirements as before: one shared plan, an edit link for the
parents, a view link for the grandparents, no extra accounts, automated deploy, self-contained in
this repository.

## Ways to talk to a Google Sheet

### A) Google Sheets API directly from the browser, with Google sign-in

The app loads Google Identity Services, asks the user to sign in with Google and to allow access,
gets an access token and calls the Sheets REST API (`spreadsheets.values.get/update`) with `fetch`.
No server of our own.

- **Library:** none needed; the REST API plus Google Identity Services' token client is enough.
  The npm package `google-spreadsheet` (the package you probably remember, now v5) wraps the API
  nicely, but its README only shows server use with a service account and does not document
  browser use. A service account key must never be shipped to the browser, so that route needs a
  server anyway.
- **Who can access:** whoever the sheet is shared with in Google Drive (editor or viewer). Access
  control is Google's, not a secret link. Every person, including the grandparents, needs a Google
  account and must sign in.
- **Tokens:** access tokens are short-lived by design; Google's token-model guide says a new token
  must be requested from a user action (e.g. a button), so long sessions show a re-auth prompt
  from time to time. Consent is only asked the first time per scope.
- **Scopes and Google's review:** the full `spreadsheets` scope counts as sensitive; an app that is
  not verified by Google shows an "unverified app" warning and, while in testing mode, is limited
  to listed test users. The narrower `drive.file` scope (only files the app created or the user
  picked) avoids most of that. Details not verified for this setup; to be checked in the Google
  Cloud console.
- **Setup:** a Google Cloud project, OAuth consent screen, OAuth client ID with the app's origin.

### B) Google Apps Script web app as a tiny server inside Google

A script attached to the sheet (`doGet` / `doPost`) is deployed as a web app that runs as the
owner and can be called by anyone who knows the URL. The script checks a secret key, reads or
writes the sheet and returns JSON. This is the same "admin link + view link" model as the PHP plan,
with Google instead of all-inkl as the host.

- **No login for users.** The browser sends the key; the script compares it with values stored in
  the script's properties (admin key, view key).
- **CORS:** Apps Script web apps answer simple requests but have no `OPTIONS` handler, so the app
  must avoid preflights: `POST` with `Content-Type: text/plain` and the JSON in the body, key in
  the body instead of an `Authorization` header. Community sources report this works; Google's own
  docs do not describe it. Must be tested first.
- **Concurrency:** `LockService` serialises writes; Apps Script allows 30 simultaneous executions
  per user and 1,000 per script, plenty for a family.
- **Quotas and speed:** generous for this use. Each call starts a script run, which typically
  takes noticeably longer than a PHP request (often around a second or more; not measured here).
- **Deploy from GitHub Actions:** possible with `clasp` (push the code from `apps-script/` in this
  repo and create a new deployment), using stored Google credentials as a GitHub secret. Keeping
  the same web app URL means updating the existing deployment instead of creating a new one.
- **Logs:** executions and `console.log` are visible in the Apps Script dashboard; much better
  than FTP log files.

### C) Third-party "sheet as API" services (SheetDB, sheet.best, Stein, …)

They turn a sheet into a REST API. The data then also passes through another company, free tiers
are small and change often. Not considered further.

### Not an option on its own: public read-only sheet

A sheet "published to the web" can be read without login (e.g. via CSV export). Anyone with the
link can read it, it cannot be written, and the published copy updates with a delay. Useful at
most as an extra read-only view.

## How the data would sit in the sheet

Two possibilities, independent of A or B:

1. **One cell with the plan as JSON** (plus version and timestamp in neighbouring cells). Simple,
   same format as today, no mapping code. A cell holds up to 50,000 characters, enough for a
   family plan (the compressed link today is well under 1,000 characters). The sheet is then just
   storage; nobody edits it by hand.
2. **Readable tables** (tab "Zeiträume" with one row per period, tab "Haushalte", …). People can
   read, sort and even edit the plan in Google Sheets, and Sheets' version history becomes a
   readable change log. Costs: mapping code both ways, IDs per row, validation of hand edits, and
   rules for what happens when someone edits a row the app does not understand.

Recommendation if we go this way: start with 1, and let the script additionally write a
read-only, human-readable copy into a second tab. Editing stays in the app.

## Comparison

|                    | PHP + MySQL on all-inkl (current plan)    | B) Apps Script + Sheet                           | A) Sheets API with Google sign-in      |
| ------------------ | ----------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| Accounts for users | none, two secret links                    | none, two secret links                           | Google account for everyone            |
| Where data lives   | all-inkl, Germany                         | Google (owner's Drive)                           | Google (owner's Drive)                 |
| Server code        | PHP API (~150 lines) + MCP                | Apps Script (~100 lines)                         | none                                   |
| Hosting of the app | all-inkl via FTPS                         | anywhere static (GitHub Pages stays)             | anywhere static                        |
| Deploy             | one FTPS workflow, DB migrations via HTTP | `clasp` in GitHub Actions, credentials as secret | none for data                          |
| Changing links     | change GitHub secret, redeploy            | change script property (or secret + redeploy)    | change sharing in Google Drive         |
| Debugging          | own log file, MCP endpoint, no SSH        | Apps Script execution log                        | browser dev tools                      |
| Backups / history  | all-inkl MySQL backups                    | Sheets version history, can be restored by hand  | Sheets version history                 |
| Speed per save     | fast (PHP + MySQL)                        | slower, script start per request                 | fast-ish (Google API)                  |
| Concurrency        | version check, last save wins             | `LockService` + version check                    | version check in the app               |
| Unknowns           | Apache modules, FTPS deploy details       | CORS workaround, clasp in CI, latency            | Google app verification, token prompts |
| Vendor dependency  | your hosting contract                     | Google account and Apps Script                   | Google Cloud project                   |

## UX view

- **Grandparents (view link):**
  - PHP and Apps Script: open the link, done. Same experience.
  - Sheets API with sign-in: they need a Google account, a sign-in, and a consent screen that may
    say "unverified app". The biggest UX cost of option A, and the reason to rule it out for them.
- **Parents (edit link):**
  - PHP: saves feel instant ("Gespeichert" after about a second of debounce).
  - Apps Script: saves take longer, so the "Speichert …" state is visible more often; loading the
    plan on open also takes longer. Acceptable for a planning tool, noticeable on every visit.
  - Sheets API with sign-in: works, but occasional re-auth prompts during long sessions.
- **Looking at the data outside the app:** only the Sheet options offer this. Seeing the plan as
  a table in Google Sheets, or restoring an older version from Sheets' history, is a real plus for
  non-technical people. With the PHP plan the data is only visible through the app (or phpMyAdmin).
- **Trust and privacy:** "lies in our own webspace in Germany" is easier to explain to family than
  "lies in Tobias' Google Drive", but many families already share calendars and documents there,
  so this is a matter of taste.
- **Setup effort for you:** the PHP plan needs KAS steps (subdomain, DB, FTP user) once. Apps
  Script needs a Google sheet, the script project and a one-time `clasp` login to create the CI
  credentials. Similar effort, different place.

## Assessment

- **Option A (Sheets API with Google sign-in)** fails the "no accounts" requirement and hurts the
  grandparents' experience. Not recommended.
- **Option B (Apps Script)** is a real alternative to the PHP plan. It removes FTPS, MySQL and
  the self-written log, gives a readable backup and version history for free, and lets the app
  stay on GitHub Pages. It trades that for slower requests, data at Google and two parts that
  need a spike first (CORS with `text/plain`, `clasp` deploy from CI).
- **PHP on all-inkl** stays the better fit for "fast, private, on our own webspace".

Suggested next step if the Google idea is attractive: a half-day spike for option B, measuring
load and save times from the app and confirming the CORS workaround and the `clasp` deploy. The
API shape (`GET` plan with role, `PUT` with version check, last save wins) is the same for both, so
the app side does not depend on the decision.

## Sources

- Sheets API limits: 300 read and 300 write requests per minute per project, 60 per minute per
  user: <https://developers.google.com/sheets/api/limits>
- Apps Script quotas (30 simultaneous executions per user, 1,000 per script):
  <https://developers.google.com/apps-script/guides/services/quotas>
- `LockService`: <https://developers.google.com/apps-script/reference/lock/lock-service>
- Google Identity Services token model:
  <https://developers.google.com/identity/oauth2/web/guides/use-token-model>
- `google-spreadsheet` package: <https://github.com/theoephraim/node-google-spreadsheet>
- Apps Script web apps and CORS (community, not official):
  <https://zenn.dev/luth/articles/node-fetch-gas>, <https://scrapbox.io/kimiyuki/Google_Apps_Script_webapps>
