# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Internal team management web app for Nico Barrera Academy × Mind Fuel (6-person team). Replaces Trello. Unifies task management, performance tracking, gamified bonus system, and calendar. Team communicates via Discord — the app integrates with Discord for auth and notifications.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| UI Components | shadcn/ui (dark mode) |
| Drag & Drop | @dnd-kit/core |
| Charts | Recharts |
| Calendar | react-big-calendar or FullCalendar |
| Database | Supabase (PostgreSQL) |
| Realtime | Supabase Realtime |
| Auth | Discord OAuth via Supabase Auth (whitelist only) |
| Calendar Sync | Google Calendar API (bidirectional) |
| Deploy | Vercel |
| Cron Jobs | Vercel Cron + n8n |
| Notifications | n8n → Discord Bot (Lau) |
| PWA | next-pwa |

## Build & Dev Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit     # Type check without building
```

## Architecture

### App Structure (Next.js App Router)

```
src/app/
  (auth)/login/          # Discord OAuth login
  (auth)/callback/       # OAuth callback
  (dashboard)/           # Protected layout with sidebar
    page.tsx             # Personal dashboard (member view)
    tasks/               # Kanban board + CRUD
    bonuses/             # Simulator, Register, Ranking tabs
    calendar/            # Google Calendar sync
    admin/
      dashboard/         # Global team metrics
      member/[id]/       # Individual member drill-down
      recurrences/       # Recurring task templates
  api/
    tasks/               # CRUD endpoints
    bonuses/             # Launch + events endpoints
    reports/             # Daily/weekly report generation
    cron/                # Vercel Cron: generate recurring tasks (6am)
```

### Key Domains

1. **Tasks** — Kanban (pending/in_progress/completed/blocked), subtasks, comments, attachments, categories, search + advanced filters, auto-priority escalation near deadlines
2. **Recurring Tasks** — Admin creates templates with frequency (daily/weekly/biweekly/monthly). Cron generates instances at 6am. Paused for absent members.
3. **Performance** — Auto-calculated from tasks: % completion, avg speed, streak, overdue count. Admin dashboard with global view + per-member drill-down.
4. **Bonuses** — Gamified point system per launch. Events (+/-) registered by super_admin only. Pool = revenue × margin% × pool%. Distribution: (base + points) / total, clamped 0.3%–1.5%. Projection mode during launch, real billing on close.
5. **Calendar** — Bidirectional Google Calendar sync. Tasks with due dates appear as events. Admin sees consolidated team view.
6. **Notifications** — App exposes API endpoints. n8n calls them on schedule (3pm reminder, 6pm second reminder, 11pm daily report, Sunday weekly summary). Real-time via webhooks for task assignments and overdue alerts.

### Roles & Access

| Role | Access |
|------|--------|
| `super_admin` (Juan David V.) | Full access. Only role that can register bonus events. |
| `ceo` (Nico Barrera) | Read access to all dashboards/bonuses. Cannot register bonus events. |
| `member` | Own tasks, own performance, own bonus position, own calendar. |

Auth uses Discord OAuth with a whitelist — only 6 approved Discord IDs can log in.

### Database Schema (Supabase)

Core tables: `users`, `tasks`, `task_comments`, `task_recurrences`, `task_categories`, `bonus_launches`, `bonus_events`, `daily_reports`, `activity_log`, `user_absences`

RLS enforced: members see only their own data. Admin/CEO see all.

SQL definitions in `supabase/schema.sql` (DDL), `supabase/seed.sql` (initial data), `supabase/rls.sql` (policies). Run these in Supabase SQL Editor in order.

### Key Lib Files

- `src/lib/types.ts` — All TypeScript interfaces + `Database` type map for Supabase client generics
- `src/lib/constants.ts` — Roles, statuses, priorities, nav items, bonus config, default categories
- `src/lib/supabase/database.ts` — Helpers: `getCurrentUser()`, `isAdmin()`, `isSuperAdmin()`, `logActivity()`
- `src/lib/supabase/client.ts` — Browser client (use in `"use client"` components)
- `src/lib/supabase/server.ts` — Server client (use in Server Components, route handlers)
- `src/lib/supabase/admin.ts` — Service role client (bypasses RLS, use in API routes/cron only)

### Notification Architecture

```
App (Next.js API) ←→ n8n workflows ←→ Discord Bot (Lau)
```
- n8n handles all scheduling (cron) and Discord message delivery
- App provides data endpoints, n8n orchestrates communication
- No separate discord.js bot server needed

## Design System

- **Dark mode only** — professional enterprise look (Notion dark aesthetic)
- Palette: background `#0f0f0f`/`#1a1a2e`, cards `#16213e`/`#1e1e2e`, accent pink/red `#e91e63`, success green `#00e676`, text `#e0e0e0`
- Mobile-first responsive. PWA installable.
- Loading: skeleton screens. Errors: clear messages, never white screens. Empty states: friendly messages.

## Behavioral Rules

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary — prefer editing existing
- NEVER proactively create documentation files unless explicitly requested
- NEVER save working files, text/mds, or tests to the root folder
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files
- ALWAYS run tests after making code changes
- ALWAYS verify build succeeds before committing

## File Organization

- `/src` — source code (Next.js App Router)
- `/supabase` — SQL schema, seed data, RLS policies
- `/docs` — project plans and documentation
- `/public` — static assets, PWA manifest, icons

## Concurrency Rules

- All related operations MUST be parallel in a single message
- ALWAYS batch ALL todos in ONE TodoWrite call
- ALWAYS batch ALL file reads/writes/edits in ONE message
- ALWAYS batch ALL Bash commands in ONE message

## Swarm Orchestration (Ruflo V3)

- Use hierarchical topology for coding swarms, max 6-8 agents
- Use specialized strategy for clear role boundaries
- ALWAYS use `run_in_background: true` for agent Task calls
- After spawning agents, STOP — do NOT poll or check status
- When results arrive, review ALL before proceeding

```bash
npx ruflo@latest swarm init --topology hierarchical --max-agents 8 --strategy specialized
npx ruflo@latest doctor --fix
```

### 3-Tier Model Routing

| Tier | Handler | Use Cases |
|------|---------|-----------|
| 1 | Agent Booster (WASM) | Simple transforms — skip LLM |
| 2 | Haiku | Simple tasks, low complexity (<30%) |
| 3 | Sonnet/Opus | Complex reasoning, architecture (>30%) |

## MCP Servers

- `claude-flow` — Ruflo V3 orchestration (swarm, memory, agents, hooks)
- `claude-mem` — Persistent memory across sessions

## Support

- Ruflo: https://github.com/ruvnet/claude-flow
- Issues: https://github.com/ruvnet/claude-flow/issues
