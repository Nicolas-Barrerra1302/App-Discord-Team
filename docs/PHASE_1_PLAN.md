# Team Management App — Plan Completo

## Context

Juan David V. (COO) de Nico Barrera Academy × Mind Fuel necesita una web app interna para reemplazar Trello y unificar gestión de tareas, rendimiento, sistema de bonos gamificado y calendario. El equipo (6 personas) se comunica por Discord. La app usa Discord OAuth (whitelist), Supabase, Next.js 14 y se despliega en Vercel. El bot "Lau" ya existe en n8n.

---

## Mejoras Sugeridas sobre el Documento Original

### Funcionalidades nuevas que el documento no contempla:

1. **Comentarios en tareas** — Los miembros pueden agregar notas/actualizaciones a una tarea sin cambiar su estado. Ej: "Esperando respuesta del cliente". Esto da contexto al admin sin necesidad de preguntar.

2. **Subtareas** — Descomponer tareas complejas en pasos. Ej: "Editar video del lanzamiento" → subtareas: grabar, editar, revisar, publicar. El progreso de la tarea padre se calcula automáticamente.

3. **Archivos adjuntos / Links en tareas** — Adjuntar enlaces de Google Drive, Figma, YouTube, etc. a cada tarea. El equipo trabaja con contenido multimedia, esto es clave.

4. **Modo ausencia/vacaciones** — Marcar a un miembro como ausente. Las tareas repetitivas se pausan para esa persona, y el admin recibe aviso. Sin esto, se generan tareas que nadie va a completar y arruinan las métricas.

5. **Auto-escalamiento de prioridad** — Tareas que se acercan a su fecha límite suben automáticamente de prioridad (medium → high → urgent). Así el equipo ve qué urge sin que el admin tenga que reclasificar manualmente.

6. **Resumen semanal** — Además del informe diario a las 11pm, un resumen semanal los domingos con métricas agregadas: mejor miembro de la semana, tareas totales completadas, comparativo con semana anterior.

7. **PWA (Progressive Web App)** — Hacer la app instalable en el teléfono como una app nativa. El equipo va a usar esto desde el móvil — un ícono en la pantalla de inicio es mucho mejor que abrir el navegador.

8. **Realtime con Supabase** — Usar Supabase Realtime para que los dashboards se actualicen en vivo sin refrescar. Cuando alguien completa una tarea, el admin lo ve instantáneamente.

9. **Historial de actividad (Audit Log)** — Registro de cada acción: quién cambió qué, cuándo. Ej: "Juan David L. marcó 'Responder tickets' como completada — 14:32". Crítico para transparencia y para alimentar los informes automáticos.

10. **Exportar reportes** — PDF/CSV de reportes de rendimiento, historial de bonos, listas de tareas. Para reuniones de equipo o archivo.

11. **Creación rápida de tareas desde Discord** — Comando slash en Discord (via n8n): `/tarea "Revisar video" @Daniel urgente`. La tarea se crea en la app sin abrirla. Útil cuando estás en medio de una conversación.

12. **Preferencias de notificación** — Cada miembro elige qué notificaciones quiere: solo tareas urgentes, todas, solo recordatorios, etc. Sin esto, el spam de notificaciones hace que la gente las ignore.

13. **Comparativo entre lanzamientos (Bonos)** — Gráfica que muestra la evolución de puntos de un miembro a través de múltiples lanzamientos. Permite ver tendencias: ¿está mejorando o empeorando?

14. **Facturación real vs. Proyección (Bonos)** — Dos modos: durante el lanzamiento se trabaja con proyecciones. Al cerrar, el admin ingresa revenue real y margen real para calcular bonos definitivos.

### Mejoras sobre funcionalidades existentes del documento:

15. **Barra de búsqueda global** — No solo en tareas: buscar en toda la app (tareas, miembros, eventos de bonos, reportes).

16. **Filtros avanzados en tareas** — El documento menciona filtros básicos. Agregar: por asignado, por rango de fechas, por tag/categoría, combinables. Con opción de guardar filtros frecuentes.

17. **Dashboard del admin desglosable** — Vista general de todos los miembros + click para ver detalle individual. Cada miembro es un mini-dashboard con gráficas propias.

18. **Historial de puntos por miembro** — Cada miembro ve su timeline de puntos: fecha, evento, puntos, razón, quién lo registró. Completa transparencia.

---

## Arquitectura de Notificaciones (Recomendación)

**Enfoque híbrido: App → n8n → Discord**

- La app Next.js expone API endpoints para generar reportes y consultar estado
- n8n ejecuta los cron jobs (3pm recordatorio, 6pm segundo aviso, 11pm informe diario, domingo resumen semanal)
- n8n usa el token del bot Lau para enviar mensajes a Discord
- Para notificaciones en tiempo real (tarea asignada, tarea atrasada), la app llama webhooks de n8n que disparan mensajes inmediatos

**Por qué esto y no un bot discord.js dedicado:**
- Ya tienes n8n corriendo con Lau
- No necesitas mantener un servidor adicional
- n8n maneja scheduling nativo
- La lógica de negocio queda en la app, n8n solo orquesta comunicación

---

## Plan por Hitos

### HITO 1: Fundación ✅ COMPLETADO (2026-03-23)
**Resultado:** Proyecto corriendo con auth + DB + estructura

**Tareas:**
1. ✅ Crear proyecto Next.js 14 (App Router) + Tailwind CSS + configurar dark mode global
2. Crear cuenta y proyecto en Supabase (pendiente: credenciales del usuario)
3. Configurar Discord OAuth en Supabase Auth usando la app existente de Lau (pendiente: Client ID/Secret)
4. Redirect URIs: localhost:3000 + URL de Vercel (se agrega después)
5. ✅ Schema de base de datos completo:
   - `users`: id, discord_id, name, avatar_url, role (super_admin/ceo/member), area, is_active, notification_preferences (jsonb), created_at
   - `tasks`: id, title, description, status (pending/in_progress/completed/blocked), priority (low/medium/high/urgent), assigned_to, created_by, due_date, completed_at, category, parent_task_id (para subtareas), is_recurring_instance, recurrence_id, attachments (jsonb), created_at, updated_at
   - `task_comments`: id, task_id, user_id, content, created_at
   - `task_recurrences`: id, title, description, priority, category, frequency (daily/weekly/biweekly/monthly/custom), days_of_week, assigned_to, next_due_date, is_active, created_by, created_at
   - `task_categories`: id, name, color, is_default, created_by, created_at
   - `bonus_launches`: id, name, type (principal/low_ticket), status (active/projected/closed), revenue_bruto, margen_neto_pct, pool_pct, revenue_real (nullable), margen_real_pct (nullable), created_at, closed_at
   - `bonus_events`: id, launch_id, user_id, event_type, points, description, registered_by, created_at
   - `daily_reports`: id, user_id, date, tasks_completed (jsonb), tasks_pending (jsonb), tasks_overdue (jsonb), completion_pct, streak, notes, auto_generated, created_at
   - `activity_log`: id, user_id, action, entity_type, entity_id, metadata (jsonb), created_at
   - `user_absences`: id, user_id, start_date, end_date, reason, created_by, created_at
6. ✅ Whitelist de Discord IDs: solo los 6 miembros autorizados pueden logearse. Otros ven "No autorizado".
7. Mapear usuarios del equipo: Discord IDs + roles (pendiente: IDs reales)
8. ✅ Layout principal dark mode (estilo Notion dark): sidebar con navegación (Dashboard, Tareas, Bonos, Calendario, Admin)
9. ✅ Middleware de autenticación: rutas protegidas, redirect a /login si no autenticado
10. ✅ Página de login: botón "Entrar con Discord"
11. ✅ Dashboard placeholder: nombre, avatar, rol del usuario
12. ✅ Configurar RLS (Row Level Security) básico en Supabase
13. ✅ Configurar manifest.json para PWA (instalable en móvil)

**Verificación:**
- ✅ `npm run build` compila sin errores
- ⏳ Login con Discord funciona (pendiente: credenciales Supabase + Discord)
- ✅ Dashboard muestra nombre y avatar (estructura lista)
- ✅ Todas las tablas definidas en supabase/schema.sql
- ✅ Sidebar visible con secciones
- ✅ Sin login → redirect a /login

---

### HITO 2: Tareas CRUD
**Resultado:** Crear, editar, completar, buscar y filtrar tareas

**Tareas:**
1. Página `/tasks` — vista principal de tareas del usuario
2. Vista Kanban: columnas Pendiente, En Progreso, Completada, Bloqueada
3. Drag & drop entre columnas (usar @dnd-kit/core)
4. Modal/formulario crear tarea: título, descripción, prioridad, fecha límite, categoría, adjuntos (links)
5. Editar tarea existente
6. Eliminar tarea con confirmación
7. Completar tarea: status → completed, completed_at = now()
8. **Subtareas**: al crear/editar tarea, opción de agregar subtareas. Progreso del padre se calcula auto.
9. **Comentarios**: sección de comentarios en el detalle de cada tarea
10. **Barra de búsqueda**: buscar tareas por título, descripción, categoría
11. **Filtros avanzados**: por estado, prioridad, fecha, categoría, combinables. Opción de limpiar filtros.
12. Indicador visual de tareas atrasadas (rojo) y urgentes
13. **Auto-escalamiento de prioridad**: tarea a 1 día de vencer → urgent (via lógica en el frontend al renderizar, no cron)
14. API routes: GET/POST/PUT/DELETE `/api/tasks`
15. RLS: cada usuario solo ve sus tareas. Admin ve todas.
16. **Activity log**: registrar creación, edición, cambio de estado, eliminación
17. CRUD de categorías: admin puede crear/editar categorías. Categorías default: Contenido, Edición, Soporte, Mentoría, Operaciones, General

**Verificación:**
- Crear tarea con todos los campos
- Drag & drop funciona
- Subtareas se crean y el progreso se calcula
- Búsqueda encuentra tareas
- Filtros combinables funcionan
- Tareas atrasadas en rojo
- Datos persisten al refrescar

---

### HITO 3: Tareas Repetitivas + Asignación
**Resultado:** Tareas automáticas + roles + ausencias

**Tareas:**
1. Página `/admin/recurrences` — gestión de plantillas repetitivas (solo admin)
2. Formulario: mismos campos de tarea + frecuencia (diaria, semanal, quincenal, mensual) + asignar a (dropdown de miembros)
3. Para semanal: selector de días
4. API route: `/api/cron/generate-tasks` — genera tareas del día basado en recurrences activas
5. Configurar Vercel Cron para llamar al endpoint cada día a las 6am
6. Cada instancia es independiente: completar una no afecta futuras
7. Badge visual "Recurrente" para distinguir de manuales
8. Activar/desactivar plantillas
9. Historial de cumplimiento por plantilla
10. **Asignación de tareas**: admin puede asignar cualquier tarea a cualquier miembro
11. **Modo ausencia**: admin marca miembro como ausente → se pausan sus recurrentes, se muestra badge "Ausente" en dashboards
12. Notificación vía n8n cuando se asigna tarea (DM Discord)

**Verificación:**
- Crear tarea repetitiva diaria → aparece al día siguiente
- Crear semanal (solo lunes) → aparece solo los lunes
- Desactivar plantilla → no genera más
- Miembro ausente no recibe tareas repetitivas
- Badge recurrente visible

---

### HITO 4: Dashboard Admin + Rendimiento
**Resultado:** Métricas y vista global + desglose individual

**Tareas:**
1. Página `/dashboard` — dashboard personal de cada miembro: su %, racha, tareas completadas semana/mes
2. Página `/admin/dashboard` — vista global del equipo (solo admin/ceo)
3. **Vista general**: grid de cards, una por miembro: nombre, rol, avatar, tareas completadas hoy, pendientes, atrasadas, % cumplimiento semanal, indicador verde/rojo si actualizó hoy
4. **Desglose individual**: click en card → vista detallada tipo dashboard del miembro con:
   - Gráfico de rendimiento semanal (línea/barras)
   - % Cumplimiento: completadas a tiempo / total asignadas
   - Velocidad promedio: tiempo entre asignación y completación
   - Racha: días consecutivos al 100%
   - Tareas atrasadas acumuladas
   - Historial de tareas (tabla con filtros)
   - Actividad reciente (del activity log)
5. **Filtro por miembro**: dropdown para cambiar entre miembros sin volver a la vista general
6. Filtros: por semana, mes, rango personalizado
7. Resumen diario automático: qué hizo hoy (calculado de tareas, no manual)
8. Proteger rutas: solo super_admin y ceo
9. **Realtime**: usar Supabase Realtime para actualizar dashboards en vivo

**Verificación:**
- Dashboard admin muestra todos los miembros con métricas correctas
- Click en miembro → dashboard individual detallado
- Filtro por semana/mes funciona
- Dashboard personal de cada miembro muestra su rendimiento
- Indicador "actualizó hoy" funciona
- Solo admin/ceo acceden

---

### HITO 5: Sistema de Bonos
**Resultado:** Simulador + registro + ranking + historial + facturación real

**Tareas:**
1. Página `/bonuses` con 3 tabs: Simulador, Registrar, Ranking (replicar estética del prototipo en dark mode)
2. **Tab Simulador**:
   - Tipo de lanzamiento: Principal / Low Ticket
   - Revenue bruto (input numérico)
   - Margen neto % (slider)
   - Cálculo automático: utilidad neta, pool total (7% default, configurable)
   - Card por miembro: rol, nombre, puntos, % del pool, bono estimado
   - Barra visual min 0.3% — base — max 1.5%
   - Indicador "SOBRE META" (verde) o "BASE" según puntos
3. **Tab Registrar** (solo super_admin):
   - Panel izquierdo: lista de miembros con puntos actuales y botón reset
   - Panel derecho: eventos disponibles con puntos (+2 KPI cumplido, -1 KPI parcial, -2 KPI no cumplido, +3 Propuesta innovadora, -3 Queja no resuelta, +2 Iniciativa positiva, -3 Error impacto, +3 Entregó encima)
   - Al hacer click en evento, se registra para el miembro seleccionado
   - **Historial visible** debajo: cada evento registrado con fecha y puntos
   - Solo super_admin puede registrar (no CEO, no miembros)
4. **Tab Ranking**:
   - Lista ordenada por bono estimado
   - Posición, rol, nombre, barra de progreso, % del pool, puntos, bono USD
   - "SOBRE META" vs "BASE" labels
5. **Lógica de cálculo**:
   - Todos arrancan en 0 puntos (distribución equitativa = pool_pct / 6)
   - Con puntos: % persona = ((base_weight + puntos) / sum_all_weights) × pool_pct
   - Clamp entre 0.3% y 1.5% de utilidad neta
   - sum de todos los % = pool_pct (redistribuir excedente si alguien toca techo/piso)
6. **CRUD de lanzamientos**: crear nuevo, cerrar anterior
7. **Facturación real**: al cerrar lanzamiento, sección para ingresar revenue_real y margen_real_pct → recalcula bonos definitivos
8. **Historial de lanzamientos**: ver lanzamientos pasados con sus rankings finales
9. **Historial personal de puntos**: cada miembro ve su timeline — fecha, evento, puntos, razón, quién registró
10. **Comparativo entre lanzamientos**: gráfica de evolución de puntos/bonos a través del tiempo

**Verificación:**
- Simulador calcula correctamente (verificar con ejemplo: $80,000 revenue, 40% margen, 7% pool = $2,240 pool)
- Registrar eventos cambia puntos y recalcula simulador
- Solo super_admin puede registrar
- Ranking ordenado correctamente
- Min/max respetados (0.3% / 1.5%)
- Historial de puntos visible para cada miembro
- Facturación real funciona al cerrar lanzamiento

---

### HITO 6: Calendario + Google Sync
**Resultado:** Calendario integrado bidireccional

**Tareas:**
1. Página `/calendar` — vista mensual/semanal
2. Mostrar tareas con fecha límite como eventos
3. Color-coding: pendientes (azul), completadas (verde), atrasadas (rojo), Google Calendar (gris)
4. Google Calendar OAuth: flujo de conexión obligatoria al primer login
5. Guardar refresh token de Google por usuario en Supabase (encriptado)
6. Sync lectura: traer eventos de Google Calendar y mostrar en la vista
7. Sync escritura: tarea con fecha → crear evento en Google Calendar
8. Sync bidireccional: actualizar/eliminar tarea → actualizar/eliminar evento en Google
9. Cada miembro ve su calendario personal
10. Admin: calendario consolidado con toggle por miembro (filtrar quién ver)
11. Click en un día → crear tarea rápida con esa fecha
12. Vista responsive: en móvil, vista de lista por día en vez de grid mensual

**Verificación:**
- Vista mes/semana renderiza
- Tareas con fecha aparecen en calendario
- Google OAuth conecta
- Eventos de Google aparecen
- Crear tarea → aparece en Google Calendar
- Admin ve calendario consolidado

---

### HITO 7: Discord: Notificaciones + Informes
**Resultado:** Bot Lau + informes auto + recordatorios

**Arquitectura: App ↔ n8n ↔ Discord**

**Tareas:**
1. API endpoints en la app:
   - `GET /api/reports/pending` — quién no actualizó hoy
   - `GET /api/reports/daily/:userId` — informe diario de un usuario
   - `POST /api/reports/generate-all` — genera informes de todos y guarda en daily_reports
   - `GET /api/reports/weekly` — resumen semanal agregado
2. Workflows en n8n:
   - **11pm diario**: llama generate-all → Lau postea en #informes-diarios
   - **3pm diario**: llama pending → Lau envía DM a quienes no actualizaron
   - **6pm diario**: segundo aviso DM
   - **Domingo 8pm**: llama weekly → resumen semanal en canal
3. Webhooks de la app a n8n (notificaciones en tiempo real):
   - Tarea asignada → DM al miembro
   - Tarea atrasada → DM al miembro
   - Evento de bono registrado → DM al miembro
4. Formato de informe diario: nombre, tareas completadas, pendientes, % rendimiento, racha
5. **Resumen semanal**: mejor miembro, total equipo, comparativo con semana anterior
6. **Preferencias de notificación**: cada miembro configura qué quiere recibir (todo, solo urgente, solo recordatorios, nada)
7. API key/secret para autenticar las llamadas entre n8n y la app
8. **(Opcional) Comando slash Discord**: `/tarea "título" @miembro prioridad` para crear tareas desde Discord via n8n

**Verificación:**
- Informe 11pm se genera y postea en Discord
- Recordatorio 3pm llega por DM
- Segundo aviso 6pm llega
- DM al asignar tarea
- Preferencias de notificación se respetan
- Informe se guarda en daily_reports

---

### HITO 8: Polish + Deploy a Producción
**Resultado:** App en vivo, pulida, responsive

**Tareas:**
1. UI consistente dark mode (Notion dark): colores, tipografía, spacing
2. Paleta de colores: fondo oscuro (#0f0f0f / #1a1a2e), cards (#16213e / #1e1e2e), acentos rosa/rojo (#e91e63 para CTAs), verde (#00e676 para éxito), texto claro (#e0e0e0)
3. Responsive completo: móvil primero. Sidebar colapsable, Kanban scroll horizontal, calendario vista lista en móvil
4. Loading states: skeletons en todas las vistas
5. Error handling: mensajes claros, nunca pantalla blanca
6. Empty states: ilustraciones/mensajes amigables
7. PWA completo: manifest.json, service worker, splash screen, ícono
8. Deploy en Vercel: conectar repo Git, variables de entorno
9. Configurar subdominio en Hostinger → apuntar a Vercel
10. Discord OAuth redirect URI para producción
11. Google Calendar redirect URI para producción
12. Crear/verificar usuarios del equipo en Supabase con Discord IDs reales
13. Seed inicial: primer lanzamiento (proyección), tareas repetitivas base
14. Prueba con todo el equipo
15. **Exportar reportes**: botón para descargar PDF/CSV en dashboards y bonos
16. **Barra de búsqueda global**: buscar en toda la app

**Verificación:**
- App accesible por dominio
- 6 miembros logearse con Discord
- Funciona bien en móvil (PWA instalable)
- Dark mode consistente
- No hay pantallas blancas ni errores sin manejar
- Informes Discord funcionan en producción
- Tag v1.0 en main

---

## Stack Técnico Final

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| UI Components | shadcn/ui (dark mode nativo) |
| Drag & Drop | @dnd-kit/core |
| Gráficos | Recharts |
| Calendario | react-big-calendar o FullCalendar |
| Base de datos | Supabase (PostgreSQL) |
| Realtime | Supabase Realtime |
| Auth | Discord OAuth via Supabase Auth |
| Calendar Sync | Google Calendar API |
| Deploy | Vercel |
| Cron Jobs | Vercel Cron + n8n |
| Notificaciones | n8n → Discord Bot (Lau) |
| PWA | next-pwa |

---

## Estructura de Carpetas

```
src/
  app/
    (auth)/
      login/page.tsx
      callback/page.tsx
    (dashboard)/
      layout.tsx          ← sidebar + auth check
      page.tsx             ← dashboard personal
      tasks/page.tsx
      bonuses/page.tsx
      calendar/page.tsx
      admin/
        dashboard/page.tsx
        member/[id]/page.tsx
        recurrences/page.tsx
    api/
      tasks/route.ts
      bonuses/route.ts
      reports/route.ts
      cron/route.ts
  components/
    ui/                    ← shadcn components
    tasks/
    bonuses/
    calendar/
    dashboard/
    layout/
  lib/
    supabase/
      client.ts
      server.ts
      admin.ts
      database.ts
    hooks/
      use-user.ts
    utils.ts
    types.ts
    constants.ts
supabase/
  schema.sql
  seed.sql
  rls.sql
```

---

## Progreso

| Hito | Estado | Fecha |
|------|--------|-------|
| 1. Fundación | ✅ Completado | 2026-03-23 |
| 2. Tareas CRUD | ⏳ Pendiente | — |
| 3. Tareas Repetitivas | ⏳ Pendiente | — |
| 4. Dashboard Admin | ⏳ Pendiente | — |
| 5. Sistema de Bonos | ⏳ Pendiente | — |
| 6. Calendario + Google | ⏳ Pendiente | — |
| 7. Discord Notificaciones | ⏳ Pendiente | — |
| 8. Polish + Deploy | ⏳ Pendiente | — |
