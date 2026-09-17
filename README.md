# Attendance Tracker

A personal, dual-client attendance tracker engineered against strict course thresholds (70% for theory courses, 90% for lab courses). Combines a **native Android app** (daily driver, geofencing + actionable notifications) and a **desktop companion web app** (routine ingestion, semester configuration, midterm week pausing, and projections), syncing through a unified **Next.js serverless backend** with a PostgreSQL database.

---

## Architecture Overview

```
├── web/                     # Next.js 14 Desktop Companion & REST API
│   ├── app/                 # Next.js App Router (UI & API endpoints)
│   │   ├── api/             # API routes: auth, semesters, courses, slots, attendance, holidays, analytics, sync, purge
│   │   ├── layout.tsx       # Root layout & dark theme
│   │   └── page.tsx         # Dashboard page (Today, Analytics, Routine, Config)
│   ├── components/          # React UI components (Navbar, TodayClasses, Analytics, RoutineUploader, etc.)
│   ├── lib/                 # Core engine modules
│   │   ├── attendance-calculator.ts  # Attendance math, safe-to-skip, must-attend, at-risk flags
│   │   ├── auth.ts                   # Token/PIN authentication helpers
│   │   ├── prisma.ts                 # Database client singleton
│   │   └── parser/                   # Markdown table, PDF, and OCR routine parsers + room classifier
│   ├── prisma/              # PostgreSQL schema & migrations
│   ├── scripts/             # Seed scripts & standalone purge cron worker
│   └── Dockerfile           # Multi-stage standalone production build
│
├── android/                 # Native Android daily driver app
│   ├── app/src/main/
│   │   ├── AndroidManifest.xml
│   │   └── java/com/attendance/tracker/
│   │       ├── AttendanceApp.kt        # App entrypoint & notification channels
│   │       ├── MainActivity.kt         # Jetpack Compose UI & navigation
│   │       ├── data/local/             # Room Database, Entities, and DAOs
│   │       ├── data/remote/            # Retrofit ApiService & ApiClient
│   │       ├── data/repository/        # AttendanceRepository & EncryptedSharedPreferences
│   │       ├── geofence/               # GeofencingClient & transition broadcast receiver
│   │       ├── notifications/          # Informational vs Actionable notification builders & action receiver
│   │       ├── workers/                # WorkManager 10m-before check & offline SyncWorker
│   │       └── ui/                     # Material 3 Compose screens (Home, Courses, Settings)
│
├── docker-compose.yml       # Local dev & self-hosting orchestration (Postgres + Web + Purge Worker)
├── .env.example             # Example environment configuration
└── attendance-tracker-app-spec.md  # Detailed system specification
```

---

## Quickstart (Local Docker)

The entire backend and desktop companion stack can be started with a single command:

```bash
# 1. Copy environment configuration
cp .env.example .env

# 2. Start PostgreSQL, Web app, and Purge worker
docker compose up --build
```

- Open **http://localhost:3000** in your browser.
- Default API Token: `attendance-secret-token-12345`.

---

## Desktop Companion & Ingestion Workflow

1. **Semester Configuration**: Set your semester start and end dates. The system automatically computes `purge_at = end_date + 7 days`.
2. **Routine Upload**: Drag-and-drop your routine (PDF, Markdown table, or Image/screenshot).
   - Server-side regex classifies rooms: **Suffix `C` → Theory (70%)**, **Suffix `L` → Lab (90%)**.
   - Interactive review screen allows inline overrides before committing.
3. **Midterm Week**: Set midterm week dates at any time. The system retroactively flags entries in this range with `counted_in_stats = false`.
4. **Holidays**: Adding a whole-day holiday automatically marks all recurring slots as `cancelled_holiday`, suppresses notifications, and retroactively converts any existing `absent` marks.
5. **Online Makeups**: Cancelled classes feature a **"Reschedule as Online"** action that schedules a remote makeup slot without mutating the cancelled record.

---

## Android Mobile App Setup

The Android daily driver runs battery-efficient background geofencing and offline logging:

- **Location & Geofencing**: Powered by `GeofencingClient` with a 30-second loitering delay to eliminate border jitter.
- **Pre-Class Checks**: `WorkManager` fires 10 minutes before each class:
  - **Inside campus** → Informational notification: *"Go to class: CSE331, Room 402C"*.
  - **Outside campus** → Actionable notification with three instant buttons:
    1. `Running Late`
    2. `Cancelled / Holiday`
    3. `I'm Skipping` (immediately logs as Absent)
- **Offline First**: All actions write to the local Room database and enqueue to `sync_queue`. The `SyncWorker` flushes the queue as soon as internet connectivity is restored.

To build the APK:

```bash
cd android
./gradlew assembleDebug
```

---

## Verification & Tests

Run all unit tests covering the attendance calculation engine, routine parsers, and edge cases:

```bash
cd web
npm test
```
