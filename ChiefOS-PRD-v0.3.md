# ChiefOS — Product Requirements Document

**Draft v0.3** · May 15, 2026
**Owner:** Gabe Farkas, MD
**Status:** Pre-build planning. Lock before implementation begins.

### Changelog
- **v0.3** — Domain confirmed: `chiefos.agenticanesthesia.com`. Email intake address confirmed: `paolianesthesia@gmail.com`.
- **v0.2** — Auth changed to email + password (primary) with magic link backup and optional TOTP 2FA. Voice input promoted to v1 (Whisper API). Added Cost Tracker module (§5.12). Open decisions in §10 now resolved.
- **v0.1** — Initial draft.

---

## 1. Vision

ChiefOS is a personal command center for running the Paoli anesthesia department. It pulls together the operational signals a department chief needs to see daily — who is working, what's coming up, what needs deciding, what the institution's own policies say — and makes them queryable through chat.

It is **not** a replacement for hospital EHR, Spinfusion, Outlook, or any other system of record. It is a thin orchestration and intelligence layer that reads from those systems, surfaces what matters, and helps Gabe respond faster.

It is also a sibling to BoardRunner, not a successor. BoardRunner is real-time intra-day OR management; ChiefOS is multi-day departmental oversight. They share infrastructure but serve different audiences (the running OR vs. the running department).

---

## 2. Users & Primary Use Cases

### Primary user
Gabe Farkas, MD — Chief of Anesthesia, Paoli Hospital. Daily user. Operates from iPhone (morning, between cases, evening) and MacBook (deep work, scheduling, writing).

### Future users (designed for, not built for)
Other department chiefs in the group. The data model supports multi-tenant from day one, but UI and onboarding are single-user until there's a second user to design for.

### Primary daily use cases

1. **Morning briefing (5 min, mobile).** "What does today look like? Who's working? Any urgent emails? Anything decided overnight I need to act on?"
2. **End-of-day triage (10 min, desktop).** Process incoming email screenshots, clear todos, review tomorrow's roster.
3. **Ad-hoc knowledge lookup (any time).** "What's our policy on residents covering OB call?" "When did we change the post-call rule?"
4. **Schedule drafting (monthly, desktop, 1–2 hr).** Generate Paoli call schedule using FloorRunner's solver, review, edit, distribute.
5. **Meeting prep (weekly).** "What recurring meetings do I have this week? What's been on the agenda recently for the M&M committee?"

### Non-goals for v1

- Real-time OR tracking (that's BoardRunner)
- Patient-facing anything
- Group-wide compensation analytics (that's a separate workstream)
- Replacement for institutional systems

---

## 3. Compliance & Safety Posture

This section exists so the design choices around PHI are explicit and defensible.

### Guiding principle
**Hospital email and hospital systems stay on the hospital side.** ChiefOS never receives the contents of `@mlhs.org` (or equivalent) inboxes via automated forwarding, never holds hospital credentials beyond what's needed for the Spinfusion scraper, and never stores patient-identifying information.

### What ChiefOS may contain
- Staff schedules (not PHI — provider names and assignments only)
- Departmental policies, guidelines, workflow documentation
- Meeting minutes, agendas (provided they don't contain patient identifiers; if they do, those notes go into hospital systems, not here)
- Gabe's todos, calendar, contacts
- Emails Gabe **manually forwards** to the dedicated intake address
- Generated drafts and summaries derived from the above

### What ChiefOS may NOT contain
- Patient names, MRNs, DOBs, or any other PHI
- Hospital email contents arriving via auto-forward rule
- Anything from hospital Outlook other than what Gabe deliberately sends to the intake mailbox
- Compensation data, attorney correspondence, or other sensitive non-PHI data Gabe wants kept separate

### Email intake model
A dedicated Gmail account — **`paolianesthesia@gmail.com`** — serves as the single channel into the system. Gabe forwards selected emails to it manually or via narrow Outlook rules he controls. He may also send screenshots from his phone. The friction of manual forwarding is a feature: it forces triage at the source and guarantees PHI doesn't leak by default.

### Credentials and secrets
- Spinfusion credentials live in Railway secrets, encrypted at rest, accessed only by the scraper container.
- Gmail OAuth tokens live in Supabase, encrypted with row-level security.
- No credentials are ever logged or sent to model APIs.

### Model provider posture
- Anthropic API for chat and reasoning (zero data retention enabled).
- OpenAI for embeddings (cheap, fast; PHI-free input by construction).
- No training-data opt-ins anywhere.

### Audit and review
- All scraper runs, email ingestions, and AI calls log to a `system_events` table.
- A monthly self-audit script flags anything suspicious (unusual data volume, unexpected senders in the intake mailbox, scraper failures).

---

## 4. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    User (iPhone + MacBook)                        │
└──────────────┬───────────────────────────────────┬───────────────┘
               │                                   │
               ▼                                   ▼
    ┌──────────────────────┐          ┌──────────────────────┐
    │   ChiefOS Frontend   │          │  Personal Dashboard  │
    │   (Next.js 14 PWA)   │  ◀────▶  │  (existing project)  │
    │   on Vercel          │  cross-  │                      │
    └──────────┬───────────┘  link    └──────────────────────┘
               │
               ▼
    ┌──────────────────────────────────────────────────────────────┐
    │                      Supabase                                 │
    │  • Postgres (todos, meetings, assignments, email cache, etc.)│
    │  • pgvector (note embeddings for RAG)                        │
    │  • Auth (magic link, single user)                            │
    │  • Storage (screenshot uploads)                              │
    │  • Edge Functions (lightweight serverless)                   │
    └──────────────────────────────────────────────────────────────┘
               ▲                  ▲                  ▲
               │                  │                  │
    ┌──────────┴──────┐ ┌─────────┴─────────┐ ┌─────┴──────────────┐
    │  Railway Cron   │ │ Railway Worker    │ │  FloorRunner       │
    │  Spinfusion     │ │ Email Processor   │ │  Internal API      │
    │  Scraper        │ │ (Gmail watcher)   │ │  (call schedule    │
    │  (Playwright)   │ │                   │ │   generator)       │
    └─────────────────┘ └─────┬─────────────┘ └────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Anthropic API      │
                    │  OpenAI Embeddings  │
                    │  Google Calendar    │
                    └─────────────────────┘
```

### Why this shape

- **Next.js + Supabase + Vercel** is your existing stack; no new platforms to learn.
- **Railway** hosts the long-running and scheduled jobs that don't fit Vercel's serverless model — specifically the headless browser scraper and the Gmail polling worker.
- **pgvector inside Supabase** for embeddings avoids running a separate vector database. Cheaper, simpler, and at your scale (a few thousand notes max) it's plenty fast.
- **FloorRunner stays a separate app.** ChiefOS calls it over HTTP for call schedule generation rather than duplicating the OR-Tools solver.

---

## 5. Feature Modules

### 5.1 Dashboard Shell & Navigation

**What it is:** the home screen and the layout that wraps every other module.

**Layout:**
- **Top bar:** date, weather, ChiefOS / Personal toggle, profile menu.
- **Body:** card grid, drag-to-rearrange (matches your personal dashboard pattern). Cards collapsible.
- **Bottom nav (mobile only):** Home, Vault, Chat, Inbox, More.

**Default cards on home:**
1. Today + Tomorrow Assignments (Spinfusion)
2. Todos (top 5)
3. Upcoming Meetings (next 7 days)
4. Inbox Summary (last 24 hr of intake mail)
5. Quick Capture (text, **voice**, or photo → Inbox)
6. Quick Ask (one-shot question to the brain)
7. **Cost Tracker (current month spend + projected end-of-month)**

**Behavior:**
- Card order persists per user in `user_layout` table.
- Cards lazy-load and show skeletons until data arrives.
- Mobile: cards stack single-column; desktop: 2- or 3-column responsive grid.

**Tech notes:** shadcn/ui, Tailwind, framer-motion for drag-rearrange. Mark as PWA from day one so it installs cleanly on iPhone home screen.

---

### 5.2 To-Do List

**What it is:** a flat list of action items with priority, due date, and source.

**Sources of todos:**
- Manual entry (`+` button, voice on mobile)
- AI-suggested from email processing ("This email asks you to sign the contract by Friday — add as todo?")
- AI-suggested from meeting prep ("M&M is Tuesday, you haven't reviewed cases yet")
- Recurring (weekly chief duties)

**Fields:**
- `title`, `notes` (markdown)
- `priority` (low / med / high)
- `due_at` (optional)
- `source` (manual / email / meeting / recurring / suggested)
- `source_ref` (link back to the email or note that generated it)
- `status` (open / done / snoozed / dropped)
- `completed_at`

**Behavior:**
- Top 5 by priority + due date show on home card.
- Full list view at `/todos` with filters.
- AI suggestions appear as "pending" until accepted or rejected, with one-tap accept/reject.
- Completed items archive after 30 days but stay searchable.

**Data model:** `todos` table. Standard CRUD.

---

### 5.3 Recurring Meetings & Reminders

**What it is:** a schedule of all the meetings the chief role obligates Gabe to attend, with reminders and pre-meeting prep.

**Examples:**
- Weekly: OR committee, anesthesia leadership huddle
- Monthly: M&M, department meeting, hospital MEC
- Quarterly: board reports, contract reviews

**Fields:**
- `name`, `cadence` (RRULE-style: every Tuesday 7am, first Monday of month, etc.)
- `location` (room / Zoom URL)
- `attendees` (text list)
- `prep_template` (markdown — what to review before this meeting)
- `linked_note` (path into the vault for the recurring agenda)

**Behavior:**
- Card on home shows next 7 days' meetings.
- 24-hr reminder triggers a todo with the prep template prefilled.
- Each instance can have notes captured in the vault, linked back to the recurring meeting.

**Data model:** `recurring_meetings` + `meeting_instances` tables.

**Open question:** sync with Google Calendar (one-way ChiefOS → Cal) or treat as separate? Recommendation: one-way sync so the meetings show up in Cal but ChiefOS owns the canonical record.

---

### 5.4 Document Vault & RAG Chat

**What it is:** Gabe's institutional knowledge — policies, guidelines, the Paoli Anesthesia Daily workflow, staff rosters, decision logs — stored as markdown, kept in Obsidian, searchable in chat.

**How notes get in:**
1. Gabe writes them in Obsidian on his Mac.
2. The Obsidian Git plugin (community plugin, free) auto-commits the vault to a private GitHub repo every N minutes.
3. A GitHub webhook hits a ChiefOS endpoint on every push.
4. ChiefOS pulls changed files, chunks them, generates embeddings (OpenAI `text-embedding-3-small`), writes to `note_chunks` table with pgvector.

**How chat works:**
1. Gabe asks a question (text or voice).
2. ChiefOS embeds the question, runs vector search over `note_chunks`, retrieves top-k chunks (k=8 default).
3. Retrieved chunks + question go to Claude with a system prompt that says: "Answer only from these notes. Cite by filename. If the notes don't answer, say so."
4. Response renders with inline citations linking back to the source `.md` files (which open in Obsidian via `obsidian://` URI scheme on Mac, or as raw markdown on mobile).

**Vault structure (initial):**
```
/vault
  /00-meta             Notes about the vault itself
  /10-policies         Hospital and group policies
  /20-workflows        Daily Paoli workflow, handoff procedures
  /30-staff            Rosters, contact info, scope of practice
  /40-meetings         Recurring meeting agendas + minutes
  /50-decisions        Decision log (what was decided, when, why)
  /60-projects         Active initiatives (e.g., new EHR rollout)
  /99-archive          Old/superseded notes
```

**Chunking strategy:** 500 tokens per chunk, 100 token overlap. Whole-file embedding for short files (<500 tokens).

**Quality bar:** for v1, "answers questions correctly from a 50-document vault on first try, with correct citations, 90%+ of the time." Tested against a hand-written eval set Gabe builds during phase 2.

---

### 5.5 Spinfusion Integration

**What it is:** automated daily pull of MD and CRNA assignments for today and the next 7 days from Spinfusion, displayed on the dashboard.

**Approach:**
1. **First, ask Spinfusion.** Send one email asking if they offer a customer API. Cost: zero. If yes, skip to step 3 with API instead of scraping.
2. **Otherwise, browser automation.** A Playwright script runs in a Railway container on a daily cron (5am Eastern).
3. Logs in with Gabe's credentials (stored in Railway secrets), navigates to the schedule view, scrapes today + 7 days forward, parses into structured rows.
4. Writes to `spinfusion_assignments` table: one row per (date, provider, role, site, assignment_text).
5. Diff against previous day's pull — flag any changes that happened since yesterday.

**Resilience:**
- If login fails 3x, alert Gabe by email (don't retry indefinitely; could lock the account).
- If parsing fails, save raw HTML to storage for debugging and fall back to "couldn't refresh today, last good data was [time]."
- Manual "refresh now" button on the home card.

**Display on home card:**
- Today: simple two-column list, MDs left, CRNAs right.
- Tomorrow: collapsed by default, expandable.
- Color-coded by site if Gabe ever wants multi-site (deferred).
- Asterisk notation and any other Paoli-specific markings preserved verbatim (per your earlier schedule analysis).

**Failure modes to design for:**
- Spinfusion redesigns the page → scraper breaks. Mitigation: clear error messaging, monthly manual test, low-stakes (it's read-only and one user).
- Spinfusion adds CAPTCHA or MFA → bigger problem. Mitigation: revisit API ask, or consider browser extension architecture where the user's own logged-in browser does the pull.

---

### 5.6 Email Intake

**What it is:** the dedicated Gmail mailbox (`paolianesthesia@gmail.com`) where Gabe forwards selected emails for processing.

**Setup (one-time):**
- Gmail account `paolianesthesia@gmail.com` created by Gabe.
- Authorize ChiefOS via OAuth (Gmail API, read + label scope; no send from this account).
- Set up Gmail watch (push notifications) → Cloud Pub/Sub → ChiefOS webhook. (Or polling every 5 min if push proves fragile.)

**Processing each new message:**
1. Fetch full message + attachments.
2. Run through Claude with a structured-output prompt: extract `summary`, `sender_role` (vendor / hospital admin / colleague / etc.), `intent`, `requested_actions[]`, `dates_mentioned[]`, `draft_reply` (if a reply seems warranted).
3. If any `dates_mentioned[]` look like meeting invitations or deadlines, propose a calendar event (see 5.8).
4. If any `requested_actions[]` look like todos, propose a todo (see 5.2).
5. Write everything to `email_intake` table; tag the Gmail message with a "processed" label.

**Display:**
- Inbox card on home: count of unprocessed + unread, last 5 summaries.
- `/inbox` route: full list with filters.
- Each item: summary, original message viewable, draft reply (if any) editable + copy-to-clipboard. (No automatic sending in v1.)

**Drafts that never auto-send.** Gabe always copies the draft into his real reply environment.

---

### 5.7 Screenshot & Forward Analysis

**What it is:** the catch-all "send to brain" channel for things that aren't email.

**Inputs:**
- iPhone share sheet → "ChiefOS" → uploads to ChiefOS storage.
- Email forwarded to intake mailbox with attachments.
- Quick Capture card on home: drag/drop or paste.

**Processing:**
- Image → Claude (vision) → extract text, identify document type (meeting invite / contract / policy update / case detail / other), suggest action.
- PDF → text extraction → Claude → same as above.
- Output: a row in `captures` table with original file, extracted text, classification, suggested actions.

**Suggested action types:**
- Add to calendar (proposes event details, user confirms)
- Add to todo
- File into vault (proposes path and filename)
- Add to decision log
- Discard

---

### 5.8 Calendar Integration

**What it is:** read + write to Gabe's Google Calendar.

**Reads:**
- Show today + tomorrow's events on the home card alongside Spinfusion assignments.
- Pull events for conflict detection with personal dashboard.

**Writes:**
- Auto-create events from email-extracted invites (after Gabe confirms).
- Sync recurring meetings (see 5.3).
- Create reminder events for todo due dates.

**Scope:** Google Calendar API with `calendar.events` scope only.

**Open question:** which Google account? If Gabe wants ChiefOS events on the same calendar his Skylight reads, that's the personal Google account already in use for the family dashboard. Recommendation: yes, single source of truth, simplifies conflict detection later.

---

### 5.9 FloorRunner Integration (Call Schedule Generator)

**What it is:** ChiefOS triggers FloorRunner's call schedule solver and displays the result.

**Mechanism:**
1. FloorRunner exposes a new internal endpoint: `POST /api/internal/schedule/generate`. Auth via shared bearer token (stored in Vercel env vars on both sides).
2. ChiefOS posts: `{ site: "Paoli", month: "2026-07", constraints: {...} }`.
3. FloorRunner runs the OR-Tools CP-SAT solver, returns the proposed schedule as structured JSON.
4. ChiefOS renders an editable grid view. Gabe edits, locks, exports as PDF or copy-to-Spinfusion-clipboard.

**Why an API rather than embedding the solver:** the solver lives in Python and needs to evolve as Gabe refines scheduling rules. Keeping it in FloorRunner means one source of truth.

**Out of scope for v1:** automated push of finalized schedule into Spinfusion. Manual copy/paste is fine to start.

---

### 5.10 Personal Dashboard Bridge

**What it is:** the eventual link between ChiefOS and the existing personal life dashboard PWA.

**Phase A (cosmetic):** a "Personal" tab in ChiefOS top bar that opens the personal dashboard. No data exchange.

**Phase B (conflict detection):** both apps expose `GET /api/internal/calendar/events?from=X&to=Y` returning normalized event lists. A nightly job in ChiefOS pulls both, runs simple conflict detection (overlapping time blocks), surfaces conflicts as todos.

**Phase C (deferred):** shared todos, unified inbox, etc. Decide later — likely unnecessary if both apps stay focused.

**Note:** the personal dashboard project is currently paused before Phase 1 per your existing PRD. This module unblocks once that project resumes. ChiefOS doesn't need to wait on it; we just need the contract documented.

---

### 5.11 Voice Input (Mobile)

**What it is:** press-and-hold microphone button on Quick Capture, Chat, and todo creation that transcribes speech to text via Whisper.

**Why Whisper rather than the browser's built-in speech recognition:**
- **Medical terminology accuracy.** Web Speech API mangles "sevoflurane," "propofol," "Mepivacaine," provider last names, and Spinfusion-style abbreviations. Whisper handles them cleanly.
- **Cost is trivial.** $0.006 per minute. Thirty minutes of voice capture in a day is 18¢.
- **Consistency.** Works the same way on every iOS version. Web Speech behaves differently across Safari releases.

**UX:**
- Mic icon on the relevant input.
- Press-and-hold to record; release to send. Tap to toggle for long captures.
- Live waveform during recording so you know it's listening.
- Audio uploads, Whisper transcribes, text populates the input field.
- You can review and edit before submitting.
- If transcription fails (bad signal, no audio), the recording is kept and an error shown so you can retry without re-recording.

**Tech:**
- Frontend: `MediaRecorder` API captures WebM/Opus audio.
- Backend: Next.js API route receives the audio blob, forwards to OpenAI Whisper, returns text.
- Audio files deleted from storage after successful transcription. (We don't need to retain the raw audio.)

**Where voice appears in v1:**
- Quick Capture card (primary)
- Chat input ("Ask the brain")
- Todo creation modal

**Deferred:**
- Background dictation while another app is open
- Voice output (text-to-speech)
- Wake-word activation
- Real-time streaming transcription (current implementation is record → send → receive)

---

### 5.12 Cost Tracker

**What it is:** a home card and detail page that show what running ChiefOS costs each month, in real time.

**What gets tracked:**

| Source | Mechanism | Variability |
|---|---|---|
| Anthropic API | Logged per call to `usage_events` | Variable |
| OpenAI embeddings | Logged per call to `usage_events` | Variable, small |
| OpenAI Whisper | Logged per call to `usage_events` | Variable, small |
| Supabase | Fixed entry in `fixed_costs` (~$25) | Fixed |
| Vercel | Fixed entry in `fixed_costs` ($0–20) | Fixed |
| Railway | Fixed entry in `fixed_costs` (~$10–20) | Fixed |
| Domain | Annual ÷ 12 in `fixed_costs` | Fixed |

**How variable costs are captured:**
- Every Anthropic and OpenAI call goes through a thin wrapper function that records `provider`, `model`, `operation`, `input_tokens`, `output_tokens`, and computed `cost_usd` to the `usage_events` table.
- Cost is calculated from a pricing config file (one line per model). When providers change prices, you update one file.
- No polling of external billing APIs — the wrapper records as it happens, so the dashboard is always current to the second.

**Home card:**
- Big number: this month's spend so far (variable + pro-rated fixed).
- Sub-line: "Projected end of month: $XX.XX" (based on daily run rate).
- Last month for comparison: "Last month: $XX.XX."
- Color: green / yellow / red against your monthly cap.
- One-tap link to detail view.

**Detail view (`/costs`):**
- 30-day daily spend bar chart.
- Breakdown by category (Anthropic / OpenAI / fixed).
- Top 10 most expensive operations this month — helps spot a runaway feature.
- Editable list of fixed-cost entries (so when Vercel goes from Hobby to Pro you update one row).

**Alert thresholds (configurable in settings):**
- **Soft alert** on home card when monthly variable spend exceeds threshold (default $40).
- **Hard alert** by email when daily variable spend exceeds threshold (default $5).
- Catches runaway loops before they bill three figures.

**Why this matters:** the entire reason to run your own dashboard rather than pay for a SaaS tool is cost control plus data ownership. If ChiefOS quietly costs $200/month, the math stops working. Visible cost forces an honest reckoning every time you open the app — and gives you the numbers if anyone (an accountant, a curious partner, future-you) asks what this thing actually costs.

---

## 6. Data Model (Supabase Schema)

```sql
-- core
users                      -- Supabase auth
user_layout                -- card order per user

-- knowledge
note_files                 -- one row per .md file in vault
  (path, content_hash, updated_at)
note_chunks                -- chunked + embedded for RAG
  (file_id, chunk_index, content, embedding vector(1536), token_count)

-- operational
todos
  (id, user_id, title, notes, priority, due_at, source,
   source_ref, status, created_at, completed_at)
recurring_meetings
  (id, user_id, name, rrule, location, prep_template_md)
meeting_instances
  (id, recurring_meeting_id, scheduled_at, notes_ref)

-- integrations
spinfusion_assignments
  (date, provider_name, role, site, assignment_raw,
   pulled_at, source_html_ref)
email_intake
  (id, gmail_message_id, received_at, sender, subject,
   summary, intent, requested_actions jsonb, draft_reply,
   processed_at)
captures
  (id, kind, original_file_ref, extracted_text,
   classification, suggested_actions jsonb, created_at)
calendar_events_cache
  (google_event_id, start_at, end_at, summary, source)

-- audit + cost
system_events
  (id, event_type, payload jsonb, occurred_at)
usage_events
  (id, provider, model, operation, input_tokens, output_tokens,
   cost_usd, occurred_at)
fixed_costs
  (id, service, monthly_usd, active, notes)
```

All tables use `user_id` foreign key and row-level security policies that restrict to `auth.uid()`.

---

## 7. Authentication & Access Control

- **Single user (you) for v1.** Supabase Auth with two methods enabled: **email + password (primary)** and **magic link (backup)**.
- **Optional TOTP 2FA** at signup, using Google Authenticator or 1Password. Strongly recommended; takes two minutes to set up.
- **Password requirements:** minimum 12 characters, checked against the haveibeenpwned breach list (Supabase supports this natively).
- **Rate limiting on login** to prevent brute force (Supabase default + custom edge function if needed).
- **RLS on every table.** Even with one user, this prevents future leakage when a second user is added.
- **No third-party SSO.** You don't want your hospital identity tied to this app.
- **Mobile session length:** 30 days. Desktop: 7 days. Re-auth on suspicious activity (Supabase handles).

---

## 8. Deployment & Infrastructure

| Component | Host | Cost (monthly est.) |
|---|---|---|
| Frontend | Vercel (Hobby or Pro) | $0–20 |
| Database + Auth + Storage | Supabase (Pro) | $25 |
| Spinfusion scraper | Railway | $5–10 |
| Email worker | Railway | $5–10 |
| Anthropic API | usage-based | $20–50 |
| OpenAI embeddings | usage-based | $1–5 |
| Domain | already owned | — |
| **Total** |  | **~$60–120/mo** |

**Deployment flow:**
- Frontend: push to `main` → Vercel auto-deploys.
- Workers: push to `main` → Railway auto-deploys.
- Database migrations: Supabase CLI, committed to repo, run on merge to main.

**Domain & DNS:**
- Production URL: `https://chiefos.agenticanesthesia.com`
- One-time DNS setup: add a CNAME record at the registrar for `agenticanesthesia.com` pointing `chiefos` → `cname.vercel-dns.com`.
- TLS certificate handled automatically by Vercel.
- Other anesthesia software (BoardRunner, Atlas) can later use sibling subdomains under the same root without conflict.

**Environments:**
- Local dev (`.env.local`)
- Production only — no separate staging in v1 (cost not justified for single-user app).

---

## 9. Phased Roadmap

Each phase ends with a working, deployed system. No phase requires the next to be useful.

### Phase 1 — Shell + Todos + Meetings + Voice + Cost Tracker (target: 1–2 weeks)
- Next.js project scaffolded, Tailwind + shadcn/ui set up, PWA config
- Supabase project created, password + magic link auth working, optional TOTP 2FA, RLS policies in place
- `todos`, `recurring_meetings`, `meeting_instances`, `user_layout`, `usage_events`, `fixed_costs` tables
- Cost-logging middleware wrapping all Anthropic + OpenAI calls (starts logging from day one)
- Voice input on Quick Capture: press-and-hold mic, Whisper transcription
- Home dashboard with four cards (Todos, Meetings, Quick Capture w/ voice, Cost Tracker)
- Deployed to Vercel under custom domain
- Installable on iPhone home screen

**Success criteria:** you use it for a week on both phone and laptop, capture at least 20 todos (some via voice), and the Cost Tracker card shows actual monthly burn with daily breakdown.

### Phase 2 — Document Vault + RAG Chat (target: 1–2 weeks)
- Obsidian vault created with initial folder structure
- GitHub repo + Obsidian Git plugin configured
- Webhook handler + ingestion pipeline (chunk + embed → pgvector)
- Chat UI at `/chat`
- 10–20 seed documents written by you (policies, daily workflow, staff roster)
- Eval set of 15–20 questions you write, with expected answers

**Success criteria:** you can ask "what's our policy on X" and get a correct answer with a citation, for at least 90% of your eval set.

### Phase 3 — Spinfusion Scraper (target: 1 week)
- Email sent to Spinfusion support asking about API
- Playwright scraper deployed to Railway
- `spinfusion_assignments` table + home card
- Failure alerts wired up

**Success criteria:** each morning, the Today + Tomorrow card shows correct assignments without you doing anything. One full week of clean daily pulls.

### Phase 4 — Email Intake (target: 1–2 weeks)
- Gmail account set up + OAuth flow
- Pub/Sub or polling watcher running on Railway
- Processing pipeline (extract → classify → suggest)
- Inbox card on home + `/inbox` route
- 50+ real emails processed; quality reviewed

**Success criteria:** for emails you forward, summaries are accurate and draft replies are usable as a starting point at least 80% of the time.

### Phase 5 — Captures + Calendar (target: 1 week)
- Screenshot/forward capture pipeline
- Google Calendar integration (read + write)
- Auto-create-from-email flow

**Success criteria:** a forwarded Zoom invite ends up on your calendar within 5 minutes of forwarding, after one confirm tap.

### Phase 6 — FloorRunner Integration (target: 1 week)
- Internal API endpoint on FloorRunner side
- Schedule generation UI on ChiefOS side
- Edit + export flow

**Success criteria:** you draft the next month's call schedule end-to-end inside ChiefOS, in under 30 minutes, without touching FloorRunner directly.

### Phase 7 — Personal Dashboard Bridge (target: deferred)
- Resumes when personal dashboard Phase 1 ships.

---

## 10. Decisions (resolved v0.2)

| # | Question | Resolution |
|---|---|---|
| 1 | Domain name for ChiefOS | **`chiefos.agenticanesthesia.com`** (subdomain of Gabe-owned `agenticanesthesia.com`) |
| 2 | Initial vault folder structure | Approved: `/00-meta`, `/10-policies`, etc. as drafted in §5.4 |
| 3 | Which Google account for Calendar | Personal (same one Skylight reads) |
| 4 | Voice input on mobile | **Yes, in v1.** Whisper API, press-to-talk on Quick Capture / Chat / Todos |
| 5 | Notifications: push / email / none | Email only in v1; push later |
| 6 | ChiefOS hold compensation or contract data | Out of scope; separate workstream |
| 7 | Pilot with other chiefs | Solo for now; data model is multi-tenant ready but no UI for it |
| 8 | **Auth method** | **Email + password primary, magic link backup, optional TOTP 2FA** |
| 9 | **Cost tracker on dashboard** | **Yes, in v1.** See §5.12 |

---

## 11. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Spinfusion changes UI, breaks scraper | High | Medium | Monitor with failure alerts; treat as expected maintenance |
| Spinfusion adds MFA | Medium | High | Switch to browser-extension architecture if needed |
| Hospital IT notices and questions external integrations | Medium | Medium | Compliance posture (§3) documented; only intake mailbox is novel and that's a personal Gmail receiving manual forwards |
| RAG returns wrong/hallucinated policy info, you act on it | Low | Very High | Citations on every answer; treat ChiefOS answers as drafts, not authority; eval set guards quality |
| Costs spiral (API usage) | Low | Low | Monthly cost cap on API providers; weekly cost review for first month |
| You stop using it | Medium | Medium | Phase 1 has to be useful within a week — that's the test of whether this is the right shape |
| Scope creep into BoardRunner territory | Medium | Medium | Section 1 vision statement; review every feature against "department oversight vs. intra-day OR ops" |

---

## 12. Out of Scope (v1)

Explicit list so we don't drift:

- Patient-facing features of any kind
- Direct EHR integration
- Group-wide analytics (workload equity, compensation) — that's the existing analytics workstream
- BoardRunner-style real-time OR board
- Atlas-style marketplace features
- Multi-user collaboration / shared vaults
- Mobile-native app (PWA only)
- Spanish/multilingual support
- Automated reply sending (drafts only)
- Voice output (text-to-speech)
- Push notifications
- Native macOS app

---

## 13. Glossary (for non-technical reference)

- **RAG (Retrieval-Augmented Generation):** AI answers questions by first searching your notes for relevant chunks, then using those chunks (with citations) to compose the answer. Prevents the model from making things up about your policies.
- **Embedding:** a numeric representation of a piece of text. Lets you find "similar" text by comparing numbers. Used for vault search.
- **pgvector:** Postgres extension that stores embeddings and does similarity search. Means we don't need a separate "vector database."
- **Playwright:** a tool that drives a real browser from a script. Used to log into Spinfusion and read the schedule.
- **Cron job:** a scheduled script. "Run this every day at 5am."
- **Webhook:** a URL that gets pinged when something happens elsewhere (e.g., GitHub pings ChiefOS when you push new notes).
- **OAuth:** the "Sign in with Google" flow. You authorize ChiefOS to read your Gmail once; we store a refresh token; we never see your password.
- **RLS (Row-Level Security):** Postgres feature that enforces "users can only see their own rows" at the database layer. Prevents a bug in app code from leaking data across users.
- **PWA (Progressive Web App):** a website that installs to your home screen and behaves like an app. No App Store required.
- **CP-SAT:** the constraint solver inside Google OR-Tools that FloorRunner uses to generate call schedules.
- **Whisper:** OpenAI's speech-to-text model. Cheap (~$0.006/minute), excellent with medical terminology. Used for voice capture on mobile.
- **TOTP (Time-based One-Time Password):** the rotating 6-digit codes from Google Authenticator or 1Password used for 2FA.
- **MediaRecorder API:** the browser feature that lets a web page record audio from the device microphone. Built into every modern browser including iOS Safari.

---

## Appendix A — File layout suggestion

When this gets implemented, suggested repo structure (matches your Atlas convention):

```
chiefos/
  app/                       Next.js App Router
  components/
  lib/
  docs/
    prd/
      00-overview.md         (this doc, split)
      01-vision.md
      02-users.md
      03-compliance.md
      04-architecture.md
      05-modules/
      06-data-model.md
      ...
    decisions/               ADRs as you make them
    runbooks/                operational docs
  supabase/
    migrations/
  workers/
    spinfusion-scraper/      Python + Playwright
    email-processor/         Python or TS
  scripts/
```

---

## Appendix B — What a Phase 1 ticket list looks like

For preview only; we'd flesh out properly when Phase 1 actually starts.

1. Initialize Next.js 14 project with TypeScript, Tailwind, App Router
2. Install + configure shadcn/ui base components
3. Set up Supabase project, link to local repo with CLI
4. Password + magic link auth flow + protected routes
5. Optional TOTP 2FA enrollment screen
6. PWA manifest + service worker
7. `todos` migration + RLS policies
8. `recurring_meetings` + `meeting_instances` migrations
9. `user_layout`, `usage_events`, `fixed_costs` migrations
10. Cost-logging wrapper for Anthropic + OpenAI clients (logs every call to `usage_events`)
11. Pricing config file (one entry per model: Claude Sonnet, Claude Opus, embeddings, Whisper)
12. Todo CRUD UI (list, create, edit, complete, snooze)
13. Recurring meeting CRUD UI
14. Quick Capture card — text input first
15. Voice input on Quick Capture: MediaRecorder, upload endpoint, Whisper transcription, populate field
16. Cost Tracker card: aggregate usage_events + fixed_costs, render current month + projection + last-month comparison
17. Cost Tracker detail page (`/costs`): 30-day chart, breakdown, top expensive operations, fixed-cost editor
18. Alert thresholds + email-on-overage worker
19. Home dashboard layout with four cards
20. Drag-to-reorder cards (framer-motion)
21. Mobile bottom nav
22. Deploy to Vercel + connect `chiefos.agenticanesthesia.com` (CNAME at registrar)
23. iPhone install + smoke test
