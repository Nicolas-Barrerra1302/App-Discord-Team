# Architecture Reference

## App Structure (Next.js App Router)

**NOTE:** Frontend routes use Spanish names. API routes remain in English.

```
src/app/
  layout.tsx               # Root layout (fonts, metadata, globals)
  (auth)/
    layout.tsx             # Auth layout wrapper
    login/page.tsx         # Discord OAuth login page (error codes: unauthorized, not_in_whitelist, auth_failed)
    callback/route.ts      # OAuth callback: whitelist check + avatar/name sync from Discord
  (dashboard)/
    layout.tsx             # Protected layout with Sidebar + auth check
    loading.tsx            # Loading skeleton
    page.tsx               # Personal dashboard "Modo Enfoque" — hero (top 2 priorities), 4 stat cards drill-down, health grid (ring + cognitive load + estimation gauge + stress bar), value matrix, ActivityLogFeed
    tareas/page.tsx        # Kanban board — server fetches -> KanbanBoard client
    recurrences/page.tsx   # Recurrences manager (all users — members see own, admins see all)
    bonos/page.tsx         # Bonus system — 5 tabs. Server component aggregates globalRanking (BFF pattern: pre-aggregates bonus_events SUM per user) and passes TeamRankingEntry[] to AdminDistribution
    calendario/page.tsx    # Calendar placeholder — files preserved, NOT in sidebar nav (deferred to V2)
    kpis/page.tsx          # Member KPI workspace — draft/submit workflow, live scoring, deadline lock
    admin/
      page.tsx             # Admin team overview — reads searchParams.users, fetches allUsers + filtered metrics
      member/[id]/         # Member detail — Burn-Up Chart + Coaching (gauge, stress bar, value matrix), reactive task history, ActivityLogFeed timeline
      recurrences/         # Recurrence templates + absences admin
      kpis/page.tsx        # Admin KPI management — definition CRUD, week navigator, expandable member tracking
  api/
    tasks/route.ts         # GET (list+filters) + POST (create)
    tasks/[id]/route.ts    # GET (detail+subtasks+comments) + PUT + DELETE
    tasks/[id]/comments/   # GET + POST
    categories/route.ts    # GET + POST
    categories/[id]/       # PUT + DELETE
    recurrences/route.ts   # GET + POST (auth required — members create own, admins create for anyone)
    recurrences/[id]/      # GET + PUT + DELETE (own or admin)
    absences/route.ts      # GET (admin only) + POST (all — member forced to own ID)
    absences/[id]/         # PUT (admin only) + DELETE (admin any, member own only)
    users/route.ts         # GET (list members for dropdowns)
    performance/route.ts   # GET (all members — admin only)
    performance/[userId]/  # GET (single member — own or admin)
    bonuses/route.ts       # GET (launches+events) + POST (create launch)
    bonuses/events/route.ts # GET (events) + POST (register event — super_admin only)
    bonuses/[id]/close/    # PUT (close launch — super_admin only)
    activity/route.ts      # GET (paginated activity log) — ?users=id1,id2&limit=20&offset=0, admin sees all or filtered, non-admin forced to own
    checkins/today/        # GET (pre-fill today's metrics) + POST (save daily check-in) — admin client, force-dynamic
    cron/generate-tasks/   # POST (daily cron, ?force=true skips schedule/dupe checks in dev) + GET (health check)
    kpis/
      definitions/route.ts       # GET (all active — members own, admins all) + POST (create, admin only)
      definitions/[id]/route.ts  # PUT (toggle is_active / update fields) + DELETE (soft-delete if tracking exists)
      tracking/route.ts          # GET (tracking+submission for user+week) + PUT (upsert draft values)
      submit/route.ts            # POST (finalize week — upserts entries, scores, links bonus_event)
      history/route.ts           # GET (submission history — last N weeks with per-KPI breakdown)
```

## Sidebar Navigation

```
/ (Dashboard)      ->  (dashboard)/page.tsx               (all users)
/tareas            ->  (dashboard)/tareas/page.tsx         (all users)
/recurrences       ->  (dashboard)/recurrences/page.tsx    (all users — role-filtered)
/bonos             ->  (dashboard)/bonos/page.tsx          (all users)
/kpis              ->  (dashboard)/kpis/page.tsx           (all users — member KPI workspace)
# /calendario      ->  (dashboard)/calendario/page.tsx     (HIDDEN — files preserved, deferred to V2. Removed from sidebar NAV_ITEMS 2026-03-28)
--- Admin section (super_admin/ceo only) ---
/admin             ->  (dashboard)/admin/page.tsx          (admin/ceo only)
/admin/kpis        ->  (dashboard)/admin/kpis/page.tsx     (admin/ceo only — KPI management)
/admin/recurrences ->  (dashboard)/admin/recurrences/      (admin/ceo only — full control)
```

## Key Lib Files

- `src/lib/types.ts` — All TypeScript interfaces + `Database` type map
- `src/lib/database.types.ts` — Auto-generated Supabase types (source of truth)
- `src/lib/constants.ts` — Roles, statuses, priorities, bonus config, categories
- `src/lib/utils.ts` — `cn()` helper, `parseDbNumeric()`, `formatTimeSpent()` (minutes → "Xh Ym" display)
- `src/lib/supabase/database.ts` — `getCurrentUser()`, `isAdmin()`, `isSuperAdmin()`, `logActivity()`
- `src/lib/supabase/client.ts` — Browser client (`"use client"` components)
- `src/lib/supabase/server.ts` — Server client (Server Components, route handlers)
- `src/lib/supabase/admin.ts` — Service role client (bypasses RLS, API routes/cron only)
- `src/lib/tasks/filters.ts` — `isOverdue()` (YYYY-MM-DD string comparison, today NOT overdue, excludes blocked), `formatDueDate()`, `formatRelativeTime()`
- `src/lib/tasks/dates.ts` — Colombia timezone helpers: `getTodayColombia()`, `toColombiaDate()`, schedule matchers
- `src/lib/performance/metrics.ts` — `calculateMemberMetrics()`, date ranges
- `src/lib/bonuses/calculator.ts` — `calculateBonuses()` with iterative redistribution
- `src/lib/kpis/scoring.ts` — Pure KPI scoring engine. `scoreKpi(def, tracking)` + `calculateKpiScores(defs, entries)` + `toIntegerPoints()`. Zero side-effects. Handles `asc` (higher=better) and `desc` (lower=better) directions
- `src/lib/kpis/week-helpers.ts` — KPI deadline helpers (COT timezone). `getCurrentWeekStart()`, `getWeekEnd()`, `getDeadlineUtc()`, `isBeforeDeadline()`, `getWeekLabel()`, `isValidWeekStart()`. **ALWAYS use these — never compute deadlines client-side**
- `src/lib/gamification/task-scoring.ts` — Pure task scoring engine (zero side-effects). `resolveMatrixType(impact, effortMinutes)` classifies tasks into 4 matrices (A: high impact + high effort, B: high impact + low effort, C: low impact + high effort, D: low impact + low effort). `calculateTaskScore(matrixType, deadlineTime, completionTime)` → `TaskScoreResult { basePoints, finalScore, appliedModifiers[], cotCalculationLog }`. All deadline math in COT (UTC−5)
- `src/lib/gamification/ledger-service.ts` — **Single gateway to `bonus_events` for all automated gamification writes.** Always uses `createAdminClient()` (service role). Two exports: (1) `processTaskCompletion(userId, registeredBy, taskData)` — runs scoring engine + 10s idempotency check + inserts `task_completed` bonus event. (2) `evaluateGhostClose(userId, registeredBy)` — lazy evaluation: inserts `missed_daily_close` (0 pts) + upserts `auto_closed=true` row in `daily_checkins`. NEVER write to `bonus_events` for automated events from anywhere else
- `src/lib/webhooks/dispatcher.ts` — Resilient Webhook Dispatcher for n8n integration. `dispatchWebhook(event, payload)` with 5s `AbortController` timeout + error swallowing. Typed helpers: `notifyTaskCompleted()`, `notifyTaskAssigned()`, `notifyBonusEvent()`, `notifyCheckinSaved()`
- `src/lib/dashboard/utils.tsx` — Dashboard utility helpers
- `src/components/ui/card.tsx` — `Card`, `CardHeader`, `CardTitle`, `CardContent` — token-consuming card components (`bg-card-secondary`, `border-border`)
- `src/components/ui/button.tsx` — `Button` with variants (`default`/`ghost`/`outline`/`secondary`/`danger`), sizes (`default`/`sm`/`lg`/`icon`), `isLoading` prop
- `src/components/ui/badge.tsx` — `Badge` with status shortcuts (`pending`/`in_progress`/`completed`/`blocked`), priority shortcuts (`low`/`medium`/`high`/`urgent`), and utility variants (`danger`/`success`/`warning`/`info`)
- `src/components/ui/input.tsx` — `Input` — token-consuming input field
- `src/components/shared/ActivityLogFeed.tsx` — Reusable timeline component with hybrid pagination. Server sends first 20 via `initialLogs`, client "Cargar más" fetches from `/api/activity`. Supports `userIdsFilter` for reactive admin multi-select
- `src/components/shared/TaskHistoryTable.tsx` — Reusable task history table with hybrid pagination. Server sends first 20 via `initialTasks`, client "Cargar más" fetches from `/api/tasks`

## Database Schema

Core tables: `users`, `tasks`, `task_comments`, `task_recurrences`, `task_categories`, `bonus_launches`, `bonus_events`, `daily_reports`, `daily_checkins`, `activity_log`, `user_absences`, `kpi_definitions`, `kpi_tracking`, `kpi_submissions`

**KPI tables (added Hito 5 — 2026-03-28):**
- `kpi_definitions` — Admin-configured KPIs. Key columns: `id`, `name`, `description`, `data_type` (number|boolean|percentage), `direction` (asc|desc, default asc), `target_value numeric`, `max_points integer`, `assigned_to uuid FK`, `is_active boolean`, `display_order integer`, `created_by uuid FK`
- `kpi_tracking` — Member values per KPI per week. Key columns: `user_id`, `kpi_id`, `week_start date`, `value numeric`. UNIQUE(user_id, kpi_id, week_start)
- `kpi_submissions` — Weekly submission envelope. Key columns: `user_id`, `week_start date`, `status` (draft|submitted), `submitted_at`, `total_points numeric`, `max_possible numeric`, `bonus_event_id uuid FK → bonus_events`. UNIQUE(user_id, week_start)

**KPI Scoring formulas:**
- `asc` (higher is better): `min(value / target, 1.0) × max_points`. Boolean: value ≥ 1 → max_points
- `desc` (lower is better): value ≤ target → max_points. value > target → `max(0, max_points × (1 − (value − target) / target))`. target = 0 → zero-tolerance (any value > 0 = 0 pts). Boolean: value = 0 → max_points
- Deadline: Sunday 23:59:59.999 COT = next Monday 04:59:59.999 UTC. Enforced server-side via `isBeforeDeadline()` in `week-helpers.ts`
- Race condition guard: `POST /api/kpis/submit` accepts `entries[]` in body and upserts to `kpi_tracking` BEFORE calculating score. Ensures Submit-without-SaveDraft never scores 0.
- `kpi_weekly` dedup window: full COT week range (`${week_start}T05:00:00.000Z` → `${week_start+7d}T05:00:00.000Z`). A 10-second window is insufficient — concurrent requests both pass before either writes.

**Zero-Trust API Guards (Audit 2026-03-28 + hardening 2026-03-28):**
All write endpoints explicitly reject server-managed fields with `400 Bad Request` instead of silently ignoring them. Payload validation pattern:
```typescript
const PROHIBITED = ['field1', 'field2'];
const found = PROHIBITED.filter(f => f in body);
if (found.length > 0) return NextResponse.json({ error: `...` }, { status: 400 });
```
- `POST /api/checkins/today`: rejects `hours_worked, fires_handled, blocks_count, completion_pct, user_id, checkin_date` — all server-calculated
- `POST /api/kpis/submit`: rejects `points, total_points, max_possible, score, user_id, submitted_at, status, bonus_event_id` — scoring is always server-side. Definitions fetched **before** entries upsert — `kpi_id` ownership validated against `assigned_to` set before any DB write (prevents foreign kpi_id injection). `entries[]` bounded to max 50. `Number.isFinite()` used instead of `isNaN()` (rejects `Infinity`/`-Infinity`).
- `PUT /api/tasks/[id]`: rejects `completed_at, created_at, updated_at, created_by, id`. Added string length bounds: `title` ≤500, `description` ≤10000, `block_reason` ≤2000.
- `POST /api/bonuses/events`: rejects `registered_by, created_at, id`. **MANUAL_REGISTRATION_EVENT_TYPES only:** `['quality_bonus', 'initiative', 'collaboration', 'penalty', 'adjustment']`. All automated types (`task_completed`, `kpi_weekly`, `daily_close`, `missed_daily_close`, `early_delivery`, `late_delivery`, `streak`, `settlement`) return 400. `points` bounded to ±9999. `description` ≤500 chars. Dedup check removed `.eq('points', points)` clause (Rule 30 compliance).
- `POST /api/bonuses`: `payments` bounded to max 20. `points` per payment requires `Number.isFinite() && Number.isInteger()`. `name` ≤200 chars.

**Gamification Dedup Rules (Audit 2026-03-28):**
- `task_completed` events in `ledger-service.ts`: deduplicated by `metadata->>task_id` (JSONB filter) + 10-second window. NOT by `points` — two tasks can share identical scores, causing false-positive dedup or missed dedup for concurrent requests.
- `kpi_weekly` events: deduplicated by full week date range (see above).
- `checkins/today` POST: idempotency pre-check (`adminSupa.select('id')`) runs BEFORE the 3 metric calculation queries. Short-circuits double-click at 1 query cost instead of 3.

**tasks table key columns (added in Hito 2 refactoring):**
- `task_type text NOT NULL DEFAULT 'planeada'` — CHECK: `planeada` | `incendio`
- `is_archived boolean NOT NULL DEFAULT false` — Soft-delete for KPI preservation
- `time_spent integer` — Minutes spent on task (nullable)
- `updated_at timestamptz DEFAULT now()` — Auto-updated via `handle_updated_at()` trigger

**tasks audit columns (added in Hito 6 — Audit Metrics):**
- `estimated_time integer` — Estimated minutes (nullable). UI input in hours, converted to minutes on submit
- `impact text` — CHECK: `high` | `medium` | `low`. Required on creation via frontend validation
- `block_type text` — CHECK: `internal` | `external`. Set when task moves to blocked status
- `block_reason text` — Free text justification for block. Saved alongside `task_comments` entry

**task_recurrences extra columns (added in Migration 022):**
- `impact text` — CHECK: `high` | `medium` | `low`. Nullable for backward compat. Required via frontend validation. Copied to each generated task instance by the cron
- `estimated_time integer` — Minutes (nullable). UI input in hours, converted on submit. Copied to each generated task instance by the cron

RLS enforced: members see only their own data. Admin/CEO see all.

**Performance Indexes (Migrations 014 + 015 + 017 + 021):**
B-Tree indexes enforced on all frequently filtered columns:
- `tasks`: `assigned_to`, `(assigned_to, status)`, `due_date` (partial), `completed_at` (partial), `created_at`, `(recurrence_id, created_at)` (partial), `status`, `parent_task_id` (partial)
- `activity_log`: `(user_id, created_at DESC)`
- `bonus_events`: `launch_id`, `(user_id, event_type, created_at DESC)`, `event_type` *(021 — admin cross-user event-type aggregations)*
- `task_comments`: `(task_id, created_at DESC)`
- `kpi_definitions`: `assigned_to`
- `kpi_tracking`: `(user_id, week_start)`, `kpi_id`, `week_start` *(021 — admin week-nav queries without user_id prefix)*
- `kpi_submissions`: `(user_id, week_start)`, `status`, `week_start` *(021 — same gap as kpi_tracking)*
- `daily_checkins`: `(user_id, checkin_date DESC)`, `checkin_date` *(021 — admin 30-day cross-user .gte() query)*

**Data Fetching Rules:**
- NEVER use `select('*')` — always explicit column lists. Metrics use `TASK_METRICS_COLS` (17 cols, excludes `description`/`attachments` JSONB)
- NEVER place DB queries inside loops — pre-fetch in bulk, filter in memory
- HEAD-only counts: `select('id', { count: 'exact', head: true })`
- Admin check-ins: 30-day temporal window (not unbounded)

SQL files (run in order in Supabase SQL Editor):
1. `supabase/schema.sql` (DDL)
2. `supabase/seed.sql` (initial data)
3. `supabase/rls.sql` (policies)

**Migrations (run in order in Supabase SQL Editor):**
- `supabase/migrations/001_recurrence_extra_fields.sql` — Adds `task_type`, `default_status`, `attachments` to `task_recurrences`
- `supabase/migrations/002_fix_recurrence_rls_and_category_fk.sql` — Creates `get_user_id()` + `get_user_role()` helper functions, RLS policies for recurrence update/delete (own or admin), FK cascade `ON DELETE SET NULL` for `category_id` in tasks + task_recurrences
- `supabase/migrations/003_open_category_permissions.sql` — Opens category INSERT/DELETE RLS to all authenticated users (replaces admin-only policies)
- `supabase/migrations/005_activity_log_timeline_columns.sql` — Adds `target_name`, `impact`, `reason` columns to `activity_log` for timeline UI
- `supabase/migrations/006_task_activity_trigger.sql` — Creates `log_task_activity()` PL/pgSQL function + `trg_task_activity` trigger. Auto-logs status and due_date changes on `tasks` table
- `supabase/migrations/007_fix_activity_log_fk_and_trigger.sql` — Hotfix: replaces `auth.uid()` with `NEW.assigned_to` in trigger (auth.users UUID != public.users UUID). Re-creates FK with `ON DELETE SET NULL`
- `supabase/migrations/008_audit_metrics_columns.sql` — Adds `estimated_time`, `impact`, `block_type`, `block_reason` to `tasks`. Index on `impact`
- `supabase/migrations/009_daily_checkins_schema.sql` — Creates `daily_checkins` table (uuid PK, user_id FK, checkin_date, hours_worked numeric, fires_handled int, blocks_count int, summary text, UNIQUE(user_id, checkin_date)). RLS: own read/insert + admin read-all
- `supabase/migrations/010_add_completion_pct.sql` — Adds `completion_pct numeric NOT NULL DEFAULT 0` to `daily_checkins`
- `supabase/migrations/011_improve_activity_log_trigger.sql` — Enhances `log_task_activity()`: status changes now log "Cambió el estado de [Old] a [New]" with Spanish labels, captures `block_reason` when status=blocked
- `supabase/migrations/012_fix_activity_log_trigger.sql` — NULL-safe rewrite: CASE statements instead of jsonb `->>`; prevents NULL concatenation crash. Uses `NEW.assigned_to` directly (no `auth.uid()`)
- `supabase/migrations/013_security_audit_fixes.sql` — RLS hardening: tasks INSERT AND policy, users UPDATE split (super_admin vs ceo), absences self-service, checkins SELECT fix
- `supabase/migrations/014_performance_indexes.sql` — 11 B-Tree indexes on `tasks`, `activity_log`, `bonus_events`, `task_comments` for Calendar readiness and query optimization
- `supabase/migrations/015_kpi_tables.sql` — Creates `kpi_definitions`, `kpi_tracking`, `kpi_submissions` with indexes, RLS policies, and extends `bonus_events_event_type_check` to include `kpi_weekly`
- `supabase/migrations/016_kpi_direction_and_fixes.sql` — Adds `direction text NOT NULL DEFAULT 'asc' CHECK (direction IN ('asc', 'desc'))` to `kpi_definitions`
- `supabase/migrations/017_gamification_ledger.sql` — Creates gamification infrastructure: extends `bonus_events_event_type_check` to include `task_completed`, `missed_daily_close`
- `supabase/migrations/018_fix_ranking_rls.sql` — Fixes RLS policy on bonus ranking aggregation queries
- `supabase/migrations/019_fix_activity_log_gamification_impact.sql` — Removes hardcoded `'+5 pts'` from `log_task_activity()` trigger. Completed tasks now get `impact = NULL`; API backfills the real score via `waitUntil(createAdminClient().update(...))` after scoring runs
- `supabase/migrations/020_daily_checkins_auto_closed.sql` — Adds `auto_closed boolean NOT NULL DEFAULT false` to `daily_checkins`. Ghost close upserts with `auto_closed = true` so admin audit shows day as officially closed
- `supabase/migrations/021_audit_fixes_h5.sql` — **Enterprise Audit (2026-03-28).** Three sections: (1) **4 B-Tree indexes:** `kpi_submissions(week_start)`, `kpi_tracking(week_start)`, `bonus_events(event_type)`, `daily_checkins(checkin_date)` — closes sequential scan gaps for admin week-navigation and cross-user date range queries where compound indexes required an unbound leading column. (2) **3 RLS hardening fixes:** `kpi_submissions_update` WITH CHECK now enforces `status = 'draft'` to block direct status escalation to 'submitted' via PostgREST; `kpi_tracking_update` + `kpi_tracking_insert` add subquery freeze guard (`NOT EXISTS kpi_submissions WHERE status='submitted' AND week_start = ...`) preventing post-submission value tampering that corrupts admin audit trail; `daily_checkins` gains an explicit admin UPDATE policy for corrections (no member UPDATE — check-ins remain immutable for members). (3) **3 FK ON DELETE fixes:** `kpi_tracking.user_id` RESTRICT → CASCADE (mirrors `daily_checkins` pattern); `kpi_submissions.user_id` RESTRICT → CASCADE; `kpi_submissions.bonus_event_id` RESTRICT → SET NULL (nullable FK should not block bonus_event deletion during corrections).
- `supabase/migrations/022_recurrence_impact_estimated_time.sql` — Adds `impact VARCHAR(10) CHECK (IN 'high','medium','low')` and `estimated_time INTEGER CHECK (> 0)` to `task_recurrences`. Both nullable for backward compat. Closes the field parity gap between `TaskModal` and `RecurrenceModal` — generated task instances now inherit these values from the template.

**Migration note:** Always end migrations with `NOTIFY pgrst, 'reload schema';` to refresh PostgREST schema cache.

## Design Tokens (Single Source of Truth)

All colors are defined as semantic Tailwind tokens in `tailwind.config.ts`. **NEVER use hardcoded hex in classNames** — use the token names below.

### Base Palette — "Quiet Luxury" Dark

| Token (Tailwind class) | Hex Value | Usage |
|------------------------|-----------|-------|
| `bg-background` | `#0C0C0C` | Page background (Carbon Black) |
| `bg-background-secondary` | `#111111` | Section backgrounds |
| `bg-card` | `#141414` | Primary cards |
| `bg-card-secondary` | `#1A1A1A` | Secondary cards, panels |
| `border-border` | `#2A2A2A` | All borders |
| `text-text` | `#E8E8E8` | Primary text |
| `text-text-muted` | `#888888` | Secondary/muted text |
| `text-text-heading` | `#F5F5F5` | Headings |
| `bg-accent` / `text-accent` | `#CBA35C` | Copper Gold — primary accent, buttons |

### Neon Semantic Tokens — "Cyberpunk Terminal"

These tokens power the True Neon LED effect. **ALWAYS use at 100% opacity** — never dilute with `/10`, `/15`, `/20` fills on Carbon Black backgrounds.

| Token | Hex Value | Usage |
|-------|-----------|-------|
| `text-success-neon` | `#00E676` | Completed tasks, positive points, on-time delivery |
| `text-danger-neon` | `#FF5252` | Blocked status, overdue, negative points, fire tasks |
| `text-warning-neon` | `#FFD740` | Overdue warning, medium risk, near-deadline countdown |
| `text-electric-blue` | `#38BFF5` | Planned tasks, info, KPI labels, pending state |

### Status & Priority Tokens

**Status tokens:** `text-status-pending` (electric blue), `text-status-in_progress` (amber), `text-status-completed` (success neon), `text-status-blocked` (danger neon)
**Priority tokens:** `text-priority-low` (slate), `text-priority-medium` (amber), `text-priority-high` (orange), `text-priority-urgent` (danger neon + animate-pulse)
**Role tokens:** `bg-role-super_admin`, `bg-role-ceo`, `bg-role-member`

### True Neon LED CSS Standard

All gamification figures, status badges, and alert indicators MUST use this pattern:

```css
/* ✅ TRUE NEON LED — always use this for badges on Carbon Black */
bg-transparent text-[neon-token] border border-[neon-token] [text-shadow:0_0_8px_currentColor]

/* ✅ SVG icon glow (text-shadow doesn't apply to SVGs) */
text-[neon-token] [filter:drop-shadow(0_0_6px_currentColor)]

/* ❌ PROHIBITED — muddy fill kills neon on Carbon Black */
bg-[neon-token]/10 text-[neon-token]
bg-[neon-token]/15 text-[neon-token]
bg-[neon-token]/20 text-[neon-token]
```

**Why:** Semi-transparent neon fills (`/10`–`/20`) over `#0C0C0C` produce desaturated, muddy colors. Transparency + solid border + `text-shadow` replicates a physical LED phosphor glow with maximum contrast.

UI constant maps (`STATUS_COLORS`, `PRIORITY_COLORS`, `ROLE_BADGE_COLORS`, `IMPACT_COLORS`, `TASK_TYPE_COLORS`, etc.) in `src/lib/constants.ts` compose these tokens into ready-to-use className strings.

**UI Component Library** (`src/components/ui/`):
Reusable "dumb" components that consume design tokens. Prevents UI technical debt by centralizing styling decisions. All new UI must use these instead of raw HTML:
- `Card` / `CardHeader` / `CardTitle` / `CardContent` — replaces `<div className="bg-[#...]">`
- `Button` — replaces `<button>` with consistent variants, sizes, loading state, and `aria-busy`
- `Badge` — replaces status/priority `<span>` indicators; all neon variants use True Neon LED CSS
- `Input` — replaces `<input>` with consistent token-based styling

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| UI Components | Custom dark-mode components (no shadcn/ui) |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable (strict memoization for 60fps) |
| Charts | Recharts |
| Database | Supabase (PostgreSQL) |
| Auth | Discord OAuth via Supabase Auth (whitelist + avatar/name sync) |
| Deploy | Vercel |
| Cron | Vercel Cron + n8n |
| Notifications | n8n → Discord Bot (Lau) |

## Auth Flow

1. User clicks "Entrar con Discord" → Supabase OAuth redirect
2. Discord authorizes → callback receives code
3. `callback/route.ts`: exchanges code for session, extracts `discord_id` from `user_metadata`
4. Whitelist check: queries `public.users` for matching `discord_id`. If not found → `signOut()` + redirect to `/login?error=unauthorized`
5. If found: syncs `avatar_url` and display name (`global_name`) from Discord metadata to `public.users` (only if changed)
6. Redirect to `/`

**Middleware** (`src/middleware.ts`):
- Refreshes auth session on every request
- Unauthenticated users → redirect to `/login` (except `/login`, `/callback`, `/api/*`, static assets)
- Authenticated users: verifies `discord_id` exists in `public.users`. If not → `signOut()` + redirect to `/login?error=not_in_whitelist`
- Authenticated + whitelisted users on `/login` → redirect to `/`
- API routes excluded (must implement own auth)

## React Performance Architecture (Kanban)

The Kanban board (`/tareas`) relies on strict memoization to maintain 60fps during `@dnd-kit` drag-and-drop operations:

- **`TaskCard`** wrapped in `React.memo` with custom comparator (compares `id`, `status`, `updated_at`, `title`, `priority`, `due_date`, `is_archived`, `time_spent`, `block_type`, `subtask_count`, `subtask_completed_count` + handler references). `subtask_count`/`subtask_completed_count` are required — without them, the progress bar silently fails to update.
- **`KanbanColumn`** wrapped in `React.memo` with a **structural custom comparator**. Default reference equality is insufficient here: `columnTasks` `useMemo` builds a new `Record<status, Task[]>` object on every drag event, giving all 4 columns a new `tasks` array reference even if their content is identical. The custom comparator iterates `prev.tasks` vs `next.tasks` and compares `id + status + updated_at` per item — limiting re-renders to the source and destination columns only.
- **`SortableContext` items** derived via `useMemo(() => tasks.map(t => t.id), [tasks])` inside `KanbanColumn` — prevents a new array from being created on every column render.
- **`columnTasks`** derived via `useMemo([tasks, sortMode])` in `KanbanBoard` — single-pass partition into `{pending, in_progress, blocked, completed}` with optional sort.
- **All handlers** (`handleTaskClick`, `handleCreateTask`, `handleDragStart`, etc.) wrapped in `useCallback` to prevent breaking child memoization.
- **Result:** a drag event re-renders only the `DragOverlay` ghost + the 2 columns whose task lists actually changed. The other 2 columns (and all their TaskCards) are skipped entirely.

**Server-side parallel data fetching:**
Independent Supabase queries in Server Components (`page.tsx`, `admin/page.tsx`) MUST use `Promise.all`. Sequential `await` chains add cumulative latency; parallel execution reduces load time to the duration of the slowest query. Pattern:
```typescript
const [metrics, rawLogsResult] = await Promise.all([
  calculateMemberMetrics(supabase, user, from, to),
  supabase.from("activity_log").select(...).limit(20),
]);
```

## Notification Architecture

```
App (Next.js API) <-> n8n workflows <-> Discord Bot (Lau)
```
- n8n handles all scheduling (cron) and Discord message delivery
- App provides data endpoints, n8n orchestrates communication

## Webhooks & Async Side-effects (Audit 2026-03-27)

**Problem:** Vercel Serverless Functions have a 10s (Hobby) / 15s (Pro) timeout. If an API route `await`s an external HTTP call to n8n before returning the response, a slow/down n8n causes a 504 Gateway Timeout. The DB mutation already committed, but the frontend receives an error and triggers an optimistic-update rollback — creating a split-brain state where DB says "completed" but the Kanban shows the task reverted.

**Solution:** `src/lib/webhooks/dispatcher.ts` — a self-contained module implementing the Resilient Webhook Dispatcher pattern:

```
API Route flow:
  1. Auth + validation
  2. supabase.update() → DB commit
  3. waitUntil(logActivity(...))     ← existing pattern
  4. waitUntil(notifyXxx(...))       ← NEW: webhook dispatch
  5. return NextResponse.json(...)   ← response sent BEFORE webhooks execute
```

**Dispatcher guarantees:**
- `AbortController` with `WEBHOOK_TIMEOUT_MS = 5000` (5s hard ceiling)
- `try/catch` swallows all errors — `console.warn('[WEBHOOK] ...')`, never throws
- Graceful degradation: if `N8N_WEBHOOK_BASE_URL` env var is not set, returns immediately (dev mode)
- Auth: `X-Webhook-Secret` header sent from `N8N_WEBHOOK_SECRET` env var
- Payload includes `_ts` (ISO timestamp) for n8n deduplication

**Typed helpers (one per notification event):**
- `notifyTaskCompleted(task, user)` → `POST /task-completed`
- `notifyTaskAssigned(task, newAssigneeId, assignedBy)` → `POST /task-assigned`
- `notifyBonusEvent(launchId, targetUserId, eventType, points, registeredBy)` → `POST /bonus-event`
- `notifyCheckinSaved(userId, userName, completionPct, summaryPreview)` → `POST /checkin-saved`

**Integration pattern** (same as `logActivity`):
```typescript
// In any API route, after successful DB mutation:
waitUntil(notifyTaskCompleted(updatedTask, user));
return NextResponse.json(updatedTask);
```

**Currently integrated in:**
- `PUT /api/tasks/[id]` — fires `notifyTaskCompleted` on status→completed, `notifyTaskAssigned` on assigned_to change

**Env vars required (optional — app works without them):**
- `N8N_WEBHOOK_BASE_URL` — e.g., `https://n8n.example.com/webhook`
- `N8N_WEBHOOK_SECRET` — shared secret for webhook authentication

## Observability & Structured Logging (Phase 7 — 2026-03-29)

All critical background processes emit **structured, machine-parseable log lines** designed for instant grep-based post-mortem debugging in Vercel Logs. No naked `console.error()` / `console.log()` calls exist in background processes.

### Log Prefixes (grep targets)

| Prefix | File | Severity | Description |
|--------|------|----------|-------------|
| `[CRON]` | `cron/generate-tasks/route.ts` | INFO | Per-recurrence decisions (SKIP, GENERANDO) |
| `[CRON_ERROR]` | `cron/generate-tasks/route.ts` | ERROR | Recoverable failures with full context |
| `[CRON_SUMMARY]` | `cron/generate-tasks/route.ts` | INFO | End-of-run machine-parseable summary |
| `[WEBHOOK_ERROR]` | `lib/webhooks/dispatcher.ts` | WARN | Webhook dispatch failure (TIMEOUT or NETWORK_ERROR) |
| `[LEDGER_ERROR]` | `lib/gamification/ledger-service.ts` | ERROR | Bonus event insert failures or unexpected exceptions |
| `[LEDGER_WARN]` | `lib/gamification/ledger-service.ts` | WARN | Non-fatal side-effect failures (e.g., auto-close upsert) |

### Log Format Standards

**Cron summary** — key=value pairs, machine-parseable:
```
[CRON_SUMMARY] date=2026-03-29 generated=4 skipped_absent=1 skipped_schedule=8 skipped_duplicate=0 errors=0 total_recurrences=13 force_mode=false
```

**Cron error** — full `recurrence_id` (never truncated), `title`, `assigned_to`:
```
[CRON_ERROR] recurrence_id=<uuid> title="Reunión diaria" assigned_to=<uuid> error="duplicate key..."
```

**Webhook error** — distinguishes `TIMEOUT` (AbortController fired) from `NETWORK_ERROR`, includes payload key list:
```
[WEBHOOK_ERROR] event="task-completed" reason=TIMEOUT error="The operation was aborted" | task_id=abc... title=Fix bug...
```

**Ledger error** — always includes `user_id`, `task_id` / `missed_date`, `launch_id`, and score context:
```
[LEDGER_ERROR] bonus_event insert failed event_type=task_completed user_id=<uuid> task_id=<uuid> launch_id=<uuid> score=575: <DB error>
[LEDGER_ERROR] Unhandled exception in evaluateGhostClose user_id=<uuid> yesterday_cot=2026-03-28: <message>
[LEDGER_WARN] daily_checkins auto-close upsert failed user_id=<uuid> date=2026-03-28: <error>
```

### Design Rules
- Every log line is grep-able by prefix → enables instant filter in Vercel Logs or any log aggregation service
- Context keys (`user_id`, `task_id`, `recurrence_id`, `event_type`) are always present — no anonymous failures
- `[WEBHOOK_ERROR]` serialises **payload keys only** (not values of full objects) to avoid log spam from large payloads
- `[LEDGER_WARN]` vs `[LEDGER_ERROR]` distinction: non-fatal side-effects (auto-close upsert) use WARN; data integrity failures (bonus_event insert) use ERROR
- When migrating to an external observability platform (Sentry, Datadog, Axiom), the structured prefixes map 1:1 to log levels and can be forwarded via a thin adapter without changing callers
