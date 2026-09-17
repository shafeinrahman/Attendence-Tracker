# Attendance Tracker — Full Build Specification & Implementation Prompt

Use this document as a prompt for an AI coding assistant (e.g. Claude Code) or as a spec to hand to a developer. It describes a two-part system: a **lightweight Android app** (daily driver, geofencing + status logging) and a **desktop/laptop companion app** (routine upload, parsing, config), backed by a **serverless backend hosted on Vercel** that both devices sync through, fully **Dockerized for local development** (and as a self-hostable fallback if you ever want off Vercel).

---

## 1. Project Goal

Build a personal attendance tracker that:
- Tracks attendance against **per-course-type thresholds**: 70% for theory courses, 90% for lab courses.
- Detects, via geofencing, when the user is near campus shortly before a scheduled class:
  - **On campus** → a simple "go to class" notification with the room code. No action needed.
  - **Off campus** → an actionable notification asking for status: `Running Late`, `Cancelled / Holiday`, or `I'm Skipping` (which immediately logs as Absent).
- Ingests a semester's class routine from a **grid-format PDF, Markdown table, or image** uploaded from desktop/laptop.
- Handles irregular semester structure: variable class counts, a non-graded first week, and a pausable mid-term week (dates set later).
- Defaults any class with no explicit status to **Absent** — no limbo "unmarked" state. The user can later re-mark a class as **Excused**, which removes it from the percentage math entirely, with no reason text stored.
- Purges all data **one week after** the semester's end date — and if the end date gets pushed back, the purge date moves with it.
- Keeps the phone app storage-light by pushing parsing and bulk storage to the backend; phone keeps only a thin rolling cache.
- Runs the backend/web app in Docker for local development, and optionally as a self-hosted alternative to Vercel.

---

## 2. System Architecture

| Component | Role | Platform |
|---|---|---|
| **Mobile App** | Geofencing, notifications, daily status capture, thin local cache | Android (Kotlin) |
| **Desktop Companion** | Routine upload & parsing, semester config, midterm-week config, category overrides, analytics | A web app sharing a codebase with the backend (see below) |
| **Backend** | Single source of truth: semester/course/schedule/attendance data, percentage/projection engine, purge scheduling | Next.js API routes deployed on **Vercel**, with a hosted Postgres DB (Vercel Postgres, or Neon/Supabase) |

The desktop app is just "open the site in a browser and log in" — no separate install. The phone talks to the same backend over HTTPS from anywhere with connectivity, not gated on shared Wi-Fi.

### 2.1 Data flow
1. User opens the web app, uploads the routine (PDF/MD/image); a serverless function parses it server-side (no parsing libraries bundled on either client).
2. User sets `start_date`/`end_date`, and later `midterm_week_start`/`midterm_week_end`.
3. Phone fetches the active semester's schedule on sync/launch and caches it locally for offline geofencing.
4. Phone runs geofencing + notifications offline-capable using the cached schedule; status entries queue locally if offline and push to the backend as soon as connectivity returns.
5. Backend computes attendance percentages/projections on request; desktop is the primary analytics view, phone shows a cached summary.
6. One week after `end_date` (recalculated any time `end_date` is extended), a scheduled job purges the semester's data on the backend and instructs the phone to clear its cache on next sync.

### 2.2 Auth
Single-user: a PIN/passcode or a long-lived API token stored on-device (Android Keystore) and in browser storage, checked by every API route. Don't leave the API open with no credential — it's reachable from the public internet once deployed.

---

## 3. Data Model

```
Semester
  id, name, start_date, end_date,
  midterm_week_start (nullable), midterm_week_end (nullable),
  purge_at (= end_date + 7 days, recomputed whenever end_date changes),
  purged (bool)

Course
  id, semester_id, code (e.g. "CSE331"), name,
  category ("theory" | "lab"),        -- default inferred, user-overridable
  category_source ("inferred" | "manual"),
  threshold_pct (default 70 or 90, user-overridable per course)

ClassSlot
  id, course_id, day_of_week, start_time, end_time,
  room_code (e.g. "402C", "L-201L"),
  recurring (bool), specific_date (nullable, for one-off slots),
  session_mode ("in_person" | "online"),   -- default "in_person"
  makeup_for_record_id (nullable, FK to the AttendanceRecord it makes up for)

AttendanceRecord
  id, class_slot_id, date,
  status ("present" | "running_late" | "cancelled_holiday" | "absent" | "excused"),
  counted_in_stats (bool),   -- false for first-week & midterm-week entries
  is_first_week (bool),
  is_midterm_week (bool),
  is_bulk_skip (bool),       -- true if set via "Skip Entire Day" rather than a per-class action
  logged_at (timestamp), source ("phone" | "desktop" | "default")

CampusGeofence
  id, semester_id, latitude, longitude, radius_meters

Holiday
  id, semester_id, date, label (optional, e.g. "Eid holiday", "University closure")
```

Notes:
- No `excuse_reason` field, no `unmarked`/`skipped` status — "skip" is just an immediate `absent` write, and "excused" is a plain status flip with no accompanying text.
- First-week and midterm-week records are always created and stored (log stays complete), but `counted_in_stats = false`, so the percentage engine just filters on that flag.
- A `cancelled_holiday` record is **never mutated** into something else if the class ends up moved online — instead a brand-new `ClassSlot` (`session_mode = "online"`, linked via `makeup_for_record_id`) is created for the makeup session. The original stays `cancelled_holiday` (still excluded from the denominator); the makeup gets its own normal `AttendanceRecord` that counts like any other class. See §4.9.

---

## 4. Feature Specifications

### 4.1 Semester setup
- Create a semester with `start_date`/`end_date`; set/edit `midterm_week_start`/`midterm_week_end` at any point afterward, retroactively re-flagging any records in that range as `counted_in_stats = false`.
- **Extending `end_date`** is a first-class action (e.g. a semester runs longer than planned): whenever `end_date` changes, recompute `purge_at = end_date + 7 days`. If a purge job was already scheduled, it's rescheduled — never silently keep the old purge date.
- Only one active (non-purged) semester at a time.

### 4.2 Routine ingestion & parsing
Server-side, triggered from the desktop web app upload:
1. **Markdown table** — direct row/column parse.
2. **PDF** — text-based: table-extraction library; scanned/image PDF: rasterize + OCR.
3. **Image** (JPEG/PNG/screenshot) — OCR + grid-structure inference.

Pipeline:
1. Detect grid structure (rows = time slots, columns = days, or vice versa — auto-detect via header matching against weekday/time patterns).
2. Extract cell text: expect patterns like `CSE331 402C`.
3. Regex-classify room code: **suffix `C` → theory, suffix `L` → lab**; anything else → `category = "unclassified"`, surfaced for manual tagging.
4. Review screen before committing: every parsed course, inferred category, room code, with inline override — persisted as `category_source = "manual"` so re-parsing won't clobber the correction.
5. Persist as `Course` + `ClassSlot` rows.

### 4.3 Class categorization & override
- Global default: suffix `C` → theory (70%), suffix `L` → lab (90%).
- Per-course override on both clients, stored as `category_source = "manual"`, permanent across re-imports.

### 4.4 Geofencing & notifications (phone-side)
- On sync, phone caches today's `ClassSlot`s and the semester's `CampusGeofence`.
- Single campus geofence via Android's `GeofencingClient` (battery-efficient on/off-campus signal).
- `WorkManager` fires a check 10 minutes before each of today's `ClassSlot.start_time`s:
  - **Inside geofence** → plain informational notification: *"Go to class: CSE331, Room 402C"*. Nothing to tap.
  - **Outside geofence** → actionable notification, three buttons:
    - `Running Late` → `status = "running_late"`
    - `Cancelled / Holiday` → `status = "cancelled_holiday"`
    - `I'm Skipping` → `status = "absent"`, written immediately, no intermediate "skipped" state.
  - Tapping the notification body (not a button) opens the app to the same three options, for fixing a mistaken tap.
- Use geofence `ENTER`/`EXIT`/`DWELL` transitions with a short `loiteringDelay` to avoid boundary-jitter spam.
- **Online sessions (`session_mode = "online"`) skip geofencing entirely** — there's no campus to be inside or outside of. Instead, `WorkManager` fires a plain 10-minutes-before reminder ("Online class: CSE331 — join now"), and a follow-up actionable notification around/after start time asks the same three-way status question (`Present` / `Running Late` / `Skipping`), since presence can't be inferred from location for a remote session. See §4.9 for how online sessions get created.

### 4.5 Default-absent & excusing later
- Any class with no explicit status by day's end is simply **`absent`** — set as the default at creation time server-side (e.g. a nightly job or lazily on next read), so there's no separate "unmarked" state to track or display.
- If the user later gets a valid excuse (e.g. their faculty accepts it), they flip that record's status to **`excused`** — a plain status change, no reason text stored.
- `excused` classes are **excluded from the denominator entirely** — not calculated at all, same treatment as `cancelled_holiday`.

### 4.6 Attendance calculation engine
```
attended = count(status IN ["present", "running_late"] AND counted_in_stats = true)
held     = count(status NOT IN ["cancelled_holiday", "excused"] AND counted_in_stats = true)
percentage = attended / held * 100   (0 if held = 0)
```
`running_late` counts as attended. `cancelled_holiday` and `excused` both drop out of the denominator, so neither can hurt the percentage; `absent` (whether from an explicit skip or the day's-end default) is the only status that counts against you.

Also compute, per course:
- **Safe-to-skip count**: `S = floor(A / threshold - H)`, capped at remaining slots and 0 minimum.
- **Must-attend count** to reach threshold by semester end, flagged "at risk" if not achievable given remaining slots.

### 4.7 Sync (phone ↔ backend)
- Phone pushes each `AttendanceRecord` as soon as it's created, with retry/queue-on-failure if offline.
- Phone periodically pulls updated `ClassSlot`s, midterm-week dates, category overrides, and refreshed percentage summaries.
- REST/JSON over HTTPS, token-authenticated. Desktop web app talks to the same API routes directly.

### 4.8 Purge (one week after end date, extension-aware)
- A scheduled job (Vercel Cron, or an equivalent scheduled task if self-hosted via Docker — see §9) runs daily, checking for any semester where `now >= purge_at` and `purged = false`.
- Offer an **export first** (CSV/JSON of all `AttendanceRecord`s and final percentages) — either automatically generated and emailed/stored a day before purge, or via a "your data purges in N days, export now?" prompt surfaced in the app as `purge_at` approaches.
- On purge: delete all `Course`, `ClassSlot`, `AttendanceRecord`, `CampusGeofence` rows for that semester; phone clears its cache and unregisters geofences/alarms on next sync.
- Because `purge_at` recomputes whenever `end_date` changes, extending a semester automatically defers the purge — no manual "cancel the purge" step needed.

### 4.9 Online makeup sessions for cancelled classes
A class cancelled in person sometimes ends up held online instead — that needs its own reminder and its own attendance count, without disturbing the original cancelled record.

- On any `cancelled_holiday` record, the app offers a **"Reschedule as Online"** action (available from either client). This does **not** edit the original record — it creates a brand-new `ClassSlot` for the same course:
  - `session_mode = "online"`
  - `specific_date` + `start_time`/`end_time` set to whenever the online session is actually happening (same day or a different one — faculty announcements for these tend to come with little notice, so the date/time picker should default to "later today" but allow any date)
  - `makeup_for_record_id` pointing back at the original cancelled `AttendanceRecord`, purely for traceability/history ("this makes up for the Oct 3 cancelled class")
- The new slot behaves like any other `ClassSlot` from that point on: it gets a 10-minutes-before reminder (online-mode, no geofencing — see §4.4) and produces its own `AttendanceRecord`, which **counts normally** in the percentage engine (§4.6) — it is not excluded the way the original cancelled record is.
- Net effect on your numbers: the original cancelled class costs you nothing (excluded, as always), and the online makeup either helps you (if attended) or hurts you (if missed) exactly like a normal class — which is the correct behavior, since it *is* a normal class, just remote.
- If a faculty member announces an online makeup for a class that hasn't been marked cancelled yet (e.g. they preemptively move a not-yet-held class online rather than cancelling first), the same "Reschedule as Online" action should be reachable directly from an upcoming `ClassSlot`, not only from an already-cancelled one — it simply flips `session_mode` on that slot rather than creating a linked makeup.

### 4.10 Whole-day holidays
A holiday is a **date-level flag**, not something you cancel class-by-class — one action marks the whole day, and everything downstream follows from it.

- Either client can add a `Holiday` row: pick a date (and optionally a label), for the active semester. This can be done **ahead of time** (known academic-calendar holidays entered at semester setup) or **reactively** (an unplanned closure announced same-day or the night before).
- Once a date has a `Holiday` row:
  - **Notifications are suppressed for that day** — the 10-minutes-before check (§4.4) skips any `ClassSlot` whose scheduled date falls on a holiday entirely, geofencing or not. You shouldn't get a "go to class" or a status-prompt notification for a class that isn't happening.
  - Every `ClassSlot` that would recur on that date (matched by `day_of_week`, or an explicit `specific_date` slot on that day) gets an `AttendanceRecord` with `status = "cancelled_holiday"`, created proactively rather than left to the day's-end absent-default — so a holiday never accidentally counts against you even if you forget it's a holiday.
  - This only touches the *recurring pattern's instance for that one date* — the underlying `ClassSlot` definition (used for every other week) is untouched.
- **Retroactive case**: if a holiday is only confirmed after the fact and any of that day's classes already defaulted to `absent` (§4.5) before the `Holiday` row existed, adding the `Holiday` row after the fact re-flags those already-created records from `absent` to `cancelled_holiday`, same as the retroactive re-flagging already used for midterm week (§4.1) — so a late-announced holiday still doesn't cost you anything.
- A holiday applies **institution-wide by default** (every course, every class that day) since that's what "campus is closed" means — there's no need for a per-course opt-out given the current requirements, but nothing in the model prevents scoping it more narrowly later if that turns out to be needed.

### 4.11 Skip the entire day (user-initiated, counts as absent)
Different from a holiday in one important way: this is **the user choosing not to go**, not the institution being closed — so unlike `cancelled_holiday`, it counts against attendance, exactly as if each class that day had been individually marked `absent`.

- A single **"Skip Today"** (or "Skip [date]" for a future date) action, available on the phone as a quick one-tap option and on desktop, writes `status = "absent", is_bulk_skip = true` to every remaining `ClassSlot` scheduled on that date — equivalent to tapping "I'm Skipping" on each one individually, just without having to do it class-by-class.
- Once triggered for a given date, **remaining notifications for that day are suppressed** — no more "go to class" nudges or status prompts fire for classes already covered by the bulk skip, same suppression behavior as a holiday (§4.10), just for a different reason and a different resulting status.
- `is_bulk_skip` is purely for traceability in the log/history (so you can later tell "I skipped this one class individually" apart from "this was part of a whole-day skip") — it has no effect on the percentage calculation, which treats it exactly like any other `absent` record (§4.6).
- If the day was skipped in advance (e.g. skipping tomorrow before it starts) and a holiday or an online makeup later gets added for a class on that date, the more specific/later action should win — e.g. if that date turns out to be a holiday after all, the retroactive holiday re-flagging (§4.10) should still convert those `absent` records to `cancelled_holiday`, since an institutional closure should always override a moot personal skip.

---

## 5. Non-Functional Requirements

- **Phone app footprint**: no parsing libraries on-device; phone stores only the current semester's schedule + a rolling log window; target low-tens-of-MB.
- **Battery**: `GeofencingClient` (OS-level, low-power) rather than continuous GPS polling; `WorkManager` for the 10-minutes-before checks, not a persistent foreground service.
- **Offline-tolerant**: geofencing, notifications, and status capture work with no connectivity; pushes queue and retry once online.
- **Hosting cost**: Vercel's free/hobby tier plus a free-tier Postgres provider should comfortably cover single-user data volume.

---

## 6. Suggested Tech Stack

| Layer | Suggestion |
|---|---|
| Android app | Kotlin, Jetpack Compose, `GeofencingClient` + `WorkManager`, Room (SQLite) for the thin local cache |
| Desktop / web client | Next.js (same repo as the API routes) |
| Backend | Next.js API routes / Vercel Serverless Functions |
| Scheduled purge job | Vercel Cron (or a container-based cron service if self-hosted, see §9) |
| Database | Vercel Postgres, or Neon/Supabase Postgres |
| PDF/table parsing | `pdfplumber`/`camelot`-equivalent or a Node table-extraction library, run server-side |
| OCR | Tesseract OCR, or a hosted OCR API if binary size/runtime is an issue serverless |
| Phone ↔ backend | REST/JSON over HTTPS, token-authenticated |
| Containerization | Docker + Docker Compose (see §9) |

---

## 7. Edge Cases to Handle Explicitly

- Two classes back-to-back: suppress the status prompt for class 2 if class 1 (same course) is already marked present, but still fire the plain campus-nudge notification.
- One-off schedule changes — via `ClassSlot.specific_date` overrides, without touching the recurring pattern.
- Whole-day holidays — see §4.10 for the full flow (proactive and retroactive).
- Re-uploading a corrected routine mid-semester — diff-merge against existing records rather than discarding logged `AttendanceRecord`s.
- Threshold edge rounding (e.g. exactly 70.00%) — recommend `>=`, document the choice.
- `end_date` extended *after* a purge job has already fired for the old date — since `purge_at` is recomputed from the live `end_date`, make sure extension is only possible while `purged = false`; once purged, extending is moot (the data's gone) and the UI should say so rather than silently accepting the edit.
- Marking something `excused` after it already lowered a percentage the user saw — make sure the UI clearly shows the recalculation, so it doesn't look like a bug.

---

## 8. Suggested Build Order

1. Data model + Postgres schema + Next.js API routes (CRUD for semester/course/slot/attendance).
2. Routine parser as a serverless function (Markdown table first, then PDF, then image/OCR).
3. Desktop web app: semester setup, course review/override screen, midterm-week editor, analytics view.
4. Attendance calculation engine, tested against synthetic data via the API.
5. Purge scheduling logic (`purge_at` computation + recompute-on-extend + the daily cron check).
6. Android app: local schedule cache (Room DB) + API client.
7. Android geofencing + `WorkManager` scheduled checks + informational/actionable notifications.
8. Push-on-log sync + periodic pull, with offline queueing.
9. Dockerize (§9) and verify the full stack runs identically in containers before final deploy.

---

## 9. Dockerization

Two goals: a smooth **local dev environment** (so the Next.js app + Postgres run identically for anyone working on the project) and an optional **self-hosted deployment path** if you ever want an alternative to Vercel.

### 9.1 `Dockerfile` (Next.js app)
Multi-stage build — install deps, build, then a slim runtime image:
```dockerfile
# --- deps ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- build ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- runtime ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```
(Assumes Next.js `output: "standalone"` in `next.config.js` for a minimal runtime image.)

### 9.2 `docker-compose.yml` (local dev: app + Postgres + scheduled purge worker)
```yaml
version: "3.9"
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: attendance
      POSTGRES_PASSWORD: attendance
      POSTGRES_DB: attendance_tracker
    volumes:
      - db-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  web:
    build: .
    restart: unless-stopped
    depends_on:
      - db
    environment:
      DATABASE_URL: postgres://attendance:attendance@db:5432/attendance_tracker
      API_TOKEN: ${API_TOKEN}
    ports:
      - "3000:3000"

  purge-worker:
    build: .
    restart: unless-stopped
    depends_on:
      - db
    environment:
      DATABASE_URL: postgres://attendance:attendance@db:5432/attendance_tracker
    command: ["node", "scripts/purge-cron.js"]
    # runs the same purge_at check on a loop/schedule when self-hosted,
    # replacing Vercel Cron in that deployment mode

volumes:
  db-data:
```

### 9.3 Notes
- Keep the Postgres connection string and API token in a `.env` file (git-ignored), referenced via `${VAR}` in Compose.
- For local dev, `docker compose up` should bring up the DB, run migrations (e.g. via a Prisma/Drizzle migrate step on `web` container start), and serve the app on `localhost:3000` — no separate local Postgres install needed.
- The `purge-worker` service only matters for self-hosted deployments; on Vercel, use Vercel Cron pointed at a `/api/cron/purge` route instead and this container isn't needed in production.
- Same Dockerfile can be pushed to any container host (Fly.io, Railway, a home server, etc.) if you decide to move off Vercel entirely later — the app isn't locked into Vercel-specific APIs beyond Cron, which has a documented self-hosted equivalent above.
