# Plan de Vuelo — Equipo Nico Barrera

## Contexto

App interna para 6 personas. Reemplaza Trello y unifica tareas, rendimiento, bonos gamificados y calendario. Stack: Next.js 14 + Supabase + Discord OAuth + Vercel. Bot "Lau" existente en n8n.

> **Arquitectura detallada** -> [ARCHITECTURE.md](ARCHITECTURE.md)
> **Módulos por dominio** -> [DOMAIN_MODULES.md](DOMAIN_MODULES.md)

---

## Progreso

| Hito | Estado | Fecha |
|------|--------|-------|
| 1. Fundacion | DONE | 2026-03-23 |
| 2. Tareas CRUD | DONE | 2026-03-23 |
| 3. Tareas Repetitivas | DONE | 2026-03-23 |
| 4. Dashboard + Rendimiento | DONE | 2026-03-23 |
| 5. Sistema de Bonos | 9/10 (falta comparativo cross-launch -> Hito 8) | 2026-03-24 |
| 5.5 Ajustes Operativos | DONE | 2026-03-24 |
| 5.6 KPI Tracking & Gamification Engine | **DONE** | 2026-03-28 |
| 5.7 Gamification Hardening | **DONE** | 2026-03-28 |
| 6. Metricas de Auditoria | DONE | 2026-03-25 |
| 6.5 Security Audit & Hardening | DONE | 2026-03-27 |
| 6.6 Database Performance Audit | DONE | 2026-03-27 |
| 6.7 React Performance Audit | DONE | 2026-03-27 |
| 6.8 Async Resilience Audit | DONE | 2026-03-27 |
| 6.9 MVP Scope Lock & Wiring | **DONE** | 2026-03-28 |
| 6.10 Zero-Trust & Concurrency Audit | **DONE** | 2026-03-28 |
| 6.11 DB Integrity Audit (Migration 021) | **DONE** | 2026-03-28 |
| 6.12 Zero-Trust API Hardening II | **DONE** | 2026-03-28 |
| 6.13 Backend Resilience Audit | **DONE** | 2026-03-29 |
| 6.14 React Performance Deep Audit | **DONE** | 2026-03-29 |
| 7. Refinamiento & Dashboards | Pendiente | — |
| 8. Calendario + Google | Pendiente (Calendario deferred to V2 — removed from nav) | — |
| 9. Discord Notificaciones | Pendiente | — |
| 10. Polish + Deploy | Pendiente | — |

---

## Mejoras Sugeridas (Roadmap Futuro)

Ideas originales que NO estaban en el documento base del cliente. Algunas ya implementadas, otras pendientes:

| # | Mejora | Estado |
|---|--------|--------|
| 1 | Comentarios en tareas | DONE (Hito 2) |
| 2 | Subtareas | DONE (Hito 2) |
| 3 | Adjuntos/Links en tareas | DONE (Hito 2) |
| 4 | Modo ausencia/vacaciones | DONE (Hito 3) |
| 5 | Auto-escalamiento de prioridad | DONE (Hito 2, backend-only) |
| 6 | Resumen semanal Discord | Pendiente (Hito 7) |
| 7 | PWA instalable | DONE (manifest.json, Hito 1) |
| 8 | Realtime Supabase | Pendiente (Hito 8) |
| 9 | Historial de actividad (Audit Log + Timeline UI) | DONE (Hito 2 base + Hito 4 timeline + hybrid pagination + trigger enhanced) |
| 10 | Exportar reportes PDF/CSV | Pendiente (Hito 8) |
| 11 | Creacion rapida tareas desde Discord | Pendiente (Hito 7, opcional) |
| 12 | Preferencias de notificacion | Pendiente (Hito 7) |
| 13 | Comparativo entre lanzamientos (Bonos) | Pendiente (Hito 8) |
| 14 | Facturacion real vs Proyeccion | DONE (Hito 5) |
| 15 | Busqueda global | Pendiente (Hito 8) |
| 16 | Filtros avanzados en tareas | DONE (Hito 2) |
| 17 | Dashboard admin desglosable + multi-select | DONE (Hito 4) |
| 18 | Historial de puntos por miembro | DONE (Hito 5) |
| 19 | Barra de marcadores personales | Pendiente (Hito 9) |
| 20 | Metricas de auditoria (impacto, estimaciones, causa raiz bloqueos) | DONE (Hito 6) |
| 21 | Dashboard admin como panel de auditoria (3 widgets interactivos) | DONE (Hito 6) |
| 22 | Cierre de Día (Backend + API) — Tabla `daily_checkins` + endpoints GET/POST | DONE (Hito 4) |
| 23 | Cierre de Día (Frontend) — Modal con anillo SVG + admin widget con CompletionRing + filtrado client-side por dateRange | DONE (Hito 4) |
| 24 | UI Design System — Componentes reutilizables (Card, Button, Badge, Input) + tokens semánticos Tailwind + eliminación de hex hardcodeado | DONE (Hito 4/9) |
| 25 | Colombia Timezone Fix — `toColombiaDate()` reemplaza `.substring(0,10)` en timestamps, date ranges con offset UTC-5 fijo | DONE (Hito 4) |
| 26 | React Performance Audit — `React.memo` + `useMemo` + `useCallback` en Kanban. Eliminación de cascada de re-renders durante drag-and-drop | DONE (Hito 6.7) |
| 27 | Async Resilience Audit — Webhook Dispatcher (`waitUntil` + `AbortController` 5s + error swallowing) para prevenir 504 timeouts al integrar n8n. Pre-built para Hito 8 | DONE (Hito 6.8) |
| 28 | Activity Log Eventual Consistency — backfill de score real post-gamificación vía `waitUntil` UPDATE. Trigger pasa de `'+5 pts'` hardcodeado a `NULL` (Migration 019) | DONE (Hito 5.7) |
| 29 | Ghost Close Auto-Checkin — `evaluateGhostClose()` cierra el día en `daily_checkins` con `auto_closed=true` además del penalty en `bonus_events`. Elimina días zombi en auditoría admin (Migration 020) | DONE (Hito 5.7) |
| 30 | CEO Dashboard + Impersonación — Pestaña financiera admin-only: distribución del pool por miembro (math directa sobre puntos agregados). Filtro "Ver como:" permite al admin ver la proyección de cualquier miembro | DONE (Hito 5.7 + 6.9) |
| 31 | DB Integrity Audit (Migration 021) — 4 nuevos índices B-Tree standalone para `week_start` + `event_type` + `checkin_date`. RLS hardening: `kpi_submissions` WITH CHECK status='draft', `kpi_tracking` freeze guard post-submit. FK ON DELETE: CASCADE en user FKs, SET NULL en `bonus_event_id` nullable | DONE (Hito 6.11) |
| 32 | Zero-Trust API Hardening II — MANUAL_REGISTRATION_EVENT_TYPES allowlist en `POST /api/bonuses/events` (bloquea `task_completed`, `kpi_weekly`, etc.). `kpi_id` ownership validation antes del upsert. `Number.isFinite()` en todos los campos numéricos. Bounds en `description` (500), `title` (500), `block_reason` (2000) | DONE (Hito 6.12) |
| 33 | Backend Resilience Audit — Aislamiento de fallos en el cron loop (`generate-tasks`): `try/catch` por iteración + `generated++` antes de side-effects + `logActivity` y `next_due_date` en bloques aislados. `ledger-service.ts` `processTaskCompletion` + `evaluateGhostClose` con top-level `try/catch` que garantizan retorno de tipos conocidos (nunca lanzan). `console.log` → `console.error` en paths de error | DONE (Hito 6.13) |
| 34 | React Performance Deep Audit — `KanbanColumn` upgrado a `React.memo` con comparador estructural (`id+status+updated_at` por item) — elimina re-renders de columnas no afectadas durante drag. `SortableContext items` via `useMemo` en columna. `TaskCard` comparador extendido con `subtask_count`/`subtask_completed_count`. `Promise.all` en `page.tsx` y `admin/page.tsx` para fetches independientes en paralelo | DONE (Hito 6.14) |

---

## Hitos Completados — Anotaciones Clave

### Hito 1: Fundacion (2026-03-23)

Auth + DB schema + UI shell. Todo listo.

**Fixes post-review:**
- Avatar + name sync desde Discord en cada login (no solo al registrar)
- Middleware anti-loop: si usuario tiene sesion auth pero no esta en whitelist -> signOut + redirect
- PWA `start_url` corregido de `/dashboard` a `/`

### Hito 2: Tareas CRUD (2026-03-23)

Kanban completo con drag & drop, subtareas, comentarios, categorias, busqueda, filtros avanzados.

**Refactoring completo (2026-03-24) — 4 fases:**
1. **DB/API:** Nuevos campos `task_type`, `is_archived`, `time_spent`, `updated_at`. Tabla `task_categories` con CRUD
2. **UI Kanban:** Rewrite con @dnd-kit. Componentes separados: Board, Column, Card
3. **Formularios/UX:** Combobox de categorias (autocomplete + crear + eliminar). Detail panel. TimeSpentModal
4. **Acciones:** Archive vs hard delete. Action menu. DeleteConfirmDialog

**Hotfixes importantes:**
- Category form wipe bug: `useEffect` con `categories` en deps resetaba formulario al crear categoria nueva -> fix: removido de deps
- DB migration pendiente: columnas nuevas en `schema.sql` no aplicadas a Supabase remoto -> siempre generar ALTER TABLE migrations
- **dnd-kit drop target bug (2026-03-25):** Con 3+ tarjetas por columna, el drop caía sobre un `useSortable` (task UUID) en vez del `useDroppable` (column status). `handleDragEnd` enviaba UUID como status al API → 400. Fix triple: (1) `closestCorners` collision detection, (2) `resolveDropColumn()` que resuelve task UUID → column status, (3) droppable `ref` movido al div exterior de la columna

### Hito 3: Tareas Repetitivas (2026-03-23)

Templates con frecuencia + cron diario + ausencias + roles.

**Decisiones clave:**
- Frecuencia `custom` = semanticamente igual a `weekly` pero con flexibilidad de label
- Biweekly compara `next_due_date` para 14+ dias
- `?force=true` en cron NO actualiza `next_due_date` (evita corromper schedule)
- Absencias siempre se respetan, incluso en force mode

**Sesion 3 (2026-03-24):**
- Absence permissions abiertos: members crean/borran propias, admins todas
- Cron force mode: dev bypass de auth + schedule + duplicados
- Category delete inteligente: solo bloquea si hay tareas activas, desvincula archivadas

### Hito 4: Dashboard + Rendimiento (2026-03-23)

Metricas auto-calculadas desde tabla tasks. Dashboard personal + admin + member detail.

**Decisiones clave:**
- Recharts para graficos (no chart.js ni victory)
- Realtime pospuesto a Hito 8 — metricas no son time-sensitive, toggle Semana/Mes refresca bajo demanda
- Patron: page.tsx (server) fetcha datos -> client component maneja state/interactividad

**Hardening session (2026-03-25):**
- Defense-in-depth: JS filter `t.assigned_to === user.id` post-query (RLS admins ven todo)
- React 18 StrictMode: `useRef(true)` en effects rompe con double-invoke → usar `let cancelled = false`
- Supabase DATE columns retornan `"YYYY-MM-DDT00:00:00+00:00"` → siempre truncar a `YYYY-MM-DD` con `.substring(0,10)`. Frontend parsea como fecha local (`new Date(y,m-1,d)`) para evitar shift UTC-5
- `getWeekRange()` abarca lunes-domingo completo (no lunes-hoy)
- API routes: `sanitizeFilter()` convierte "all"/"Todas"/"Todos" a undefined. `force-dynamic` para evitar cache

**Sesion Fase 3 — Ataques Quirurgicos (2026-03-25):**
- **Strict Timebox (#12):** Metricas cambian de backlog-aware a strict timebox. Non-completed: `due_date` en `[FROM, TO]` estricto (sin backlog). Si no hay `due_date`, fallback a `created_at` en `[FROM, TO]`.
- **Date ranges fix (#13):** `getMonthRange()` TO cambia de `endOfDay(now)` a ultimo dia del mes (`new Date(y, m+1, 0)`). Week range ya era correcto (Mon-Sun).
- **isOverdue fix (#14):** `isOverdue()` ahora compara strings `YYYY-MM-DD` (no timestamps). Hoy NO es atrasado. Excluye blocked. Fuente unica en `filters.ts`. Los 3 dashboards usan `isOverdue()` importado en vez de logica inline.
- **Pildora roja (#14):** Tablas drill-down muestran due dates vencidas con badge rojo + Clock icon (misma estetica del Kanban).
- **Admin multi-select:** Nuevo componente `AdminMultiSelect` con dropdown de checkboxes + avatares. URL state via `window.history.replaceState` (evita re-render server). Server component pasa `allUsers` inmutable separado de `metrics` filtradas.

**Sesion Bug-Fix (2026-03-25):**
- **time_spent display fix:** Tablas de historial concatenaban minutos crudos con "h" (ej: 180h en vez de 3h). Nuevo helper `formatTimeSpent()` convierte minutos a "Xh Ym". Aplicado en 4 puntos (member-detail x2, personal-dashboard, team-overview).
- **Member detail reactive history:** Tabla "Historial de Tareas" usaba prop estatica `tasks` del server component (nunca se actualizaba con filtros de fecha). Cambiado a `metrics.tasks_list` (reactivo a filtros). Prop `tasks` eliminada del componente.
- **API /api/performance `users` param:** Team overview ahora pasa `selectedUserIds` al API para filtrado server-side (antes calculaba 6 miembros y filtraba client-side).

**Sesion Activity Log Timeline (2026-03-25):**
- **ActivityLogFeed component:** Timeline vertical reutilizable (`src/components/shared/ActivityLogFeed.tsx`). Avatares, timestamps relativos, badges de impacto, bloques de justificacion opcionales. Recibe datos por props (no fetch interno).
- **DB trigger automatico:** `trg_task_activity` (AFTER UPDATE on tasks) auto-inserta en `activity_log` cambios de status (con labels en espanol + impact tags) y cambios de due_date (con diff de fechas en reason). Usa `NEW.assigned_to` siempre.
- **Hotfix FK (error 23503):** `auth.uid()` retorna UUID de `auth.users`, no de `public.users`. Reemplazado por `NEW.assigned_to`. FK re-creada con `ON DELETE SET NULL`.
- **Validacion de status en API (error 23514):** `PUT /api/tasks/[id]` ahora valida `status` contra `VALID_STATUSES` antes de enviar a DB. Previene check constraint violations por labels en espanol.
- **3 vistas conectadas a datos reales:** Personal (`.eq user_id`), Admin (fetch ALL + filtro client-side por `selectedUserIds`), Member detail (`.eq user_id` del params). Todas con join a `users` para nombre/avatar.
- **Limpieza:** Eliminado componente viejo "Actividad Reciente" de member-detail y personal-dashboard. Solo queda `ActivityLogFeed`.

### Hito 4 — Cierre de Día (2026-03-27)

Feature de accountability cualitativo: "Cierre de Día" manual con métricas auto-calculadas.

**Lo que se hizo:**
1. **DB:** Tabla `daily_checkins` (migration 009) con UNIQUE(user_id, checkin_date) + columna `completion_pct` (migration 010)
2. **API:** `GET/POST /api/checkins/today` — auto-calcula hours_worked, fires_handled, blocks_count, completion_pct desde tabla tasks. Admin client bypasa RLS (fix: anon client no resolvía SELECT correctamente)
3. **Modal:** `DailyCheckinModal` con anillo SVG de completitud (color-coded), grid de métricas read-only, textarea obligatorio para summary
4. **PersonalDashboard:** Integración con botón "Cerrar Día" en hero, badge "Día Cerrado" post-cierre, fetch con `cache: "no-store"`
5. **AdminCheckinsWidget:** Widget de equipo con CompletionRing SVG por usuario, filtrado client-side por dateRange via `useMemo` (no depende de searchParams del server)
6. **Timezone fix:** `getTodayColombia()` en lugar de `new Date().toISOString()` para evitar salto de día en horas nocturnas
7. **RLS bug:** SELECT policy con `get_user_id()` no resolvía para anon client en esta tabla — switched a admin client con autenticación previa vía `getCurrentUser()`

### Hito 5: Sistema de Bonos (2026-03-24) — 9/10

5 tabs: Simulador, Historial, Ranking, Mis Puntos, Registrar.

**Decisiones clave:**
- Residuo como retorno a empresa (Opcion 3): cuando todos los miembros estan clamped, excedente no se redistribuye
- `formatCurrency()` usa locale `es-CO` con formato USD
- Cierre contable congela `final_bonus_amount` en settlement events. Lanzamientos cerrados rechazan nuevos eventos a nivel API y RLS

**Pendiente:** Comparativo cross-launch (grafica Recharts) -> movido a Hito 9

### Hito 5.6: KPI Tracking & Gamification Engine (2026-03-28) — COMPLETO ✓

Motor de KPIs semanales con scoring gamificado conectado al sistema de bonos.

**Lo que se construyó:**

**DB (Migrations 015 + 016):**
- 3 nuevas tablas: `kpi_definitions`, `kpi_tracking`, `kpi_submissions` con RLS completo
- `bonus_events_event_type_check` extendido para incluir `kpi_weekly`
- Columna `direction` (asc|desc) en `kpi_definitions` con DEFAULT 'asc'
- Indexes: `idx_kpi_tracking_user_week`, `idx_kpi_tracking_kpi`, `idx_kpi_submissions_user_week`, `idx_kpi_submissions_status`

**Scoring Engine (`src/lib/kpis/scoring.ts`):**
- `asc`: `min(value/target, 1.0) × max_points`. Boolean: value ≥ 1 → max_points
- `desc`: value ≤ target → max_points. Decay lineal: `max(0, max_points × (1 − (value−target)/target))`. target=0 = zero-tolerance
- Bugs resueltos en QA: (1) `direction` faltaba en SELECT de páginas → fallback a 'asc' para todos; (2) Submit sin Save Draft daba 0 pts (race condition → fix: entries[] en body + upsert antes de score); (3) Badge "positive" no localizado → "Positivo" verde

**API (5 routes):**
- `GET/POST /api/kpis/definitions` + `PUT/DELETE /api/kpis/definitions/[id]`
- `GET /api/kpis/tracking` (admin puede ver cualquier usuario) + `PUT` (upsert draft)
- `POST /api/kpis/submit` — flujo atómico: upsert entries → calcular → bonus_event → submission. Rollback si submission falla
- `GET /api/kpis/history`

**UI Admin (`/admin/kpis`):**
- Formulario de creación con selector "Dirección de la Métrica" (Más es mejor / Menos es mejor)
- Tab "Seguimiento Semanal": navegador de semanas ← →, filtro de miembro, filas expandibles con detalle KPI-por-KPI cacheado en `useRef(Map)`

**UI Member (`/kpis`):**
- Deadline COT calculado server-side, countdown visual con colores semafóricos
- Live scoring en tiempo real con `useMemo`. Guardar Borrador / Enviar Definitivo con confirmación
- Fix: valores boolean inicializan desde DB con `String(t.value)` para comparación correcta con "1"/"0"
- Fix: post-submit sincroniza `trackingData` del estado del form para vista de solo lectura correcta

### Hito 5.7: Gamification Hardening (2026-03-28) — COMPLETO ✓

Motor de gamificación completado con consistencia eventual, auditoría limpia y dashboard financiero para admins.

**Lo que se construyó:**

1. **Activity Log Eventual Consistency (Migration 019):** Se elimina `'+5 pts'` hardcodeado del trigger `log_task_activity`. Las tareas completadas ahora generan `impact = NULL`. `PUT /api/tasks/[id]` backfilla el score real (ej: `+575 pts`) post-gamificación vía `waitUntil(createAdminClient().update(...))` con ventana de 10s — garantizando que la Timeline siempre muestre el puntaje real del motor

2. **Ghost Close Auto-Checkin (Migration 020):** `evaluateGhostClose()` ahora inserta fila `auto_closed = true` en `daily_checkins` además del penalty de 0 pts en `bonus_events`. Elimina el "día zombi" — el admin ve el día oficialmente cerrado en la auditoría. La columna `auto_closed boolean DEFAULT false` permite filtrar cierres manuales vs automáticos

3. **CEO Dashboard + Impersonación:** Nueva pestaña "CEO Dashboard" (`AdminDistribution`) en `/bonos` solo para admins. Tabla financiera: Miembro | Puntos | % del Pool | Pago Estimado. Filtro "Ver como:" permite al admin ver la proyección exacta de cualquier miembro vía `viewUserId` prop en `ProjectionView` — sin duplicar componentes. `selectedMemberBonus` calculado client-side con `useMemo` desde `teamRanking + activeLaunch`

### Hito 6.9: MVP Scope Lock & Wiring (2026-03-28) — COMPLETO ✓

Ajustes finales de UI/lógica antes de deploy a producción. Scope activamente gestionado.

**Lo que se hizo:**

1. **AdminDistribution — Math Real Conectada:** La tabla `AdminDistribution` dejó de usar `calculateBonuses()` (que retornaba null si los parámetros financieros del lanzamiento estaban incompletos, mostrando 0% a todos). Ahora usa math directa sobre los puntos agregados por el servidor: `sharePct = (userPoints / totalGlobalPoints) * 100`, `projectedPayout = (userPoints / totalGlobalPoints) * totalPool`. División por cero protegida. Porcentaje muestra 2 decimales.

2. **RegistrarTab — Sanitización del Dropdown:** El modal de registro manual (`RegistrarTab`, solo `super_admin`) reduce sus tipos de evento permitidos a ÚNICAMENTE `culture_bonus` y `other`. Todos los eventos automatizados (`task_completed`, `kpi_weekly`, `streak`, `early_delivery`, `late_delivery`, `missed_daily_close`) fueron eliminados del dropdown — estos son escritos exclusivamente por el motor de gamificación y el cron. Si se selecciona `other`, la descripción es **obligatoria** con validación en cliente antes del submit.

3. **Calendario — Diferido a V2:** La entrada "Calendario" fue eliminada del array `NAV_ITEMS` en `sidebar.tsx`. Los archivos (`app/(dashboard)/calendario/`) se preservan intactos para V2. Sin visual noise en el MVP.

### Hito 5.5: Ajustes Operativos (2026-03-24)

Reglas de negocio + UX de proceso disciplinado.

**Lo que se hizo:**
1. KPIs: blocked tasks congeladas (no penalizan completion_pct, overdue, streak)
2. Block flow: modal obligatorio con tipo + motivo, guardado como comment
3. Recurrences accesible para todos en `/recurrences` (antes admin-only)
4. Category delete con Trash2, proteccion default, check tareas activas
5. Hard delete solo para super_admin/ceo
6. RLS migration 002: `get_user_id()` + `get_user_role()` helpers
7. Toast feedback verde/rojo en delete de categorias (ambos modals)
8. Cron dev button solo visible en development + admin

### Hito 4 — Fase Final: Coaching + Burn-Up (2026-03-26)

Métricas de coaching individuales y rediseño visual de la vista de miembro.

**Lo que se hizo:**
1. **Coaching Metrics Engine:** 3 nuevos cálculos en `calculateMemberMetrics()` — `avg_estimation_gap` (gap real vs estimado, protección div/0), `fire_ratio` (% incendio sobre completadas), `value_matrix` (clasificación impacto×esfuerzo en 4 cuadrantes con threshold 120min)
2. **Gauge SVG (Precisión de Estimación):** Semicírculo con arcos de color por zonas (-50% a +50%), aguja con glow, valor numérico debajo del pivot. ViewBox 260×150 para evitar solapamiento de textos
3. **Barra de Estrés Operativo:** Gradiente de 3 zonas (azul=control, naranja=alerta, rojo=crítico) con marcadores y labels. Icono dinámico Activity/Flame según nivel
4. **Matriz de Valor 2×2:** Grid con ejes etiquetados (Impacto vertical, Esfuerzo horizontal). Burbujas que crecen proporcionalmente al conteo. Estado vacío con watermarks de objetivo ideal
5. **Burn-Up Chart:** Reemplaza BarChart. Dos áreas acumulativas con gradientes: Scope (azul, basado en `due_date`) y Completadas (verde, basado en `completed_at`). Backlog = espacio visual entre líneas
6. **Burn-Up data fix:** `buildWeeklyData()` recibe `ownTasks` (sin filtro temporal) para acumulado real + `allTasks` (timeboxed) para KPIs. Scope usa `due_date` (fallback `created_at`). Días futuros (> hoy) se mantienen flat sin proyección
7. **Dev Seed Endpoint:** `POST /api/dev-seed?force=true` — 12 tareas con distribución realista de impact/estimación/tipo para validar coaching visualmente. Resuelve `discord_id` → UUID. Dev-only

### Hito 4 — Personal Dashboard "Modo Enfoque" (2026-03-26)

Rediseño completo del dashboard personal para eliminar fatiga de decisión y dar feedback de rendimiento individual inmediato.

**Lo que se hizo:**
1. **Hero "Tu Enfoque Hoy":** Saludo dinámico (hora del día) + top 2 tareas priorizadas por score `impact×10 + priority`. Tarjetas 50% más grandes con descripción, badges de incendio, fecha límite resaltada si atrasada, tags de impacto y estimación
2. **4 Stat Cards interactivos (restaurados):** Completadas, Pendientes, Atrasadas, Bloqueadas — click abre drill-down table con detalle completo (estado, tipo, categoría, prioridad, fecha, tiempo, motivo de bloqueo)
3. **4-column Health Grid:** Anillo de rendimiento (% cumplimiento + racha), Tacómetro de Carga Cognitiva (SVG con zonas verde 1-3/naranja 4-6/rojo 7+ y recomendación dinámica), Precisión de Estimación (gauge semicircular portado de member-detail), Nivel de Estrés (barra fire_ratio portada de member-detail con recomendación contextual)
4. **Valor y Actividad:** Matriz de Valor 2×2 (portada de member-detail) + ActivityLogFeed personal
5. **Eliminado:** LineChart de Recharts (ya no se importa recharts en este componente), stat cards sin drill-down, layout anterior plano

### Hito 4 — Hybrid Pagination + Trigger Enhancement + DnD Fix (2026-03-27)

Paginación híbrida para feeds largos, trigger mejorado para activity log, y fix de drag & drop en Kanban.

**Lo que se hizo:**
1. **Hybrid Pagination:** `ActivityLogFeed` y nuevo `TaskHistoryTable` usan patrón server-20-initial + client "Cargar más". Nuevo endpoint `/api/activity` con soporte multi-usuario (`?users=id1,id2`). API `/api/tasks` extendida con `limit`/`offset`. `useEffect` + `AbortController` para re-fetch reactivo en admin multi-select
2. **Activity Log Trigger (migraciones 011/012):** Status changes ahora loguean "Cambió el estado de [Old] a [New]" con labels en español. `block_reason` capturado automáticamente al mover a blocked. Reescrito NULL-safe con CASE statements (fix de crash por concatenación `||` con NULL en PostgreSQL)
3. **Kanban DnD Fix:** Custom `columnAwareCollision` reemplaza `closestCorners` — usa `pointerWithin` para detectar columnas primero, fallback a `closestCorners`. Resuelve bug donde columnas vacías eran saltadas porque tarjetas compactas en columnas adyacentes ganaban la métrica de distancia. `VALID_STATUSES` como guard a nivel de módulo

### Hito 4 — UI Design System + Colombia Timezone Fix (2026-03-27)

Eliminación masiva de deuda técnica UI y corrección de bugs críticos de timezone.

**Lo que se hizo:**
1. **Design System (`src/components/ui/`):** Creación de 4 componentes base consumidores de tokens — `Card`/`CardHeader`/`CardTitle`/`CardContent`, `Button` (5 variants, 4 sizes, isLoading), `Badge` (shortcuts para status/priority/role), `Input`
2. **Design Tokens en Tailwind:** 30+ tokens semánticos en `tailwind.config.ts` — background, card, border, accent, success, danger, warning, info, status-*, priority-*, role-*, bonus-*. Constantes UI en `src/lib/constants.ts` (`STATUS_COLORS`, `PRIORITY_COLORS`, `ROLE_BADGE_COLORS`, etc.)
3. **Refactor Personal Dashboard:** Reemplazo de ~50 instancias de hex hardcodeado (`bg-[#1e1e2e]`, `text-[#9e9e9e]`, etc.) por tokens semánticos. 7 cards → `<Card>`, todos los buttons → `<Button>`, todos los badges → `<Badge>`. De 1021 a ~920 líneas
4. **Drill-Down UX Fix:** Tabla de completadas ahora muestra AMBAS columnas "Fecha límite" y "Completada el" side-by-side. Color coding: `text-success` si completó antes/en fecha, `text-danger` si completó tarde
5. **Colombia Timezone Fix (Midnight Boundary Trap):** Todas las métricas ahora usan `toColombiaDate()` y `getTodayColombia()` en lugar de `.substring(0,10)` en timestamps. Date range helpers reescritos con offset UTC-5 fijo (`colombiaStartOfDay`/`colombiaEndOfDay`). Idéntico comportamiento en dev local y Vercel UTC
6. **`globals.css` fix:** Clases `@apply` inválidas (`bg-background-card`, `bg-primary`) reemplazadas por tokens correctos

### Hito 6: Metricas de Auditoria Avanzadas (2026-03-25)

Modelo de datos expandido para medir impacto, estimaciones y causas raiz de bloqueos. Dashboard de admin evoluciona a panel de auditoria de procesos.

**Lo que se hizo:**
1. Migracion DB: 4 columnas nuevas en `tasks` — `estimated_time` (int, minutos), `impact` (high/medium/low), `block_type` (internal/external), `block_reason` (text). Index en `impact`
2. Formulario Nueva Tarea: campos obligatorios "Impacto Esperado" (select) y "Tiempo Estimado" (input horas -> minutos). Validacion frontend + backend
3. Logica de bloqueo: `block_type`/`block_reason` se guardan en la fila de la tarea (ademas del comment existente). Se limpian al desbloquear
4. API POST/PUT: validacion de `impact` contra VALID_IMPACTS, `block_type` contra VALID_BLOCK_TYPES, `estimated_time` positivo
5. `MemberMetrics` extendido: `block_audit` ({internal, external}), `impact_distribution` ({high, medium, low}), `avg_lead_time_hours`
6. 3 widgets de auditoria en TeamOverview:
   - **Auditoria de Bloqueos**: barra horizontal apilada (naranja=interno, rojo=externo). Click filtra drill-down
   - **Tiempo de Ciclo Promedio**: stat card con calculo `completed_at - created_at`. Muestra dias si >=24h, horas si <24h
   - **Distribucion de Impacto**: pie chart CSS (conic-gradient). Leyenda clicable filtra drill-down por nivel
7. DrillDownKey extendido: `block_internal`, `block_external`, `impact_high`, `impact_medium`, `impact_low`. Tabla muestra columna "Impacto" + "Motivo" contextual

### Hito 6.5: Security Audit & Hardening (2026-03-27)

Auditoría completa de RLS, validación de payloads API, e idempotencia. 5 vulnerabilidades RLS + 6 issues de API parcheadas.

**Lo que se hizo:**
1. **RLS Audit (Migration 013):** 5 políticas corregidas — (a) Tasks INSERT: `AND` en vez de `OR` impide que members asignen tareas a otros via PostgREST directo, (b) Users UPDATE: split en 2 policies — `super_admin` full update, `ceo` bloqueado de cambiar campo `role` via `WITH CHECK` con subquery, (c) Absences INSERT/DELETE: abierto para members (`user_id = get_user_id()`) además de admin, (d) daily_checkins SELECT: removido rol inexistente `'admin'`
2. **Hard Delete Guard (VULN-1):** `DELETE /api/tasks/[id]?permanent=true` ahora verifica `isAdmin(user)` antes del DELETE. Members reciben 403
3. **Checkins Zero-Trust:** POST `/api/checkins/today` ya no acepta métricas del cliente. Solo acepta `summary` (max 2000 chars). `hours_worked`, `fires_handled`, `blocks_count`, `completion_pct` recalculados server-side desde tabla tasks
4. **Checkins Timezone Fix:** INSERT ahora pasa `checkin_date: getTodayColombia()` explícitamente. Elimina ventana de duplicados entre 7pm-midnight COT causada por `DEFAULT CURRENT_DATE` (UTC)
5. **Bonus Events Idempotency:** POST `/api/bonuses/events` implementa deduplicación por ventana de 10 segundos (mismos `launch_id` + `user_id` + `event_type` + `points`). Devuelve 409 en duplicado
6. **Bonus Launch Atomic Rollback:** POST `/api/bonuses` ahora elimina el launch huérfano si el INSERT de eventos falla, antes de retornar 500
7. **JSON Parsing Safety:** try/catch en `request.json()` del endpoint checkins (único que no lo tenía)

### Hito 6.6: Database Performance Audit (2026-03-27)

Auditoría completa de data fetching: eliminación de over-fetching, N+1 queries, e implementación de índices para Calendar readiness.

**Lo que se hizo:**
1. **Migration 014 — 11 B-Tree Indexes:** `tasks(assigned_to)`, `tasks(assigned_to, status)`, `tasks(due_date)` partial, `tasks(completed_at)` partial, `tasks(created_at)`, `tasks(recurrence_id, created_at)` partial, `tasks(status)`, `tasks(parent_task_id)` partial, `activity_log(user_id, created_at DESC)`, `bonus_events(launch_id)`, `task_comments(task_id, created_at DESC)`
2. **Kill Over-fetching:** `calculateMemberMetrics()` cambia de `select('*')` a 17 columnas explícitas (`TASK_METRICS_COLS`), excluyendo `description` y `attachments` (JSONB pesado). Check-in GET usa `select('time_spent, task_type')`. HEAD-only counts usan `select('id', ...)`. Admin users query usa 6 columnas explícitas
3. **Kill N+1 en CRON:** Query `select('id').eq('recurrence_id', ...)` dentro del `for` loop eliminada. Reemplazada por batch pre-fetch antes del loop → `alreadyGenerated: Set<string>` con O(1) lookup. Reduce de N queries secuenciales a 1 query fija
4. **Admin Check-ins Bounded:** `select("*")` sin límite → `select(7 columnas).gte("checkin_date", thirtyDaysAgo)` con ventana de 30 días

**Reglas establecidas para desarrollo futuro:**
- Rule 16: Zero over-fetching (no `select('*')`)
- Rule 17: N+1 prevention (no queries en loops)
- Rule 18: Index enforcement (toda columna filtrada frecuente debe tener índice)
- Rule 19: Bounded historical queries (ventanas temporales en datos admin)

### Hito 6.7: React Performance Audit (2026-03-27)

Auditoría de rendimiento React del tablero Kanban. Eliminación de cascada de re-renders durante operaciones de drag-and-drop con `@dnd-kit`.

**Diagnóstico:** Cada `setActiveTask()` durante drag causaba re-render de `KanbanBoard` → 4 `KanbanColumn` → ~50 `TaskCard` = ~100 re-renders innecesarios por interacción. Causa raíz: cero `React.memo`, arrays recalculados inline, handlers sin `useCallback`.

**Lo que se hizo:**
1. **`TaskCard` memoizado:** `React.memo` con comparador custom de 14 campos (id, status, updated_at, title, priority, due_date, is_archived, time_spent, block_type, overlay, isAdmin, onClick, onArchived, onDeleted). Evita deep comparison del objeto `task` completo
2. **`KanbanColumn` memoizado:** `React.memo` con shallow comparison por defecto. Funciona porque recibe arrays estables del padre
3. **`columnTasks` via `useMemo`:** Reemplaza función inline `getColumnTasks()`. Single-pass partition en `Record<TaskStatus, Task[]>` con sort condicional. Deps: `[tasks, sortMode]`
4. **10 handlers estabilizados con `useCallback`:** `handleDragStart`, `handleTaskClick`, `handleCreateTask`, `handleTaskSaved`, `handleTaskUpdated`, `handleTaskDeleted`, `handleEditFromDetail`, `handleCategoriesChanged`, `handleModalClose`, `handleDetailClose`
5. **`visibleCount` memoizado:** `useMemo(() => tasks.filter(...).length, [tasks])`
6. **DragOverlay onClick estabilizado:** `() => {}` inline reemplazado por `handleTaskClick` (referencia estable)

**Reglas establecidas para desarrollo futuro:**
- Rule 20: Strict Memoization (React.memo en componentes dentro de .map())
- Rule 21: Reference Equality (useMemo para derived state, nunca inline)
- Rule 22: Stable Handlers (useCallback en toda función pasada como prop)

### Hito 6.10: Zero-Trust & Concurrency Audit (2026-03-28) — COMPLETO ✓

Auditoría profunda de integridad concurrente y Zero-Trust en los 4 write paths críticos. Eliminación de deuda técnica "vibe coding".

**Lo que se hizo:**

1. **Zero-Trust Payload Guards (4 endpoints):** Todos los endpoints de escritura ahora retornan `400 Bad Request` explícito si el cliente envía campos de servidor (métricas pre-calculadas, timestamps, identidad). Antes: campos ignorados silenciosamente (puerta abierta sin alarma). Ahora: `PROHIBITED_FIELDS.filter(f => f in body)` → 400 inmediato.
   - `POST /api/checkins/today`: rechaza `hours_worked`, `fires_handled`, `blocks_count`, `completion_pct`, `user_id`, `checkin_date`, `id`, `created_at`
   - `POST /api/kpis/submit`: rechaza `points`, `total_points`, `max_possible`, `score`, `user_id`, `submitted_at`, `status`, `bonus_event_id`
   - `PUT /api/tasks/[id]`: rechaza `completed_at`, `created_at`, `updated_at`, `created_by`, `id`
   - `POST /api/bonuses/events`: rechaza `registered_by`, `created_at`, `id`, `updated_at`

2. **KPI Weekly Dedup — Ventana de Semana Completa:** La ventana de deduplicación del `kpi_weekly` bonus_event en `POST /api/kpis/submit` fue expandida de 10 segundos a toda la semana COT. Rango: `${week_start}T05:00:00.000Z` → `${week_start+7d}T05:00:00.000Z`. Con 10s, dos requests concurrentes ambos pasaban antes de que cualquiera escribiera → dos bonus_events del mismo tipo para la misma semana. Con la ventana de semana completa, hay exactamente un `kpi_weekly` por usuario por lanzamiento por semana.

3. **Task Completion Dedup por task_id (no por puntos):** En `processTaskCompletion()` de `ledger-service.ts`, el discriminador de deduplicación cambió de `.eq('points', scoring.finalScore)` a `.filter('metadata->>task_id', 'eq', taskData.taskId)`. Motivo: dos tareas distintas pueden tener el mismo score → falso-positivo (tarea legítima rechazada). Más crítico: dos requests concurrentes del mismo task calculan el mismo score, ambos pasan el check, y ambos insertan puntos duplicados. Con task_id como discriminador: el primer insert es el único que puede escribir dentro de la ventana de 10s.

4. **Checkins/today Pre-check (Double-Click Guard):** `POST /api/checkins/today` ahora verifica existencia del checkin ANTES de ejecutar las 3 queries de cálculo de métricas. Double-click anterior: ambas requests calculaban métricas → primera insertaba → segunda chocaba con unique constraint (23505). Ahora: primera request calcula e inserta; segunda hace 1 query (adminSupa.select), encuentra el checkin, retorna 409 — sin desperdiciar las 3 queries. `adminSupa` se instancia una vez al inicio del handler (eliminado el `createAdminClient()` duplicado que existía al final).

5. **Codificación de Reglas (CLAUDE.md):**
   - Rule 29: Zero-Trust Payload Guard — SIEMPRE retornar 400 explícito, nunca ignorar silenciosamente
   - Rule 30: Dedup por ID transaccional, NUNCA por valor de puntos

### Hito 6.8: Async Resilience Audit & Webhook Dispatcher (2026-03-27)

Auditoría de resiliencia asíncrona y construcción del patrón Webhook Dispatcher para preparar la integración con n8n en Hito 8.

**Diagnóstico:** Las API routes de Next.js corren como Vercel Serverless Functions con timeout de 10-15s. Si un endpoint hace `await fetch(n8nUrl)` antes de retornar la response, un n8n lento/caído provoca 504 Gateway Timeout. El Supabase UPDATE ya hizo commit, pero el frontend recibe error y ejecuta rollback optimista — split-brain donde DB dice "completed" pero el Kanban revierte la tarjeta.

**Lo que se hizo:**
1. **Webhook Dispatcher (`src/lib/webhooks/dispatcher.ts`):** Módulo autocontenido. `dispatchWebhook(event, payload)` con `AbortController` de 5s, `try/catch` que traga errores con `console.warn`, y degradación graceful cuando `N8N_WEBHOOK_BASE_URL` no está configurada (dev mode)
2. **Typed helpers:** `notifyTaskCompleted(task, user)`, `notifyTaskAssigned(task, assigneeId, assignedBy)`, `notifyBonusEvent(...)`, `notifyCheckinSaved(...)` — un helper por tipo de evento
3. **Integración en `PUT /api/tasks/[id]`:** Dos `waitUntil()` condicionales inyectados después del activity log — `notifyTaskCompleted` cuando status→completed, `notifyTaskAssigned` cuando assigned_to cambia
4. **Auth webhook:** Header `X-Webhook-Secret` enviado desde `N8N_WEBHOOK_SECRET` env var para autenticar app→n8n

**Reglas establecidas para desarrollo futuro:**
- Rule 23: Never block API responses with external HTTP calls
- Rule 24: All outbound webhooks via `src/lib/webhooks/dispatcher.ts` (waitUntil + AbortController 5s + error swallowing)
- Rule 25: Side-effect ordering: DB commit → logActivity → notifyXxx → return response

---

## Hitos Pendientes — Plan de Ejecucion

### Hito 7: Refinamiento & Dashboards (Próximo)

**Resultado:** Pulir el sistema de bonos + KPIs con lógica de negocio pendiente y UX mejorado.

**Tareas (prioridad alta — deuda técnica identificada en QA):**
1. **Fix RLS Bonus Ranking:** Members actualmente solo pueden ver sus propios puntos en el tab "Ranking". Necesitan ver el ranking completo del equipo para que la gamificación tenga sentido. Actualizar `bonus_events` SELECT RLS para permitir lectura de todos los eventos del launch activo (no solo propios)
2. **Refactor Bonus UI — Vista Proyección:** Reemplazar el simulador manual en el tab "Simulador" por una vista "Proyección" conectada directamente al launch activo. Usar los puntos reales del ranking como inputs en lugar de sliders manuales. El simulador manual queda como herramienta de "¿qué pasaría si...?" secundaria
3. **Penalización por falta de Check-in diario:** Implementar lógica de penalización automática: si un miembro no hace el check-in diario antes de las 11:59 PM COT (excepción: ausencias registradas), se inserta un `bonus_event` de penalización. Opciones: (a) 0 puntos ese día (no afecta acumulado), (b) deducción de N pts. Definir con el cliente antes de implementar. Endpoint cron o trigger serverless

### Hito 8: Calendario + Google Sync

**Resultado:** Calendario integrado bidireccional. Ruta: `/calendario`

**Tareas:**
1. Vista mensual/semanal con tareas como eventos
2. Color-coding: pendientes (azul), completadas (verde), atrasadas (rojo), Google Calendar (gris)
3. Google Calendar OAuth: flujo de conexion al primer login
4. Guardar refresh token de Google por usuario en Supabase (encriptado)
5. Sync lectura: traer eventos de Google Calendar
6. Sync escritura: tarea con fecha -> crear evento en Google Calendar
7. Sync bidireccional: update/delete tarea -> update/delete evento en Google
8. Cada miembro ve su calendario personal
9. Admin: calendario consolidado con toggle por miembro
10. Click en dia -> crear tarea rapida con esa fecha
11. Vista responsive: en movil, lista por dia en vez de grid mensual

**Verificacion:**
- Vista mes/semana renderiza
- Tareas con fecha aparecen en calendario
- Google OAuth conecta
- Eventos de Google aparecen
- Crear tarea -> aparece en Google Calendar
- Admin ve calendario consolidado

---

### Hito 8: Discord Notificaciones + Informes

**Resultado:** Bot Lau + informes auto + recordatorios

**Arquitectura: App -> n8n -> Discord** (ver [ARCHITECTURE.md](ARCHITECTURE.md#notification-architecture))

**Tareas:**
1. API endpoints de reportes:
   - `GET /api/reports/pending` — quien no actualizo hoy
   - `GET /api/reports/daily/:userId` — informe diario individual
   - `POST /api/reports/generate-all` — genera y guarda en daily_reports
   - `GET /api/reports/weekly` — resumen semanal agregado
2. Workflows en n8n:
   - 11pm: genera informes -> Lau postea en #informes-diarios
   - 3pm: llama pending -> Lau envia DM a quienes no actualizaron
   - 6pm: segundo aviso DM
   - Domingo 8pm: resumen semanal en canal
3. Webhooks de la app a n8n (real-time):
   - Tarea asignada -> DM al miembro
   - Tarea atrasada -> DM al miembro
   - Evento de bono registrado -> DM al miembro
4. Formato informe diario: nombre, completadas, pendientes, % rendimiento, racha
5. Resumen semanal: mejor miembro, total equipo, comparativo semana anterior
6. Preferencias de notificacion por miembro (todo, solo urgente, solo recordatorios, nada)
7. API key/secret para autenticar n8n <-> app
8. (Opcional) Comando slash Discord: `/tarea "titulo" @miembro prioridad`

**Verificacion:**
- Informe 11pm se genera y postea en Discord
- Recordatorio 3pm llega por DM
- Segundo aviso 6pm llega
- DM al asignar tarea
- Preferencias se respetan
- Informe se guarda en daily_reports

---

### Hito 9: Polish + Deploy a Produccion

**Resultado:** App en vivo, pulida, responsive

**Tareas:**
1. ~~UI consistente dark mode: verificar colores, tipografia, spacing~~ **DONE** (Design System + tokens semánticos + refactor de 3 dashboards, 2026-03-27)
2. Responsive completo: movil primero, sidebar colapsable, Kanban scroll horizontal, calendario lista en movil
3. Loading states: skeletons en todas las vistas
4. Error handling: mensajes claros, nunca pantalla blanca
5. Empty states: mensajes amigables
6. PWA completo: service worker, splash screen, icono
7. Deploy Vercel: conectar repo, variables de entorno
8. Subdominio Hostinger -> Vercel
9. Discord + Google OAuth redirect URIs para produccion
10. Verificar usuarios del equipo en Supabase con Discord IDs reales
11. Seed inicial: primer lanzamiento (proyeccion), tareas repetitivas base
12. Prueba con todo el equipo
13. Exportar reportes PDF/CSV
14. Busqueda global
15. Comparativo cross-launch (bonos) — grafica Recharts
16. Supabase Realtime para dashboards en vivo
17. Barra de marcadores personales
18. Tag v1.0 en main

**Verificacion:**
- App accesible por dominio
- 6 miembros logearse con Discord
- Funciona bien en movil (PWA instalable)
- Dark mode consistente
- No hay pantallas blancas
- Informes Discord funcionan en produccion
