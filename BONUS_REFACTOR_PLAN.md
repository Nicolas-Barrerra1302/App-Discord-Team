# BONUS_REFACTOR_PLAN — Spec-Driven Refactor del Motor de Bonos

> **Documento de arquitectura** generado en modo plan (Opus 4.7, 2026-04-17). Este archivo es el **contrato Spec-Driven** previo a la implementación: describe archivos exactos a modificar, script SQL de la migración y pseudocódigo de la validación de roles en frontend. No se ha escrito código fuente todavía.

---

## 1. Contexto

El motor actual de bonos (`/bonos`) tiene dos fugas funcionales respecto a las nuevas reglas de negocio (2026-04-17):

1. **Fuga de privacidad monetaria** — Los miembros ven `formatCurrency(effectiveBonus)` en `ProjectionView` ([src/components/bonuses/projection-view.tsx:163-175](src/components/bonuses/projection-view.tsx:163)). Debe ocultarse para cualquier rol que no sea `super_admin` o `ceo`.
2. **CEO contaminando el ranking** — El `teamRanking` construido en el BFF ([src/app/(dashboard)/bonos/page.tsx:63-65](src/app/(dashboard)/bonos/page.tsx:63)) incluye al CEO (Discord ID `1337429420683563070`). El filtro `.filter(u => u.role !== 'ceo')` en la línea 74 solo aplica al cálculo de `myEstimatedBonus`, no al ranking expuesto a la UI. El CEO aparece en `ProjectionView` (mini-leaderboard), `RankingTab` y `AdminDistribution`.

**Restricción dura del negocio:** el CEO **debe seguir acumulando puntos** por sus tareas diarias (`task_completed`, `kpi_weekly`, `daily_close`). Los puntos se preservan en `bonus_events` como audit trail; solo se excluyen al **agregar** el ranking y la distribución.

**Zonas prohibidas (no tocar):**
- [src/app/(dashboard)/kpis/page.tsx](src/app/(dashboard)/kpis/page.tsx)
- [src/app/api/tasks/**](src/app/api/tasks) (todos los handlers)
- Cron jobs en `src/app/api/cron/**`
- Webhook dispatcher en `src/lib/webhooks/dispatcher.ts`

---

## 2. Estado Actual (mapa de evidencia)

### 2.1 Motor BFF del ranking
| Archivo | Líneas | Responsabilidad |
|---|---|---|
| [src/app/(dashboard)/bonos/page.tsx](src/app/(dashboard)/bonos/page.tsx) | 27-33 | Fetch `users` activos (sin filtro por rol) |
| [src/app/(dashboard)/bonos/page.tsx](src/app/(dashboard)/bonos/page.tsx) | 49-54 | Fetch `bonus_events` por launch activo |
| [src/app/(dashboard)/bonos/page.tsx](src/app/(dashboard)/bonos/page.tsx) | 57-65 | **Agregación `pointsMap` + build `teamRanking`** ← CEO incluido |
| [src/app/(dashboard)/bonos/page.tsx](src/app/(dashboard)/bonos/page.tsx) | 72-86 | `calculateBonuses()` para `myEstimatedBonus` (ya filtra CEO en 74) |
| [src/app/api/bonuses/ranking/route.ts](src/app/api/bonuses/ranking/route.ts) | 17-54 | API alternativa de ranking (sin filtro CEO) |
| [src/app/api/bonuses/[id]/close/route.ts](src/app/api/bonuses/[id]/close/route.ts) | 110-118 | Close de launch (ya filtra `role != 'ceo'`) |

### 2.2 Renderizado de dinero en UI
| Archivo | Líneas | Qué muestra | Audiencia |
|---|---|---|---|
| [src/components/bonuses/projection-view.tsx](src/components/bonuses/projection-view.tsx) | 163-175 | `formatCurrency(effectiveBonus)` (card "Bono estimado") | **Members + Admin** (punto a ocultar) |
| [src/components/bonuses/admin-distribution.tsx](src/components/bonuses/admin-distribution.tsx) | 109, 124, 207 | `totalPool`, `projectedPayout` | Solo admin tab (OK) |
| [src/components/bonuses/bonuses-client.tsx](src/components/bonuses/bonuses-client.tsx) | 349, 398, 402, 415, 424, 433, 504 | Simulador: revenue, neto, pool, bonos por miembro | Solo admin tab (OK) |

### 2.3 Schema Supabase relevante
| Objeto | Fuente | Observación |
|---|---|---|
| `public.users` | [supabase/schema.sql:12-22](supabase/schema.sql:12) | `role check (super_admin, ceo, member)`, `discord_id unique` |
| `public.bonus_launches` | [supabase/schema.sql:100-112](supabase/schema.sql:100) | sin cambios requeridos |
| `public.bonus_events` | [supabase/schema.sql:117-127](supabase/schema.sql:117) | Preservar filas del CEO (audit) |
| Próxima migración libre | `supabase/migrations/024_*.sql` | Última aplicada: 023 |

### 2.4 Helpers y convenciones reutilizables
- [src/lib/supabase/database.ts:41-47](src/lib/supabase/database.ts:41) — `isAdmin(user)` ya engloba `super_admin` + `ceo`. **Reutilizar**; no duplicar.
- [src/lib/bonuses/calculator.ts:206-213](src/lib/bonuses/calculator.ts:206) — `formatCurrency()` Intl.NumberFormat es-CO. **Reutilizar**.
- CLAUDE.md Regla #1 (cast `as { data: Pick<T, ...>[] | null }`) — **obligatorio** en las nuevas queries.

---

## 3. Estrategia de Refactor (recomendada)

**Principio rector:** filtrar al CEO en la capa de **agregación** (BFF y API), no al escribir `bonus_events`. Los puntos del CEO se preservan para audit y para su dashboard personal (`PersonalTimeline`, KPI tracking), pero **no existen** desde la perspectiva del motor de bonos.

### 3.1 Nivel DB — VIEW semántica (fuente única de verdad)

Crear una vista Postgres `public.bonus_eligible_users` que materializa la regla "usuarios elegibles para reparto y ranking de bonos". Esto:
- **Documenta** la regla en el esquema.
- Evita hardcodear la exclusión en 4+ sitios de app code.
- Facilita futuras excepciones (p. ej. un nuevo rol `advisor` excluido) con un solo `ALTER VIEW`.
- Es **no-destructiva**: no modifica ni borra filas de `bonus_events` ni de `users`.

Adicionalmente, como defensa en profundidad, se filtra también por `discord_id` explícito para garantizar que un cambio accidental de `role` al CEO no lo reintroduzca al ranking.

### 3.2 Nivel App — Filtrado en agregación

Cambiar dos puntos donde se construye el ranking:
1. `src/app/(dashboard)/bonos/page.tsx` — fetch `bonus_eligible_users` en lugar de `users` para la agregación del `teamRanking`. Mantener fetch separado de `users` completo solo si la UI (ej. registrar-tab) lo requiere, pero el `teamRanking` que se pasa a `BonusesClient` **no** contiene al CEO.
2. `src/app/api/bonuses/ranking/route.ts` — agregación sobre `bonus_events` con `INNER JOIN bonus_eligible_users` (o filtrado en memoria por `eligibleIds: Set<string>`).

### 3.3 Nivel UI — Gate de visibilidad monetaria

Crear un helper dedicado (`src/lib/bonuses/access.ts`) con:
- `canViewBonusMoney(user: User): boolean` — returns `user.role === 'super_admin' || user.role === 'ceo'`.
- Constante `CEO_DISCORD_ID = '1337429420683563070'` (documentación activa; usada por la migración y como verificación defensiva).

Pasar este flag desde `BonusesClient` a `ProjectionView` como prop `canViewMoney`. Dentro de `ProjectionView`, el card "Bono estimado" se sustituye por un placeholder informativo cuando `!canViewMoney`.

---

## 4. Archivos Exactos a Modificar

### 4.1 Código fuente (5 archivos)

| # | Archivo | Cambio | LOC afectado (estimación) |
|---|---|---|---|
| 1 | [src/lib/bonuses/access.ts](src/lib/bonuses/access.ts) | **CREAR** — helpers `canViewBonusMoney`, const `CEO_DISCORD_ID` | ~20 LOC |
| 2 | [src/app/(dashboard)/bonos/page.tsx](src/app/(dashboard)/bonos/page.tsx) | Fetch `bonus_eligible_users` para construir `teamRanking`; pasar `users` completo aparte si se usa en otras tabs. Cast estricto Regla #1. | ~15 LOC |
| 3 | [src/app/api/bonuses/ranking/route.ts](src/app/api/bonuses/ranking/route.ts) | Filtrar agregación contra `bonus_eligible_users` (JOIN o Set lookup). | ~10 LOC |
| 4 | [src/components/bonuses/bonuses-client.tsx](src/components/bonuses/bonuses-client.tsx) | Derivar `canViewMoney = canViewBonusMoney(currentUser)`; pasar como prop a `ProjectionView`. **No** cambiar `isAdminUser` (sigue siendo tab-gate). | ~5 LOC |
| 5 | [src/components/bonuses/projection-view.tsx](src/components/bonuses/projection-view.tsx) | Nueva prop `canViewMoney: boolean`; envolver card "Bono estimado" (líneas 163-175) con gate condicional. | ~20 LOC |

### 4.2 Base de datos (1 archivo nuevo)

| # | Archivo | Tipo |
|---|---|---|
| 6 | `supabase/migrations/024_exclude_ceo_from_bonus_rankings.sql` | **CREAR** migración |

### 4.3 Archivos explícitamente **NO** tocados
- `src/app/(dashboard)/kpis/page.tsx` (zona prohibida)
- `src/app/api/tasks/**/*` (zona prohibida)
- `src/app/api/cron/**/*` (zona prohibida)
- `src/lib/bonuses/calculator.ts` (motor matemático estable; el filtro ocurre aguas arriba)
- `src/app/api/bonuses/[id]/close/route.ts` (ya filtra CEO correctamente; no se duplica lógica)
- `src/components/bonuses/admin-distribution.tsx` (recibe `ranking` ya filtrado; no requiere cambio)
- `src/components/bonuses/ranking-tab.tsx` (si consume `/api/bonuses/ranking`, se beneficia del filtro upstream)

---

## 5. Script SQL de la Migración

**Archivo:** `supabase/migrations/024_exclude_ceo_from_bonus_rankings.sql`

```sql
-- ============================================================================
-- Migration 024 — Exclude CEO from bonus rankings and distribution
-- ============================================================================
-- Business rule (2026-04-17): the CEO (Discord ID 1337429420683563070,
-- role='ceo') no longer participates in the bonus pool nor appears in the
-- global ranking. The CEO continues to accumulate points normally via daily
-- tasks, KPI submissions and daily-close gamification; those bonus_events
-- rows are preserved as audit trail.
--
-- Strategy: non-destructive VIEW that materializes the "bonus eligible user"
-- concept. Application layer reads this view instead of `users` when building
-- the ranking or the distribution UI. Defense-in-depth: filter both by
-- `role != 'ceo'` AND by the known CEO discord_id, so a role-field mutation
-- alone cannot re-introduce the CEO into the pool.
--
-- Reversibility: `DROP VIEW public.bonus_eligible_users CASCADE;` restores
-- previous behavior without data loss.
-- ============================================================================

-- 1. View of users eligible for bonus ranking and distribution
CREATE OR REPLACE VIEW public.bonus_eligible_users AS
SELECT
  id,
  discord_id,
  name,
  avatar_url,
  role,
  area,
  is_active,
  created_at
FROM public.users
WHERE is_active = true
  AND role <> 'ceo'
  AND discord_id <> '1337429420683563070';

COMMENT ON VIEW public.bonus_eligible_users IS
  'Active users eligible for bonus ranking and distribution. Excludes the CEO '
  '(discord_id 1337429420683563070, role=ceo) per business rule dated 2026-04-17. '
  'The CEO keeps earning points in bonus_events for audit purposes; they are '
  'simply filtered out at aggregation time. To opt a user back in, update the '
  'users table (role / discord_id) accordingly.';

-- 2. Grant access identical to the underlying users table
GRANT SELECT ON public.bonus_eligible_users TO authenticated;
GRANT SELECT ON public.bonus_eligible_users TO anon;
GRANT SELECT ON public.bonus_eligible_users TO service_role;

-- 3. Optional helper function for SQL-level aggregations (e.g. RPC)
--    Uses SECURITY INVOKER to honor the caller's RLS context.
CREATE OR REPLACE FUNCTION public.is_bonus_eligible(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bonus_eligible_users WHERE id = p_user_id
  );
$$;

COMMENT ON FUNCTION public.is_bonus_eligible(uuid) IS
  'True when the given user_id participates in bonus ranking/distribution. '
  'Mirrors the bonus_eligible_users VIEW. Safe to use in SELECT projections '
  'and future RPCs.';

-- 4. (Optional but recommended) Light-weight partial index to speed up
--    role-based filtering on the users table. Skipped if already present.
CREATE INDEX IF NOT EXISTS idx_users_role_bonus_eligible
  ON public.users (id)
  WHERE is_active = true AND role <> 'ceo';

-- ============================================================================
-- Verification (run manually, NOT part of migration):
--   SELECT COUNT(*) FROM public.bonus_eligible_users;          -- expect 5
--   SELECT COUNT(*) FROM public.users WHERE is_active = true;  -- expect 6
--   SELECT name, role FROM public.bonus_eligible_users;        -- no 'ceo' row
-- ============================================================================
```

**Notas de la migración:**
- **Reversible:** `DROP VIEW public.bonus_eligible_users CASCADE; DROP FUNCTION public.is_bonus_eligible(uuid); DROP INDEX idx_users_role_bonus_eligible;`
- **Sin RLS nueva:** la VIEW hereda RLS del `users` subyacente; los helpers `get_user_id()`/`get_user_role()` siguen funcionando.
- **No se toca `bonus_events`** — los puntos históricos del CEO permanecen para auditoría y para su dashboard personal.

---

## 6. Pseudocódigo de Validación de Roles (Frontend)

### 6.1 Nuevo helper — `src/lib/bonuses/access.ts`

```typescript
// src/lib/bonuses/access.ts
// Single source of truth for bonus-module access control.

import type { User } from '@/lib/types';

/**
 * Discord ID of the CEO. Informative constant used as documentation
 * and as a defense-in-depth check in the Supabase VIEW `bonus_eligible_users`.
 * Primary discriminator in code is still `user.role`.
 */
export const CEO_DISCORD_ID = '1337429420683563070';

/**
 * Returns true when the given user is allowed to see monetary projections
 * in the bonus UI (totalPool, projectedPayout, simulatedBonus).
 * Reuses the same role set as `isAdmin()` in database.ts.
 */
export function canViewBonusMoney(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'super_admin' || user.role === 'ceo';
}
```

### 6.2 Integración en `BonusesClient` (pseudocódigo)

```tsx
// src/components/bonuses/bonuses-client.tsx
import { canViewBonusMoney } from '@/lib/bonuses/access';

export default function BonusesClient({ currentUser, ... }) {
  const isAdminUser   = currentUser.role === 'super_admin' || currentUser.role === 'ceo';
  const canViewMoney  = canViewBonusMoney(currentUser);   // NEW

  // ...existing code unchanged...

  return (
    // ...
    <ProjectionView
      currentUser={currentUser}
      activeLaunch={activeLaunch}
      teamRanking={teamRanking}           // already CEO-free thanks to BFF change
      myEstimatedBonus={myEstimatedBonus}
      users={users}
      canViewMoney={canViewMoney}          // NEW prop
    />
    // ...
  );
}
```

### 6.3 Gate en `ProjectionView` (pseudocódigo)

```tsx
// src/components/bonuses/projection-view.tsx
interface ProjectionViewProps {
  // ...existing props...
  canViewMoney: boolean;   // NEW
}

export default function ProjectionView({ canViewMoney, effectiveBonus, /* ... */ }) {
  // ...existing logic...

  // Card "Bono estimado" — replace lines 163-175 with this conditional block:
  <div className="bg-card-secondary rounded-xl p-4 col-span-2 sm:col-span-1">
    <p className="text-xs text-text-muted mb-1">Bono estimado</p>

    {!canViewMoney ? (
      // Members: monetary projection hidden
      <div className="flex items-center gap-1 mt-1">
        <Lock className="w-3.5 h-3.5 text-text-muted" />
        <p className="text-sm text-text-muted">
          Visible solo para administración
        </p>
      </div>
    ) : effectiveBonus !== null ? (
      // Admin / CEO with launch data
      <p className="text-2xl font-bold text-success-neon tabular-nums [text-shadow:0_0_10px_currentColor]">
        {formatCurrency(effectiveBonus)}
      </p>
    ) : (
      // Admin / CEO but no financial inputs yet
      <div className="flex items-center gap-1 mt-1">
        <Lock className="w-3.5 h-3.5 text-text-muted" />
        <p className="text-sm text-text-muted">Sin datos financieros</p>
      </div>
    )}
  </div>
}
```

### 6.4 BFF — CEO fuera del ranking (pseudocódigo)

```typescript
// src/app/(dashboard)/bonos/page.tsx
export default async function BonusesPage() {
  const supabase    = await createClient();
  const user        = await getCurrentUser(supabase);
  if (!user) return null;
  const adminClient = createAdminClient();

  // 1. Users for UI rendering (names, avatars) — keep the full list
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, name, avatar_url, role, area, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true }) as {
      data: Pick<User, 'id'|'name'|'avatar_url'|'role'|'area'|'is_active'>[] | null;
    };

  // 2. Users eligible for bonus ranking — reads the new VIEW
  const { data: eligibleUsers } = await adminClient
    .from('bonus_eligible_users')
    .select('id, name, avatar_url, role, area, is_active')
    .order('name', { ascending: true }) as {
      data: Pick<User, 'id'|'name'|'avatar_url'|'role'|'area'|'is_active'>[] | null;
    };

  const eligibleIds = new Set((eligibleUsers ?? []).map(u => u.id));

  // 3. Active launch (unchanged)
  // ...

  // 4. Ranking aggregation — CEO rows are filtered before pointsMap reduction
  if (activeLaunch) {
    const { data: events } = await adminClient
      .from('bonus_events')
      .select('user_id, points')
      .eq('launch_id', activeLaunch.id)
      .in('user_id', Array.from(eligibleIds)) as {
        data: { user_id: string; points: number }[] | null;
      };

    const pointsMap: Record<string, number> = {};
    for (const evt of events ?? []) {
      pointsMap[evt.user_id] = (pointsMap[evt.user_id] ?? 0) + evt.points;
    }

    teamRanking = (eligibleUsers ?? [])
      .map(u => ({ userId: u.id, totalPoints: pointsMap[u.id] ?? 0 }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    // myEstimatedBonus: same calculateBonuses() call, eligibleUsers already excludes CEO
    // so the existing `.filter(u => u.role !== 'ceo')` on line 74 becomes redundant
    // and can be removed for clarity (but leaving it is harmless).
  }

  return (
    <BonusesClient
      users={allUsers ?? []}        // Full list (UI needs names for everyone, incl. CEO timeline)
      currentUser={user}
      activeLaunch={activeLaunch}
      teamRanking={teamRanking}     // CEO-free
      myEstimatedBonus={myEstimatedBonus}
    />
  );
}
```

### 6.5 API — agregación en `/api/bonuses/ranking` (pseudocódigo)

```typescript
// src/app/api/bonuses/ranking/route.ts
const { data: eligible } = await adminClient
  .from('bonus_eligible_users')
  .select('id') as { data: { id: string }[] | null };
const eligibleIds = new Set((eligible ?? []).map(u => u.id));

const { data: events } = await adminClient
  .from('bonus_events')
  .select('user_id, points')
  .eq('launch_id', launchId)
  .in('user_id', Array.from(eligibleIds)) as {
    data: { user_id: string; points: number }[] | null;
  };

// Aggregate as today; CEO rows never reach the reducer.
```

---

## 7. Verificación End-to-End

### 7.1 DB (Supabase)

```sql
-- 1. VIEW returns 5 rows (team of 6 minus CEO)
SELECT COUNT(*) FROM public.bonus_eligible_users;                  -- 5

-- 2. CEO still has bonus_events (audit preserved)
SELECT COUNT(*) FROM public.bonus_events be
  JOIN public.users u ON u.id = be.user_id
  WHERE u.role = 'ceo';                                             -- > 0

-- 3. is_bonus_eligible(ceo.id) === false
SELECT public.is_bonus_eligible(id), name
FROM public.users WHERE role = 'ceo';                               -- false, Nico
```

### 7.2 Unit-level (componentes)
- `canViewBonusMoney({role: 'member'})` === `false`
- `canViewBonusMoney({role: 'ceo'})` === `true`
- `canViewBonusMoney({role: 'super_admin'})` === `true`

### 7.3 UX (navegador, `npm run dev`)

| Sesión | Tab | Resultado esperado |
|---|---|---|
| Member (`role='member'`) | Mi Proyección | Card "Bono estimado" muestra candado + "Visible solo para administración". Sus puntos, posición, progreso vs líder siguen visibles. |
| Member | Ranking | Lista de 5 miembros. **CEO no aparece**. |
| CEO (`role='ceo'`) | Mi Proyección | Card "Bono estimado" muestra dinero o "Sin datos financieros". |
| CEO | Ranking / CEO Dashboard | 5 miembros. CEO **no** se ve a sí mismo en el ranking. |
| Super Admin | Simulador | Panel de miembros muestra 5 tarjetas (sin CEO), bonos en dinero. |
| Super Admin | CEO Dashboard (AdminDistribution) | Tabla con 5 filas; `totalPool` y `projectedPayout` visibles. |
| Super Admin | Registrar | Lista de usuarios para registrar eventos manuales — puede incluir CEO si se quiere registrarle eventos manuales auditables (confirmar con producto). |

### 7.4 Checks de integridad
- `npm run build` sin errores TypeScript.
- `npx tsc --noEmit` sin errores (en particular el cast Regla #1 en las nuevas queries contra `bonus_eligible_users`).
- `npm run lint` limpio.
- KPI (zona prohibida) sin cambios visibles: el CEO sigue viendo su módulo KPI intacto y acumulando puntos semanales en `bonus_events` con `event_type='kpi_weekly'`.

### 7.5 Regresión — zonas prohibidas
- `git diff --name-only master...HEAD -- src/app/\(dashboard\)/kpis src/app/api/tasks src/app/api/cron` debe ser **vacío**.

---

## 8. Riesgos y Mitigaciones

| Riesgo | Mitigación |
|---|---|
| Un nuevo usuario con `role='ceo'` se agrega al equipo | El filtro `role <> 'ceo'` de la VIEW lo excluye automáticamente. |
| El CEO cambia de rol a `super_admin` accidentalmente | El segundo filtro `discord_id <> '1337429420683563070'` actúa como guard de defensa en profundidad. |
| La VIEW no se actualiza tras cambios en `users` | Es una vista simple (no materializada), se re-evalúa en cada query. No requiere `REFRESH`. |
| Timeline personal del CEO (`PersonalTimeline`) deja de mostrar sus puntos | **No afecta**: `PersonalTimeline` consulta `bonus_events` directamente por `user_id`, no por la VIEW. Sus puntos siguen visibles para él. |
| `/api/bonuses/[id]/close` ya filtra CEO — ¿duplicación? | Queda como segunda capa. Puede simplificarse posteriormente reemplazando `.neq('role','ceo')` por lectura de `bonus_eligible_users`, pero fuera del alcance de este refactor para minimizar superficie de cambio. |

---

## 9. Checklist de Ejecución (post-aprobación)

1. [ ] Crear `supabase/migrations/024_exclude_ceo_from_bonus_rankings.sql`.
2. [ ] Aplicar migración a Supabase remoto (CLI o dashboard).
3. [ ] Crear `src/lib/bonuses/access.ts`.
4. [ ] Modificar `src/app/(dashboard)/bonos/page.tsx` (BFF lee `bonus_eligible_users`).
5. [ ] Modificar `src/app/api/bonuses/ranking/route.ts` (filtrar por `eligibleIds`).
6. [ ] Modificar `src/components/bonuses/bonuses-client.tsx` (derivar + propagar `canViewMoney`).
7. [ ] Modificar `src/components/bonuses/projection-view.tsx` (gate UI monetario).
8. [ ] `npx tsc --noEmit` + `npm run lint` + `npm run build` verdes.
9. [ ] Verificación manual (sección 7.3) con 3 sesiones (member / ceo / super_admin).
10. [ ] Actualizar `CLAUDE.md` y `docs/DOMAIN_MODULES.md` con la nueva regla (CEO fuera de bonos) y la VIEW `bonus_eligible_users`.

---

## 10. Archivos Críticos (índice rápido)

- [src/app/(dashboard)/bonos/page.tsx](src/app/(dashboard)/bonos/page.tsx) — BFF del ranking
- [src/app/api/bonuses/ranking/route.ts](src/app/api/bonuses/ranking/route.ts) — API alterna
- [src/components/bonuses/bonuses-client.tsx](src/components/bonuses/bonuses-client.tsx) — cliente raíz, tabs
- [src/components/bonuses/projection-view.tsx](src/components/bonuses/projection-view.tsx) — card monetario a ocultar
- [src/components/bonuses/admin-distribution.tsx](src/components/bonuses/admin-distribution.tsx) — admin tab, recibe ranking filtrado
- [src/lib/bonuses/calculator.ts](src/lib/bonuses/calculator.ts) — motor matemático, `formatCurrency`
- [src/lib/supabase/database.ts](src/lib/supabase/database.ts) — `isAdmin()` existente
- [supabase/schema.sql](supabase/schema.sql) — schema base (`users`, `bonus_events`, `bonus_launches`)
- `supabase/migrations/024_exclude_ceo_from_bonus_rankings.sql` — **nueva migración**
