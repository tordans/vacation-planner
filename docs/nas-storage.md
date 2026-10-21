# Idea: store the plan on the Synology NAS at home (DS223j)

Status: analysis, not decided, not built. Written 2026-10-21.
Compares with [central-storage-plan.md](central-storage-plan.md) (PHP + MySQL on all-inkl) and
[google-sheets-storage.md](google-sheets-storage.md) (Google Sheet via Apps Script).

## The hardware

Synology DiskStation DS223j: entry-level 2-bay NAS, ARM CPU (Realtek RTD1619B), 1 GB RAM, not
expandable, DSM 7.2. Fine for files and light web apps, tight for containers or several databases.

## What the NAS can run

| Building block                                     | On the DS223j     | Notes                                                                                                                                                                                                                          |
| -------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Web Station** (Apache/nginx + PHP)               | yes               | Synology lists PHP 8.1/8.2 back ends for current DSM; runs the same PHP code as the all-inkl plan                                                                                                                              |
| **MariaDB 10** package                             | yes               | DS223j is on Synology's list of models for MariaDB 10 (10.11)                                                                                                                                                                  |
| **Container Manager** (Docker)                     | **unclear**       | Reviews say it runs; Synology's release notes name the DS223 (without "j"); one guide says ARM "j" models are unsupported. Check in Package Center before planning on Docker. Even if it installs, 1 GB RAM leaves little room |
| **SSH**, Task Scheduler (cron), Git Server package | yes               | Unlike all-inkl, the NAS has a shell; jobs can run on a schedule                                                                                                                                                               |
| **Tailscale** package                              | yes (arm64 build) | Private access from laptops and phones; "Funnel" can publish one service to the internet without opening router ports (not confirmed for DSM ARM, test first)                                                                  |
| **Synology Office spreadsheets**                   | yes, but          | No documented public API for reading/writing cells from an app; not usable as a database                                                                                                                                       |
| **WebDAV / SMB / Synology Drive**                  | yes               | Fine for files and for agents on the local network, not as a browser-facing API (credentials, CORS)                                                                                                                            |

## How the app would use the NAS

Same API as in the all-inkl plan (`GET /api/plan` with role, `PUT` with version check, last save
wins, admin key and view key). The PHP code and SQL are identical; only hosting and deploy differ.
This portability is useful: the decision between all-inkl and NAS can be made late.

What changes on the NAS:

- **Reaching it from outside** (the grandparents are not in the home network). Options:
  - **Tailscale Funnel:** publishes one HTTPS service on a `*.ts.net` address, no router port
    forwarding, certificate included. Smallest attack surface. Needs testing on DSM ARM.
  - **Own domain/DDNS + router port forwarding + DSM reverse proxy + Let's Encrypt:** classic
    setup, well documented, but opens a port of the home NAS (with all family files on it) to the
    internet.
  - QuickConnect is for Synology's own apps; not a way to publish a custom web app.
- **Deploy from GitHub Actions:** GitHub cannot reach the NAS unless it is exposed. Two ways:
  - **Pull instead of push (recommended):** the workflow builds the app and API into a release
    archive; a DSM Task Scheduler job on the NAS checks every few minutes for a new release,
    downloads and unpacks it, runs migrations and the health check. Nothing on the NAS is opened
    for deploys.
  - **Push via Tailscale:** the workflow joins the tailnet (Tailscale GitHub Action) and uploads
    over SSH/rsync. Clean, but GitHub then holds a key that can log into the NAS.
- **Secrets:** the admin and view key hashes are still generated from GitHub secrets, shipped
  inside the release as `config.php` (or set once on the NAS and kept out of releases).

## The agent angle

Here the NAS adds something the other options do not have:

- **Full access for agents on the private network** (home Wi-Fi or Tailscale): SSH shell, the
  MariaDB server with a regular database MCP, file shares with a filesystem MCP, logs as files.
  No custom MCP endpoint needed, unlike all-inkl.
- **A place where agents can store their own data,** e.g. a `agents/` share with CSV or JSON
  files, or a separate MariaDB database per project. Readable by people too (as files, or opened
  in Synology Office / any spreadsheet app).
- **Spreadsheets:** an agent can write CSV/XLSX files to a share; people open them in Synology
  Office or Excel/Numbers. Two-way editing (people edit the sheet, the app reads it back) needs a
  file format contract and is fragile; Synology Office itself has no API for that.
- **Caveat:** "full access" also means an agent can delete or change data. Use a dedicated DSM
  user per purpose with access only to its share and database, and keep Hyper Backup snapshots.

## Comparison of all options

|                             | URL only (today)  | PHP + MySQL on all-inkl       | Apps Script + Google Sheet        | **PHP + MariaDB on the NAS**                                                                                 |
| --------------------------- | ----------------- | ----------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Shared, always current plan | no                | yes                           | yes                               | yes                                                                                                          |
| Accounts for users          | none              | none, two secret links        | none, two secret links            | none, two secret links                                                                                       |
| Where data lives            | in the link       | all-inkl, Germany             | Google Drive                      | at home                                                                                                      |
| Reachable from outside      | —                 | yes, built in                 | yes, built in                     | needs Tailscale Funnel or port forwarding                                                                    |
| Availability                | always            | hosting provider              | Google                            | home internet, power, NAS updates and restarts                                                               |
| Speed                       | instant           | fast                          | slower (script start per request) | fast on the LAN; from outside depends on home upload and Funnel relay; slow first request if the disks sleep |
| Deploy from GitHub          | GitHub Pages      | FTPS push, no SSH             | `clasp`                           | pull job on the NAS, or push via Tailscale                                                                   |
| Debugging / agent access    | browser           | own log + custom MCP endpoint | Apps Script execution log         | SSH, DB, files, standard MCP servers                                                                         |
| Backups                     | —                 | all-inkl MySQL backups        | Sheets version history            | Hyper Backup (USB/cloud)                                                                                     |
| Risk                        | lost or old links | leaked link                   | leaked link, Google account       | leaked link **plus** an internet-facing home NAS                                                             |
| Running cost                | none              | already paid                  | none                              | already owned, power                                                                                         |
| Setup effort                | done              | KAS steps once                | Google sheet + clasp login        | Web Station, MariaDB, Tailscale or router, Task Scheduler job                                                |

## UX view

- **Grandparents (view link):** identical with all three server options as long as the NAS is
  reachable. On the NAS, a slow or failing first load (sleeping disks, home connection down while
  you are on holiday) is the most likely complaint; with all-inkl or Google that does not happen.
- **Parents (edit link):** at home the NAS is the fastest option. Away from home it depends on the
  home upload and the Funnel relay; usually fine for a few KB of JSON.
- **You as maintainer:** the NAS gives the best debugging (SSH, logs, database tools) and the
  most control, but you are also the operator: DSM updates, router, power cuts, and keeping the
  exposed service safe.

## Assessment

- **As the primary store for this family app, the NAS is not better than all-inkl.** It adds an
  internet-facing service on the home NAS with the family's files on it, depends on home uptime,
  and makes deploys more involved. The data being at home is the only clear gain over all-inkl,
  and all-inkl already keeps it in Germany on your own contract.
- **It does add relevant options to the pool,** in two roles:
  1. **Private agent workspace and data store** (via Tailscale, not exposed to the internet):
     databases, CSV/JSON files and spreadsheets agents can write and people can open, with full
     SSH and database access. Useful across projects, independent of this app.
  2. **Backup and archive target:** a nightly NAS job pulls the plan from the live API (with the
     view key) and stores dated JSON copies, plus a spreadsheet export. Gives history and an
     offline copy without making the NAS public.
- **Portability:** because the PHP API is the same, moving the app from all-inkl to the NAS later
  is a hosting change, not a rewrite.

Suggested next steps if you want to use the NAS:

1. Check in Package Center whether Container Manager is offered on your DS223j (decides whether
   containers are an option at all).
2. Install Tailscale on the NAS and your laptop; give agents access to a dedicated share and a
   MariaDB database for experiments.
3. For this app: keep all-inkl as the host and add the nightly backup pull to the NAS.

## Sources

- DS223j reviews (Container Manager, DSM 7.2):
  <https://www.pcworld.com/article/2110247/synology-diskstation-ds223j-review-new-nas-same-appealing-story.html>,
  <https://www.techadvisor.com/article/2107837/synology-diskstation-ds223j-review.html>
- Container Manager release notes (ARMv8 models named, DS223):
  <https://www.synology.com/en-uk/releaseNote/ContainerManager>
- Guide claiming ARM "j" models are unsupported: <https://storagediskprices.com/synology-docker-guide/>
- MariaDB 10 package (23-series models incl. DS223j): <https://www.synology.com/en-uk/dsm/packages/MariaDB10>
- Web Station spec (PHP back ends, MariaDB): <https://www.synology.com/en-uk/dsm/7.2/software_spec/web_station>
- Tailscale Funnel: <https://tailscale.com/docs/features/tailscale-funnel>
- QuickConnect vs DDNS: <https://kb.synology.com/en-global/DSM/tutorial/What_are_the_differences_between_QuickConnect_and_DDNS>
- Reverse proxy for custom apps on DSM: <https://www.wundertech.net/synology-reverse-proxy-setup-config/>
