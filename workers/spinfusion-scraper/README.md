# spinfusion-scraper

Railway-hosted worker that logs into Spinfusion (symplr Physician Scheduling),
runs a saved MD + CRNA report covering a rolling 4-week window, parses the
exported CSV, and writes assignments to the ChiefOS Supabase project. Per
PRD §5.5.

## Architecture

```
Railway cron (5am ET daily)
        │
        ▼
   main.py ── Playwright (headless Chromium)
        │      └── login → Reports → run saved report → download CSV
        ▼
   scraper.parse_report_csv
        │      └── filter to today + DAYS_AHEAD, map Schedule → role
        ▼
   supabase_client.upsert_assignments
        │
        ▼
   spinfusion_runs row (success | partial | failed)
```

## Files

- `app/main.py` — entrypoint. One scrape + DB write + run-row.
- `app/scraper.py` — login flow, report download, CSV parser.
- `app/supabase_client.py` — service-role client + insert helpers.
- `app/inspect.py` — headed-browser dev tool: logs in, hands control to you,
  captures any downloads to `/tmp/spinfusion-*.csv` so we can record the
  Reports flow.
- `Dockerfile` — Playwright base image, installs deps, runs main.py.
- `railway.toml` — cron schedule (5am ET → 09:30 UTC).

## CSV shape

Spinfusion's report export has columns:

```
Name, Date, Schedule, Assignment, Hours
"Jones, Archana",05/01/2026,Physician - Paoli Work,pPaoli1,0
"Murphy, Donna",05/01/2026,CRNA - Paoli Work,cPaoli10,0
```

Mapping into our schema:
- `Name` → `provider_name`
- `Date` (MM/DD/YYYY) → `date` (ISO)
- `Schedule` → `role` ("Physician*" → MD, "CRNA*" → CRNA)
- `Assignment` → `assignment_text`
- `Hours` → ignored

## Local dev

```sh
cd workers/spinfusion-scraper
python -m venv .venv && source .venv/bin/activate
pip install -e .
playwright install chromium
cp .env.example .env  # fill in
```

**Test the parser without automation** by exporting a CSV manually from
Spinfusion → Reports, then pointing the scraper at it:

```sh
SPINFUSION_LOCAL_CSV=~/Downloads/spinfusion-paoli.csv \
  python -m app.main --dry-run
```

**Record the Reports flow** (for wiring `_download_report` in scraper.py):

```sh
python -m app.inspect
```

This logs you in, leaves the browser open, and saves any downloads to
`/tmp/spinfusion-<timestamp>-<filename>` so we know the actual file name
and click sequence to automate.

## Required env vars

| Name | Source |
|---|---|
| `SPINFUSION_ORG` | the organization code on the login page (e.g. `uas`) |
| `SPINFUSION_USERNAME` | your Spinfusion login |
| `SPINFUSION_PASSWORD` | password — store in Railway secrets, never log |
| `SPINFUSION_LOGIN_URL` | the login page URL |
| `SPINFUSION_REPORT_NAME` | the saved report's name in the Reports list |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role JWT |
| `CHIEFOS_VAULT_USER_ID` | UUID of the auth.users row that owns this data |
| `DAYS_AHEAD` | default 28 |
| `SITE_NAME` | default "Paoli" |
| `SPINFUSION_LOCAL_CSV` | (dev only) path to a manual CSV export |
| `ALERT_EMAIL_FROM` (optional) | email to send failure alerts from |
| `ALERT_EMAIL_TO` (optional) | where to send failure alerts |
| `RESEND_API_KEY` (optional) | if using Resend for alerts |

## Deploy

```sh
railway init        # link the project
railway link        # if already created
railway up          # deploys this directory
railway variables set SPINFUSION_USERNAME=… SPINFUSION_PASSWORD=… …
```

The cron in `railway.toml` triggers `python -m app.main` daily.

## Resilience

- Login failure 3x → exit with `status=failed`, write run row, optional email.
- Download or parse failure → write run row with `status=failed` and the
  exception message. Successful run writes one `spinfusion_runs` row with
  status + row count; the dashboard's RunBadge reads from this.
