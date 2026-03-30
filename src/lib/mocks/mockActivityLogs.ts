import type { ActivityLogEvent } from "@/components/shared/ActivityLogFeed";

/**
 * Mock activity log events for development.
 * TODO: Replace with real DB queries once activity_log table is enriched.
 */
export const MOCK_ACTIVITY_LOGS: ActivityLogEvent[] = [
  {
    id: "mock-1",
    userId: "u-juandavid",
    user: { name: "Juan David", avatar: null },
    action: "completo la tarea",
    target: "Revisar metricas semanales",
    timestamp: new Date(Date.now() - 15 * 60_000).toISOString(),
    impact: "+5 pts",
  },
  {
    id: "mock-2",
    userId: "u-nico",
    user: { name: "Nico Barrera", avatar: null },
    action: "cambio la fecha limite de",
    target: "Preparar deck para inversionistas",
    timestamp: new Date(Date.now() - 2 * 3600_000).toISOString(),
    reason: "El cliente pidio aplazar la reunion al viernes. Se ajusta fecha de entrega de mie 26 a vie 28.",
  },
  {
    id: "mock-3",
    userId: "u-juandavid",
    user: { name: "Juan David", avatar: null },
    action: "registro un bono para",
    target: "Lanzamiento Campaña Q1",
    timestamp: new Date(Date.now() - 5 * 3600_000).toISOString(),
    impact: "+$120.000",
  },
  {
    id: "mock-4",
    userId: "u-maria",
    user: { name: "Maria Lopez", avatar: null },
    action: "creo la tarea",
    target: "Diseñar landing page v2",
    timestamp: new Date(Date.now() - 8 * 3600_000).toISOString(),
  },
  {
    id: "mock-5",
    userId: "u-nico",
    user: { name: "Nico Barrera", avatar: null },
    action: "marco como bloqueada",
    target: "Integrar pasarela de pagos",
    timestamp: new Date(Date.now() - 24 * 3600_000).toISOString(),
    reason: "Esperando credenciales del proveedor. Ticket de soporte abierto.",
    impact: "-1 racha",
  },
  {
    id: "mock-6",
    userId: "u-maria",
    user: { name: "Maria Lopez", avatar: null },
    action: "completo la tarea",
    target: "Actualizar manual de marca",
    timestamp: new Date(Date.now() - 26 * 3600_000).toISOString(),
    impact: "+3 pts",
  },
];
