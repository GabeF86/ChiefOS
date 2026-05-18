# spinfusion-scraper

Railway-hosted worker that logs into Spinfusion, scrapes the next ~7 days of
MD + CRNA assignments, and writes them to the ChiefOS Supabase project.
Per PRD §5.5.

## Architecture

```
Railway cron (5am ET daily)
        │
        ▼
   main.py ── Playwright (headless Chromium)
        │      └── login → schedule view → parse rows
        ▼
   supabase_client.py (service role)
        │      └── insert into spinfusion_assignments
        ▼
   spinfusion_runs row (success | partial | failed)
```

## Files

- `app/main.py` — entrypoint. Wraps a single scrape run + DB write + run-row.
- `app/scraper.py` — Playwright login + parse. **Selectors are placeholders**;
  fill them in after recording a session against the real Spinfusion UI.
- `app/supabase_client.py` — service-role client + insert helpers.
- `Dockerfile` — Playwright base image, installs deps, runs main.py.
- `railway.toml` — cron schedule (5am ET → 09:00 UTC outside DST, 10:00 UTC during).

## Local dev

```sh
cd workers/spinfusion-scraper
python -m venv .venv && source .venv/bin/activate
pip install -e .
playwright install chromium
cp .env.example .env  # fill in
python -m app.main --dry-run
```

`--dry-run` parses but does not write to Supabase, and prints the parsed rows
as JSON. Use this when iterating on selectors.

## Required env vars

| Name | Source |
|---|---|
| `SPINFUSION_USERNAME` | the chief's Spinfusion login |
| `SPINFUSION_PASSWORD` | password — store in Railway secrets, never log |
| `SPINFUSION_LOGIN_URL` | the login page URL |
| `SPINFUSION_SCHEDULE_URL` | the schedule view URL (post-login) |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role JWT |
| `CHIEFOS_VAULT_USER_ID` | UUID of the auth.users row that owns this data |
| `DAYS_AHEAD` | default 7 |
| `SITE_NAME` | default "Paoli" |
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
- Parse failure → save raw HTML to `/tmp/spinfusion-last.html` and exit
  `status=partial`.
- Successful run writes one `spinfusion_runs` row with status + row count;
  dashboard's RunBadge reads from this.
