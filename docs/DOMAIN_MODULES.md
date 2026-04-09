# Domain Modules Reference

## 1. Tasks (Hito 2)

Kanban (pending/in_progress/completed/blocked), subtasks, comments, attachments, categories, search + advanced filters, auto-priority escalation near deadlines, drag & drop status changes. Route: `/tareas`

**Architecture:**
- Server: `tareas/page.tsx` reads `searchParams`, builds filtered Supabase query, wraps `<KanbanBoard>` in `<Suspense>`. API supports `limit`/`offset` params for pagination
- Client: `KanbanBoard` uses `useSearchParams()` to detect URL changes -> fetches `GET /api/tasks?params`. Manages drag & drop, modals, detail panel
- URL as source of truth: `TaskSearchBar` and `TaskFiltersPanel` use `useRouter().replace()` to update query params. No client-side filtering — all in DB via PostgREST
- API calls: Client components call `/api/tasks/*` for mutations, optimistic updates with rollback
- Activity log: `waitUntil(logActivity(...))` from `@vercel/functions` for non-blocking background logging
- Webhook notifications: `waitUntil(notifyTaskCompleted(...))` / `waitUntil(notifyTaskAssigned(...))` from `src/lib/webhooks/dispatcher.ts` — fires n8n webhooks without blocking the API response (5s `AbortController` timeout + error swallowing). See [ARCHITECTURE.md — Webhooks & Async Side-effects](ARCHITECTURE.md#webhooks--async-side-effects-audit-2026-03-27)
- Priority escalation: Backend-only (DT-1) — POST/PUT handlers auto-escalate to `urgent` if `due_date` <= 24h
- API access control: All routes verify `!isAdmin(user) && entity.assigned_to !== user.id`. Search inputs sanitized (strip `,.()*%\`) before PostgREST `.or()`. Status/priority validated against allowed enums

**Task fields added in Hito 2 refactoring (2026-03-24):**
- `task_type` (`planeada` | `incendio`) — Distinguishes planned tasks from fire drills. Validated in API. Default: `planeada`
- `is_archived` (boolean, default false) — Soft-delete pattern. DELETE /api/tasks/[id] archives by default; `?permanent=true` for hard delete. Archived tasks preserved for KPI/performance calculations
- `time_spent` (integer, nullable, minutes) — Time tracking. TimeSpentModal prompts user when completing a task
- `updated_at` (timestamptz) — Auto-updated via `handle_updated_at()` trigger

**Task audit fields added in Hito 6 — Audit Metrics (2026-03-25):**
- `estimated_time` (integer, nullable, minutes) — Estimation at creation. UI input in hours (step 0.5), converted to minutes `Math.round(hours * 60)` on submit. Required via frontend validation
- `impact` (`high` | `medium` | `low`, nullable) — Strategic impact level. Required on creation. API validates against `VALID_IMPACTS` array
- `block_type` (`internal` | `external`, nullable) — Set when task moves to blocked. Frontend maps "Interno"→`internal`, "Externo"→`external`. Cleared when unblocked
- `block_reason` (text, nullable) — Free text block justification. Stored on task row AND as `task_comments` entry (dual storage for audit trail)

**Soft-delete pattern:**
- DELETE without `?permanent=true` → sets `is_archived=true` (also archives subtasks)
- DELETE with `?permanent=true` → hard delete from DB (removes from KPIs). **API-level guard:** `isAdmin(user)` check returns 403 for non-admin users before any DB operation (patched 2026-03-27, VULN-1 security audit). UI also restricts visibility, but API is the source of truth.
- TaskCard action menu: "Archivar" for all users. "Eliminar definitivo" visible only to `super_admin`/`ceo` (admin-only, protects audit history)

**Block flow (added 2026-03-24):**
- Moving a task to "blocked" (drag & drop or status selector) triggers a mandatory `BlockReasonModal`
- User must select block type: "Interno (Equipo)" or "Externo (Cliente/Proveedor)" + write a mandatory text reason
- The reason is saved as a `task_comments` entry with prefix `🚫 Bloqueada — {type}: {reason}`
- Without completing both fields, the status change is cancelled — Kanban state is not affected

**Category management:**
- Category combobox in `TaskModal` and `RecurrenceModal` supports free-text search, autocomplete, create-new, and delete
- Custom categories (`is_default=false`) show a Trash2 icon for deletion. Default categories are protected
- DELETE `/api/categories/[id]` rejects if active (non-archived) tasks use the category; unlinks archived tasks and recurrence templates before deleting
- Category creation/deletion is available to all authenticated users (not admin-restricted)
- Delete shows toast feedback: green on success, red with API error message on failure (both modals)

**Components (refactored 2026-03-24):**
- `KanbanBoard` — DnD context with custom `columnAwareCollision` detection (pointerWithin for columns, closestCorners fallback — fixes empty column skip bug), column layout, task fetching, modals (create/edit, detail, time-spent, block-reason), toast system (success green + error red). `resolveDropColumn()` resolves `over.id` to column status (handles task UUID → parent column). Module-level `VALID_STATUSES` guards all resolved values before API calls
- `KanbanColumn` — `React.memo`-wrapped droppable column (ref on outer div, not inner task list) with SortableContext, passes `isAdmin` prop. Skips re-render when its `tasks` array reference is stable (ensured by parent `useMemo`)
- `TaskCard` — `React.memo`-wrapped sortable card with custom comparator (`id + status + updated_at + title + priority + due_date + is_archived + time_spent + block_type + handler refs`). Priority badges, due date, assignee, subtask progress bar, action menu (archive for all, hard-delete admin-only)
- **Column task derivation:** `KanbanBoard` uses a single `useMemo` to partition `tasks` into a `Record<TaskStatus, Task[]>` dictionary (`columnTasks`), replacing the previous inline `getColumnTasks()` function. This ensures each column receives a referentially stable array — critical for `React.memo` to work. Sort mode (default/due_date/priority) applied within the same memo
- `TaskModal` — Create/edit form with category combobox (free-text + autocomplete + create-new + delete with toast feedback), inline block-reason fields when status=blocked. `onToast` prop for parent toast integration
- `TaskDetailPanel` — Full detail view with subtasks, comments, edit capability
- `TaskToolbar` — Search, sort, filters, "Recurrentes" link, "Nueva Tarea" button
- `TaskSearchBar`, `TaskFilters` — URL-param driven search and filtering
- `DeleteConfirmDialog` — Reusable confirmation dialog for destructive actions

## 2. Recurring Tasks (Hito 3)

Templates with frequency (daily/weekly/biweekly/monthly/custom). Vercel Cron at 6am COT generates task instances. Paused for absent members.

- Server pages:
  - `recurrences/page.tsx` → `<RecurrencesManager>` (dashboard-level, all users — members see own, admins see all)
  - `admin/recurrences/page.tsx` → `<RecurrencesManager>` (admin: all recurrences + all absences, full control)
- Components: `RecurrenceCard` (uses `suppressHydrationWarning` on locale-formatted dates), `RecurrenceModal` (visual clone of TaskModal with frequency controls + `onToast` for category delete feedback. **Parity with TaskModal (Migration 022, 2026-04-07):** fields `impact` (high/medium/low) and `estimated_time` (hours → minutes) are now required in this modal too — both are validated on submit and stored on the `task_recurrences` row), `AbsenceModal` (role-aware: members see static own-name field, admins see dropdown to pick any member)
- Hydration pattern: Server pages compute `serverToday = getTodayColombia()` and pass it as a prop to `RecurrencesManager`. All date comparisons in the client use this stable server value — avoids SSR/client date mismatches. Toast IDs use `useRef` (not module-level `let`) for Fast Refresh compatibility.
- API: `/api/recurrences` (auth CRUD — members own, admins all), `/api/absences` (POST: all users — member forced to own ID; GET: admin; DELETE: admin any or member own), `/api/cron/generate-tasks` (daily cron)
- Cron: `0 11 * * *` (6am COT) -> `/api/cron/generate-tasks` POST with `CRON_SECRET`. Admin client (bypasses RLS). Checks frequency, absences, duplicates. Updates `next_due_date`. `?force=true` bypasses schedule + duplicate checks (dev bypass also skips CRON_SECRET auth when `NODE_ENV=development`). Absences always enforced even in force mode. Console logs with `[CRON]` prefix for every decision. **Cron copies `impact`, `estimated_time`, and `task_type` from the recurrence template to each generated task instance** (Migration 022 — previously these were NULL on all generated tasks).
- **CRON N+1 elimination (2026-03-27):** Duplicate check no longer queries DB inside the loop. A single bulk pre-fetch before the loop builds `alreadyGenerated: Set<string>` with today's recurrence IDs (`select('recurrence_id').eq('is_recurring_instance', true).gte/lt created_at`). Loop uses `Set.has()` for O(1) duplicate detection. Index `idx_tasks_recurrence_created` supports this query.
- **CRON loop fault isolation (2026-03-29):** Each recurrence iteration is wrapped in an individual `try/catch`. A corrupt or failing recurrence does not abort the entire cron job — the error is logged via `console.error` and the loop continues (`continue`). The `generated++` counter increments **before** `logActivity` and `next_due_date` side-effects; their failures are isolated in nested `try/catch` blocks and never undercounting a successfully created task. The outer catch types `err: unknown` (no implicit `any`).
- UX: "Recurrentes" in sidebar main nav → `/recurrences` for all users. "Forzar Cron (Dev)" button visible only in dev + admin role, sends `POST ?force=true`.
- RLS: `get_user_id()` / `get_user_role()` helper functions on remote Supabase. Policies allow update/delete for own recurrences (`assigned_to` or `created_by`) or admin role.

## 3. Performance (Hito 4)

Auto-calculated from tasks: % completion, avg speed, streak, overdue count.

- **Blocked tasks are frozen:** Tasks with `status === 'blocked'` are excluded from `tasks_overdue`, don't penalize `completion_pct` (denominator uses active tasks only), and are skipped in `streak` calculation. This prevents punishing members for external blockers.
- Metrics: `src/lib/performance/metrics.ts` — completion %, avg speed (hours), streak (consecutive 100% days), overdue count, weekly data points (Burn-Up: scope by `due_date` + cumulative completed by `completed_at`, future-day clamping), `block_audit` (internal/external counts), `impact_distribution` (high/medium/low counts), `avg_lead_time_hours` (completed_at - created_at average), `avg_estimation_gap` ((real-estimated)/estimated %, div/0 safe), `fire_ratio` (% incendio tasks over completed), `value_matrix` (4-quadrant: key_projects/quick_wins/maintenance/time_sinks, effort threshold 120min)
- **Metrics payload optimization (2026-03-27):** `calculateMemberMetrics()` uses `TASK_METRICS_COLS` (17 explicit columns) instead of `select('*')`. Excludes `description` and `attachments` (heavy JSONB) from the query. Check-in pre-fill endpoint uses `select('time_spent, task_type')`. HEAD-only count queries use `select('id', ...)`. Admin check-ins limited to 30-day window.
- API: `/api/performance` (admin: all members, accepts optional `?users=id1,id2` for server-side user filtering), `/api/performance/[userId]` (own or admin). Accept `?range=week|month|day|custom&from=&to=`. Both routes use `export const dynamic = 'force-dynamic'` to prevent Next.js caching.
- Personal dashboard: `page.tsx` -> `<PersonalDashboard>` — "Modo Enfoque" layout: (1) Hero with dynamic greeting + top 2 priority tasks (sorted by impact×priority score) + "Cerrar Día" button (or "Día Cerrado" badge), (2) 4 clickable stat cards + `<DrillDownTable>` panel, (3) 4-column health grid: completion ring + cognitive load tachometer (SVG) + `<EstimationGauge>` + `<StressBar>`, (4) `<ValueMatrix>` + `ActivityLogFeed`. `DailyCheckinModal` opens from hero. Fetches `GET /api/checkins/today` with `cache: "no-store"`. No Recharts dependency.
- Admin dashboard: `admin/page.tsx` -> `<TeamOverview>` — team summary, member grid, `AdminMultiSelect` for user filtering, 3 audit widgets (Block Audit stacked bar, Avg Lead Time stat card, Impact Distribution conic-gradient pie — all clickable with extended `DrillDownKey`), `AdminCheckinsWidget` (team checkin status per user with CompletionRing SVG, date-filtered client-side via `useMemo`), `ActivityLogFeed` timeline (client-filtered by selectedUserIds). Server component passes `allUsers` (immutable) + `metrics` (filtered) + `rawCheckins` (ALL, no date filter) + `activityLogs` (ALL, unfiltered)
- Member detail: `admin/member/[id]/page.tsx` -> `<MemberDetail>` — 6 stat cards + `<DrillDownTable>`, AreaChart + LineChart, `<EstimationGauge>`, `<StressBar>`, `<ValueMatrix colSpan>`, `TaskHistoryTable` (hybrid pagination), `ActivityLogFeed` timeline (hybrid pagination with `userIdsFilter`).

**Progressive Hydration & Streaming Architecture (Phase 6 — 2026-03-29):**

The dashboard uses a two-level Suspense strategy to eliminate perceived load time.

**Level 1 — Route-segment skeleton (`loading.tsx`):**
`src/app/(dashboard)/loading.tsx` is a high-fidelity skeleton rendered by Next.js App Router's built-in Suspense boundary for the entire `(dashboard)` route segment. It mirrors the exact DOM structure of `PersonalDashboard`: header + filter bar, hero section (2 priority task cards), 4 stat cards, health grid (4 widget cards with SVG placeholders), and the value matrix + activity log row. All shapes use `animate-pulse` with `bg-white/[0.0x]` opacity tokens (no hex). The skeleton is shown instantly while the page's Server Component resolves — the sidebar (from `layout.tsx`) is already painted.

**Level 2 — Granular async Server Components with Suspense:**

*Personal dashboard (`page.tsx`):*
- `calculateMemberMetrics` is awaited first — `PersonalDashboard` renders immediately once metrics resolve
- `PersonalActivityLog` is a separate async Server Component that fetches `activity_log` independently. It is passed as `activityLogSlot` prop to `PersonalDashboard` wrapped in `<Suspense fallback={<ActivityLogSkeleton />}>`. The activity log section streams in after the rest of the dashboard is visible, with its own 5-row skeleton fallback
- `PersonalDashboard` accepts `activityLogSlot?: React.ReactNode` as a slot prop. When provided, it renders the slot in place of the default `<ActivityLogFeed>` — enabling server-to-client slot injection without breaking the existing client component contract

*Admin dashboard (`admin/page.tsx`):*
- Auth guard + redirect checks run before any Suspense boundary
- `AdminDashboardSection` is a separate async Server Component that encapsulates the full `Promise.all` (allUsers + metrics + activityLogs + checkins) and renders `<TeamOverview>`. It is wrapped in `<Suspense fallback={<AdminDashboardSkeleton />}>` — a 6-card team member skeleton
- Pattern ensures the auth redirect (fast) is never delayed by the metrics query (slow)

**Slot injection pattern (applies to any future dashboard):**
```tsx
// page.tsx (Server Component)
<ClientDashboard
  metrics={metrics}
  heavySlot={
    <Suspense fallback={<HeavySkeleton />}>
      <HeavyServerSection userId={user.id} />
    </Suspense>
  }
/>

// ClientDashboard.tsx ("use client")
function ClientDashboard({ metrics, heavySlot }) {
  return <div>...{heavySlot ?? <DefaultFallback />}...</div>;
}
```
This pattern avoids blocking the initial client render on data that can be streamed in later, and requires zero changes to the Server Component fetching logic.

**Dashboard Design System — "Quiet Luxury + Cyberpunk Neon" (Phase 5, 2026-03-29):**

The dashboard uses a two-tier badge and icon system:
- **Tier 1 — Quiet Luxury (structural):** muted Tailwind tokens for navigation, labels, and non-interactive text. Never loud.
- **Tier 2 — True Neon LED (gamification/alerts):** all status badges, task type badges, points, overdue indicators, and alert icons use the True Neon LED pattern: `bg-transparent text-[neon-token] border border-[neon-token] [text-shadow:0_0_8px_currentColor]`. SVG icons use `[filter:drop-shadow(0_0_6px_currentColor)]` for equivalent glow.

**NEVER** use muted fills (`bg-[neon-token]/10`, `/15`, `/20`) for Tier 2 elements — semi-transparent neon fills over Carbon Black (`#0C0C0C`) produce muddy, desaturated colors. See `ARCHITECTURE.md — True Neon LED CSS Standard` for the full spec.

All badge variants are centralized in `src/components/ui/badge.tsx`. All constants (STATUS_COLORS, IMPACT_COLORS, TASK_TYPE_COLORS, PRIORITY_DOT, etc.) are in `src/lib/constants.ts`. Never redefine them locally.

**Shared Coaching Widgets — `src/components/dashboard/shared/` (Phase 5, 2026-03-29):**
These 4 components are the **single implementation** for coaching/drill-down UI used across all dashboard views. Never duplicate their logic inline:
- `EstimationGauge.tsx` — Semicircle SVG gauge showing `avg_estimation_gap` (-50% → +50%). Props: `gap: number | null`, `svgClassName?: string`. Color-coded needle: green ≤10%, orange ≤30%, red >30%.
- `StressBar.tsx` — Horizontal fire-ratio bar with 3-zone gradient (blue/orange/red). Props: `ratio: number | null`. Shows big number + status label + tip message.
- `ValueMatrix.tsx` — 2×2 quadrant (Impacto vs Esfuerzo) for completed tasks. Props: `valueMatrix: MemberMetrics["value_matrix"]`, `colSpan?: boolean` (for lg:col-span-2 in grid), `cellMinHeight?: number`. Uses `QUADRANT_CONFIG` constant internally.
- `DrillDownTable.tsx` — Scrollable task table with status/priority/category/date columns. Props: `title`, `tasks`, `catMap`, `blockReasons?`, `showBlockReason?`, `onClose`. Consumes `STATUS_LABELS`, `PRIORITY_LABELS`, `PRIORITY_DOT` from `src/lib/constants.ts` and `formatDateShort` from `src/lib/dashboard/utils.tsx`. Uses `variant="danger-neon"` for overdue dates, `variant="electric-blue"` for "Planeada", `variant="danger-neon"` for "Incendio".

**Activity Log Timeline (added 2026-03-25, hybrid pagination 2026-03-27):**
- `ActivityLogFeed` (`src/components/shared/ActivityLogFeed.tsx`): single reusable `"use client"` component for all 3 dashboards. **Hybrid pagination:** server sends first 20 items via `initialLogs` prop, client manages state + "Cargar más" button fetching from `/api/activity`. Supports `userIdsFilter?: string[]` prop with `useEffect` + `AbortController` for reactive re-fetch when admin multi-select changes. Renders vertical timeline with avatars, relative timestamps, impact badges, and reason blocks (block justifications styled with accent border).
- `TaskHistoryTable` (`src/components/shared/TaskHistoryTable.tsx`): identical hybrid pagination pattern for task history in member detail. Sticky header, scrollable, fetches from `/api/tasks?assigned_to=...&limit=20&offset=...`.
- `/api/activity` route: paginated endpoint with `?users=id1,id2&limit=20&offset=0`. Admin sees all or filtered; non-admin forced to own. Returns `{ data: ActivityLogEvent[], hasMore: boolean }`.
- DB trigger: `trg_task_activity` (AFTER UPDATE on `tasks`) calls `log_task_activity()` PL/pgSQL function. Logs "Cambió el estado de [Old] a [New]" with Spanish labels (CASE statements, NULL-safe). Captures `block_reason` when status=blocked. Impact tags: "+5 pts" for completed, "-1 racha" for blocked. Always uses `NEW.assigned_to` for `user_id` (never `auth.uid()`). Migrations: 006 (original), 011 (enhanced labels), 012 (NULL-safe fix).
- **NULL concatenation trap (fixed via migration 012):** PostgreSQL `||` with NULL operand returns NULL, silently dropping the entire log message. The trigger was rewritten to use CASE statements instead of `jsonb ->>` extraction and `COALESCE` for `block_reason`. Without this fix, any task with a NULL `block_reason` would produce a NULL `description` in `activity_log`.
- Server queries: each `page.tsx` queries `activity_log` with `.select("..., users:user_id(name, avatar_url)")` join, `.limit(20)`, maps to `ActivityLogEvent[]`. Personal dashboard: `.eq("user_id", user.id)`. Member detail: `.eq("user_id", params.id)` + passes `userIdsFilter={[id]}`. Admin: fetches ALL with `.limit(20)`, client filters by `selectedUserIds` via `userIdsFilter` prop.
- `activity_log` extra columns: `target_name` (text), `impact` (text), `reason` (text) — added via migration 005. Trigger populates them automatically.

**Metrics date filtering (strict timebox, updated 2026-03-27):**
- DB query: fetches ALL tasks for user (no date filters in Supabase). JS does 100% of filtering.
- Completed tasks: included only if `completed_at` falls within `[FROM, TO]` (numeric ms comparison, timezone-safe).
- Non-completed tasks: strict timebox — `due_date` must be within `[FROM, TO]`. If no `due_date`, falls back to `created_at` (converted via `toColombiaDate()`) within `[FROM, TO]`. No backlog bleed.
- `due_date` comes from Supabase as `"YYYY-MM-DDT00:00:00+00:00"` — always truncated to `YYYY-MM-DD` via `.substring(0, 10)` before comparison. This is safe for DATE columns only.
- **Colombia timezone fix (2026-03-27):** All `timestamptz` columns (`completed_at`, `created_at`, `updated_at`) now use `toColombiaDate()` instead of `.substring(0, 10)`. The substring extracts the UTC date, which can differ from the Colombia date (UTC-5) for timestamps between midnight and 5AM UTC. Date range helpers (`getDayRange`, `getWeekRange`, `getMonthRange`, `getDateRange`) now use fixed UTC-5 offset (`colombiaStartOfDay`/`colombiaEndOfDay`) for identical behavior on dev (local TZ) and Vercel (UTC). `todayStr` uses `getTodayColombia()`.
- **"Midnight Boundary Trap" fix (2026-03-27):** `range=custom` with same start/end date (e.g., `from=2026-03-27&to=2026-03-27`) now uses `colombiaEndOfDay()` which maps to `T04:59:59.999Z` of the next UTC day, correctly including all completions until 11:59 PM Colombia time.
- `getWeekRange()` spans Monday through Sunday (full ISO week, Colombia-aware).
- `getMonthRange()` spans 1st through last day of month, Colombia-aware.
- `isOverdue()` (single source: `src/lib/tasks/filters.ts`): compares `YYYY-MM-DD` strings — today is NOT overdue, only past dates. Excludes `completed` and `blocked` tasks. All 3 dashboard drill-down tables use this function (no inline re-filtering).
- Overdue pill UI: drill-down tables render overdue due dates with `<Badge variant="danger-neon">` + Clock icon (True Neon LED).
- Category/type filter sanitization: `"all"`, `"Todas"`, `"Todos"` → `undefined` (via `sanitizeFilter()` in API routes). Prevents `.eq('category_id', 'all')` from excluding null-category tasks.
- Defense-in-depth: JS `.filter(t => t.assigned_to === user.id)` after Supabase query (RLS lets admins see all tasks).
- `formatDate()` in all 3 dashboard components parses `due_date` as local date (`new Date(y, m-1, d)`) to avoid UTC-5 timezone shift.

**Admin multi-select user filter (added 2026-03-25):**
- `AdminMultiSelect` (`src/components/dashboard/admin-multi-select.tsx`): `"use client"` dropdown with checkboxes, avatars, URL state via `window.history.replaceState` (not `router.replace` — avoids server re-render that would close dropdown and lose options).
- URL format: `?users=id1,id2` (comma-separated). Empty = all users.
- Server component (`admin/page.tsx`): two separate queries — (1) all active users (immutable, for dropdown options), (2) `calculateAllMembersMetrics` with optional `userIds` filter.
- `TeamOverview` receives `allUsers` prop (immutable) + `metrics` (filtered). `userOptions` derived from `allUsers`, never from `metrics`. Local `useState` for `selectedUserIds` + `onChange` callback from `AdminMultiSelect`. Client-side fetch passes `users` param to API for server-side filtering.
- `calculateAllMembersMetrics` accepts optional `userIds?: string[]` — applies `.in('id', userIds)` to users query when provided.

**Time display (fixed 2026-03-25):**
- `time_spent` stored as minutes in DB. `formatTimeSpent()` (`src/lib/utils.ts`) converts to "Xh Ym" format.
- All dashboard tables (member-detail, personal-dashboard, team-overview) use `formatTimeSpent()` — never raw concatenation.

## 4. Bonuses (Hito 5 — 9/10)

Gamified point system per launch. 7 tabs (admin): Simulador, Historial, Ranking, Mis Puntos, Registrar, CEO Dashboard + member filter. Member view: 3 tabs (Mi Proyeccion, Ranking, Mis Puntos).

- Math engine: `src/lib/bonuses/calculator.ts` — `calculateBonuses(revenue, marginPct, poolPct, members)`. BASE_WEIGHT=10, clamp 0.3%-1.5% of NetProfit, max 50 iterations. Weights clamped to `Math.max(0, ...)`, totalWeight to `Math.max(0.1, ...)`.
- Client: `bonuses-client.tsx` — Admin gets all tabs. Registrar only for `super_admin`. CEO Dashboard only for `super_admin`/`ceo` (hidden from `member` role entirely).
- API:
  - `/api/bonuses` — GET (launches + events grouped), POST (create launch + payment events)
  - `/api/bonuses/events` — GET (filtered), POST (super_admin registers point event). Rejects events for closed launches (HTTP 400)
  - `/api/bonuses/[id]/close` — PUT (super_admin closes with revenue_real + margen_real, inserts `settlement` events with frozen `final_bonus_amount`)
- Event types (full DB check constraint): `task_completed`, `early_delivery`, `late_delivery`, `quality_bonus`, `initiative`, `collaboration`, `streak`, `penalty`, `adjustment`, `settlement`, `kpi_weekly`, `daily_close`, `missed_daily_close`
- **Idempotency guard (patched 2026-03-27, Rule 30 hardened 2026-03-28):** `POST /api/bonuses/events` queries for identical event (`launch_id` + `user_id` + `event_type`) created within the last 10 seconds before INSERT. Returns `409 Conflict` on duplicate. **`.eq('points', points)` was REMOVED** from dedup — per Rule 30, two legitimate events can share the same point value, causing false-positive deduplication. Business key for manual events is type+user+launch within the time window, not the point value.
- **Atomic launch creation (patched 2026-03-27):** `POST /api/bonuses` inserts launch then events. If event INSERT fails, the orphan launch is deleted (`.delete().eq('id', newLaunch.id)`) before returning 500. No orphan rows.
- Cierre contable: Closed launches persist `final_bonus_amount` on settlement events. Historial reads frozen values. Closed launches reject new events at API and RLS level.
- Pending: cross-launch comparison chart (moved to Hito 8)

**Registrar tab — event type restrictions (CRITICAL — enforced at API level since 2026-03-28):**
`POST /api/bonuses/events` accepts ONLY `MANUAL_REGISTRATION_EVENT_TYPES`: `['quality_bonus', 'initiative', 'collaboration', 'penalty', 'adjustment']`. Any other value returns **400 Bad Request**.

All automated event types are **strictly forbidden** at the API level:
- `task_completed`, `early_delivery`, `late_delivery`, `streak` → task gamification engine (`ledger-service.ts`)
- `settlement` → launch-close workflow (`/api/bonuses/[id]/close`)
- `kpi_weekly` → `POST /api/kpis/submit`
- `daily_close`, `missed_daily_close` → `evaluateGhostClose()` in `ledger-service.ts`

Injecting any of these types manually would cause point duplication and score inflation. The backend is the enforcement layer — UI dropdown restrictions are not sufficient on their own. Additional bounds: `points` ±9999, `description` ≤500 chars.

**CEO Dashboard tab (`AdminDistribution` component — `src/components/bonuses/admin-distribution.tsx`):**
- Admin-only financial distribution view: Miembro | Puntos | % del Pool | Pago Estimado
- Uses **direct aggregated point math** (NOT `calculateBonuses()`). The server component in `bonos/page.tsx` pre-aggregates `bonus_events` SUM per user (BFF pattern) and passes `TeamRankingEntry[]` as `ranking` prop. Client-side `useMemo` computes:
  - `totalGlobalPoints = sum(ranking[].totalPoints)` — div/0 guarded
  - `sharePct = (userPoints / totalGlobalPoints) * 100` — displayed with 2 decimal places
  - `projectedPayout = (userPoints / totalGlobalPoints) * totalPool`
- `calculateBonuses()` is intentionally NOT used here — it returns `null` when `revenue_bruto`/`margen_neto_pct`/`pool_pct` are missing, silently showing 0% for everyone. Direct math always renders real data from existing points.
- "Ver como:" member filter dropdown in "Mi Proyeccion" tab lets admin impersonate any member's projection view
- `ProjectionView` accepts `viewUserId?: string` + `viewEstimatedBonus?: number | null` props for impersonation without component duplication

**Gamification Engine (added Hito 5.7 — 2026-03-28):**
- `src/lib/gamification/task-scoring.ts` — Pure scoring engine. 4 matrices (A/B/C/D) by impact × effort. All math server-side, COT-aware
- `src/lib/gamification/ledger-service.ts` — Only gateway for automated `bonus_events` writes. Admin client only. `processTaskCompletion` deduplicates by `metadata->>task_id` + 10s window (NOT by `points` — Rule 30). `evaluateGhostClose` deduplicates by full-day COT range. **Both functions are wrapped in a top-level `try/catch` (added 2026-03-29):** `getActiveLaunch()` and Supabase queries can throw unexpected network exceptions (DNS/TLS timeout). Without the guard, an exception propagates to the `waitUntil()` caller and surfaces as `UnhandledPromiseRejection` on Vercel; worse, if `evaluateGhostClose` is called during a Server Component page load, an uncaught throw returns a 500 to the user. Both functions now always return their typed result objects — they never throw.
- Activity log backfill: trigger writes `impact = NULL` for completed tasks (Migration 019). API backfills `+{finalScore} pts` via `waitUntil(adminClient.update(...))` after scoring
- Lazy Evaluation: `evaluateGhostClose()` auto-closes missed daily check-ins with `auto_closed = true` on any page load (Migration 020)

## 5. Daily Check-in / "Cierre de Día" (Hito 4 — Phase Final)

Manual end-of-day accountability with auto-calculated quantitative metrics and required qualitative summary.

- **Table:** `daily_checkins` (migration 009 + 010) — `id` uuid PK, `user_id` FK, `checkin_date` date (default CURRENT_DATE), `hours_worked` numeric, `fires_handled` int, `blocks_count` int, `summary` text, `completion_pct` numeric (default 0). UNIQUE(user_id, checkin_date).
- **API:** `GET/POST /api/checkins/today` — `force-dynamic`. Uses `createAdminClient()` for both read and write (RLS SELECT policy doesn't resolve correctly with anon client for this table). GET auto-calculates: sum `time_spent` of today's completed tasks → `hours_worked`, count `task_type='incendio'` → `fires_handled`, count `status='blocked'` → `blocks_count`, completed/total non-archived → `completion_pct`. Returns `{ is_closed, metrics|checkin }`.
- **POST zero-trust (patched 2026-03-27, hardened 2026-03-28):** POST accepts ONLY `summary` from the client body (string, max 2000 chars). All numeric metrics (`hours_worked`, `fires_handled`, `blocks_count`, `completion_pct`) are **recalculated server-side** from the tasks table — never trusted from the client. Since 2026-03-28: payload explicitly **rejects** any of these fields with `400 Bad Request` (not just ignores them). JSON parsing wrapped in try/catch (returns 400 on malformed body).
- **Double-click idempotency pre-check (patched 2026-03-28):** POST now queries `daily_checkins` for today's record BEFORE executing the 3 metric calculation queries. If the record exists, returns 409 immediately at 1-query cost. Previously, a double-click would execute 3 DB queries (tasks completed, blocked count, total count) before hitting the INSERT unique constraint — wasteful and UX-confusing.
- **Timezone fix (patched 2026-03-27):** POST explicitly passes `checkin_date: getTodayColombia()` in the INSERT instead of relying on Postgres `DEFAULT CURRENT_DATE` (UTC). This fixes a bug where check-ins created between 7pm-midnight Colombia time (00:00-04:59 UTC next day) would store with the wrong UTC date, breaking the UNIQUE constraint's protection against duplicates and causing the GET endpoint (which queries by Colombia date) to never find them.
- **RLS:** Members read/insert own. Admins read all. In practice, API uses admin client due to `get_user_id()` resolution issue with anon client on this table.
- **Personal dashboard:** `DailyCheckinModal` — completion ring SVG (color-coded: green ≥80%, orange ≥50%, red <50%) + 3-col metrics grid (read-only) + mandatory summary textarea. Opens from "Cerrar Día" button in hero. On success, UI switches to "Día Cerrado" badge without page reload. Fetch uses `cache: "no-store"`.
- **Admin dashboard:** `AdminCheckinsWidget` in `TeamOverview` — per-user row with avatar, status badge (Cerrado/Pendiente), mini CompletionRing SVG, metrics summary, summary text. `rawCheckins` passed from server (ALL, no date filter), filtered client-side in `useMemo` by active `dateRange` state (day/week/month/custom). Dynamic title based on date range.

## 6. KPI Tracking & Gamification Engine (Hito 5 — 2026-03-28)

Weekly KPI self-reporting system. Members fill KPIs, submit before Sunday 23:59 COT, and earn points that flow into the active `bonus_launch`. Routes: `/kpis` (member), `/admin/kpis` (admin).

**Data model:**
- `kpi_definitions` — Admin configures each KPI: name, data_type (number|boolean|percentage), direction (asc|desc), target_value, max_points, assigned_to (one user per definition), is_active
- `kpi_tracking` — Member's raw values per KPI per week: UNIQUE(user_id, kpi_id, week_start)
- `kpi_submissions` — One envelope per member per week: status (draft|submitted), total_points, max_possible, bonus_event_id FK. UNIQUE(user_id, week_start)

**Scoring engine (`src/lib/kpis/scoring.ts` — pure functions, zero side effects):**
- `scoreKpi(definition, tracking)` — single KPI score
  - `asc` (higher=better): `min(value/target, 1.0) × max_points`. Boolean: value ≥ 1 → max_points, else 0
  - `desc` (lower=better): value ≤ target → max_points (full score). value > target → linear decay: `max(0, max_points × (1 − (value−target)/target))`. target=0 = zero-tolerance. Boolean: value=0 → max_points
- `calculateKpiScores(defs, entries)` → `{ perKpi[], total, maxPossible }` — builds O(1) tracking map, maps all definitions, rounds to 2 decimal precision

**Deadline enforcement (COT = UTC−5, no DST):**
- Week = Monday 00:00 COT → Sunday 23:59:59.999 COT
- `week_start` column always stores the Monday date as YYYY-MM-DD
- `getDeadlineUtc(weekStart)` = `${nextMonday}T04:59:59.999Z` — server-side computation only
- `isBeforeDeadline(weekStart)` — server call before every submit. Absence of `submitted` status = 0 pts (no cron needed)
- Client: deadline UTC string passed as prop, countdown uses `Date.now()` only to measure ms remaining

**State machine:**
```
NO_ENTRY → DRAFT (status='draft') ←→ DRAFT (update values via PUT /tracking)
DRAFT → SUBMITTED (status='submitted') — frozen, immutable
EXPIRED (deadline passed, not submitted) → 0 pts, no bonus_event
```

**Submit flow (`POST /api/kpis/submit`):**
1. Auth + validate week_start (must be Monday YYYY-MM-DD)
2. Check `isBeforeDeadline()` — reject if expired
3. Idempotency: reject 409 if `kpi_submissions.status = 'submitted'`
4. **Zero-Trust payload guard**: rejects body fields `points, total_points, max_possible, score, user_id, submitted_at, status, bonus_event_id` with 400. Scoring is always server-side.
5. **Fetch active definitions FIRST** (moved before entries upsert — hardened 2026-03-28): definitions fetched before any DB write so entry `kpi_id` values can be validated against `assignedKpiIds = new Set(definitions.map(d => d.id))`. Rejects 400 if any `kpi_id` is not assigned to the authenticated user (prevents foreign kpi_id pollution in audit trail).
6. **Race condition fix + bounds**: if `entries[]` in body (max 50 entries, `Number.isFinite()` value check) → UPSERT to `kpi_tracking` BEFORE scoring (fixes Submit-without-SaveDraft getting 0 pts). kpi_id ownership already validated in step 5.
7. Fetch tracking from DB (now includes just-upserted entries)
8. `calculateKpiScores()` → `total_points`
9. Find active/projected `bonus_launch` → INSERT `bonus_events` (type: `kpi_weekly`). **Dedup: full COT week range** (`${week_start}T05:00:00Z` → `${week_start+7d}T05:00:00Z`) — NOT a 10-second window. Guarantees 1 `kpi_weekly` event per user per launch per week regardless of double-clicks or concurrent requests.
10. UPSERT `kpi_submissions` as `submitted`. Atomic: on failure, delete bonus_event (rollback)
11. `waitUntil(logActivity(..., { targetName: 'KPI Semanal', impact: 'positive' }))` — required for ActivityLogFeed (filters WHERE target_name IS NOT NULL)

**Admin UI (`/admin/kpis` — `AdminKpisClient`):**
- Tab "Definiciones": Create form (assigned_to, name, data_type, direction selector: "Más es mejor" / "Menos es mejor", target_value, max_points, description). Toggle `is_active` (ToggleRight/ToggleLeft). Soft-delete: deactivates if tracking history exists, hard-deletes otherwise
- Tab "Seguimiento Semanal": Week navigator (← / → arrows, prev/next week, → disabled on current week). Member name filter. Expandable rows — click member → `GET /api/kpis/tracking?week_start=X&user_id=Y` (lazy fetch, cached in `useRef(Map)` by `${weekStart}-${userId}` key). Expanded panel shows per-KPI: name, target, submitted value, earned/max pts, running total
- Week change: `Promise.all` fetches all users in parallel (max 6 calls), pre-fills the cache so expanded rows are instant after navigation

**Member UI (`/kpis` — `KpisClient`):**
- Server page computes `deadlineUtc`, `serverDeadlinePassed` server-side — never rely on client dates for deadline enforcement
- 4 states: `NO_KPIS` (empty state), `SUBMITTED` (read-only table with per-KPI breakdown + bonus link indicator), `EXPIRED` (banner: 0 pts, no submission), `ACTIVE` (editable form)
- Input widgets: `boolean` → Sí/No toggle buttons (active state: success/danger). `number`/`percentage` → `<Input type="number">`
- Boolean init fix: `String(t.value)` ensures DB numeric `1`/`0` compares correctly against toggle strings `"1"`/`"0"`
- Live scoring: `useMemo` over `calculateKpiScores` on `values` state → real-time pts display. O(1) `liveScoreMap` for per-row scores
- Guardar Borrador: `PUT /api/kpis/tracking` — upserts values, creates/updates `kpi_submissions` as `draft`. Updates `trackingData` + `submission` state
- Enviar Definitivo: `POST /api/kpis/submit` with `{ week_start, entries: [...current values...] }`. On success: updates `submission`, syncs `trackingData` from form values (UI desync fix)
- Countdown: `useEffect` + `setInterval(1000)`, color-coded (green >24h, yellow >1h, red ≤1h). `suppressHydrationWarning` on countdown span

**Activity Log integration:**
- KPI submissions appear in `ActivityLogFeed` with badge "Positivo" (green)
- `ActivityLogFeed.getImpactStyle()` maps semantic strings: `"positive"` → green `#00e676`, `"negative"` → red. `getImpactLabel()` localizes: `"positive"` → "Positivo", `"negative"` → "Negativo", `"neutral"` → "Neutral"

**RLS policies (hardened in migration 021 — 2026-03-28):**
- `kpi_definitions`: SELECT all authenticated; INSERT/UPDATE/DELETE admin only
- `kpi_tracking`: SELECT own or admin; INSERT own (blocked for submitted weeks — subquery guard); UPDATE own AND NOT EXISTS submitted submission for that week (freeze guard). Prevents retroactive value tampering after scoring is locked in `bonus_events`.
- `kpi_submissions`: SELECT own or admin; INSERT own; UPDATE member: USING `status='draft'` AND WITH CHECK `status='draft'` (blocks direct PostgREST escalation to 'submitted' — only `createAdminClient()` can set submitted); UPDATE admin: unrestricted WITH CHECK for corrections.
- `daily_checkins`: SELECT own or admin; INSERT own (no UPDATE for members — check-ins are immutable after creation); UPDATE admin only (new in 021, for manual corrections).

**FK ON DELETE (corrected in migration 021):**
- `kpi_tracking.user_id` → CASCADE (was RESTRICT — blocked user deletion)
- `kpi_submissions.user_id` → CASCADE (was RESTRICT)
- `kpi_submissions.bonus_event_id` → SET NULL (was RESTRICT — blocked bonus_event deletion during score corrections)

## 7. Calendar (Hito 7 — Pending)

Bidirectional Google Calendar sync. Route: `/calendario`

## 7. Notifications (Hito 8 — Pending)

App exposes API endpoints. n8n calls them on schedule (3pm/6pm/11pm/Sunday).

**Webhook Dispatcher (pre-built for Hito 8):**
- `src/lib/webhooks/dispatcher.ts` — Resilient fire-and-forget webhook module. Already integrated in `PUT /api/tasks/[id]` (task-completed, task-assigned events). Remaining endpoints (`POST /api/bonuses/events`, `POST /api/checkins/today`, `POST /api/tasks`) ready for one-line `waitUntil(notifyXxx(...))` integration during Hito 8.
- Typed helpers: `notifyTaskCompleted()`, `notifyTaskAssigned()`, `notifyBonusEvent()`, `notifyCheckinSaved()`. New events can be added by creating a helper function + calling `dispatchWebhook(eventName, payload)`.
- Pattern: `waitUntil` + `AbortController(5s)` + error swallowing. Never blocks the API response. See [ARCHITECTURE.md](ARCHITECTURE.md#webhooks--async-side-effects-audit-2026-03-27) for full technical spec.
