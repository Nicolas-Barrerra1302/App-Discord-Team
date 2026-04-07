"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { Clock, Loader2, ChevronDown } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActivityLogEvent {
  id: string;
  userId: string;
  user: { name: string; avatar: string | null };
  action: string;
  target: string;
  timestamp: string;
  impact?: string;
  reason?: string;
}

interface ActivityLogFeedProps {
  initialLogs: ActivityLogEvent[];
  /** Filter by a single user (personal / member detail) */
  userId?: string;
  /** Filter by multiple users (admin dashboard multi-select) */
  userIdsFilter?: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Justo ahora";
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}

/** Human-readable Spanish label for the impact field. */
const IMPACT_LABELS: Record<string, string> = {
  positive: "Positivo",
  negative: "Negativo",
  neutral: "Neutral",
};

/** Determine badge color based on impact text. Handles both semantic strings
 *  ("positive", "negative", "neutral") and legacy numeric prefixes ("+5", "-3"). */
function getImpactStyle(impact: string): { bg: string; text: string } {
  const lower = impact.toLowerCase();
  if (lower === "positive" || impact.startsWith("+"))
    return { bg: "bg-[#00e676]/15", text: "text-[#00e676]" };
  if (lower === "negative" || impact.startsWith("-"))
    return { bg: "bg-red-500/15", text: "text-red-400" };
  return { bg: "bg-yellow-500/15", text: "text-yellow-400" };
}

/** Returns the display label for an impact value (localized if known, raw otherwise). */
function getImpactLabel(impact: string): string {
  return IMPACT_LABELS[impact.toLowerCase()] ?? impact;
}

/** Build query params for the activity API */
function buildParams(offset: number, userId?: string, userIdsFilter?: string[]): URLSearchParams {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(PAGE_SIZE),
  });
  if (userIdsFilter && userIdsFilter.length > 0) {
    params.set("users", userIdsFilter.join(","));
  } else if (userId) {
    params.set("users", userId);
  }
  return params;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityLogFeed({ initialLogs, userId, userIdsFilter }: ActivityLogFeedProps) {
  const [logs, setLogs] = useState<ActivityLogEvent[]>(initialLogs);
  const [offset, setOffset] = useState(initialLogs.length);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialLogs.length >= PAGE_SIZE);

  // Track the serialized filter to detect changes
  const filterKey = userIdsFilter ? userIdsFilter.slice().sort().join(",") : userId ?? "";
  const prevFilterKeyRef = useRef(filterKey);

  // Listen for 'checkin-refresh' custom event (fired by PersonalDashboard after daily close)
  // Waits 1.5 s to allow the waitUntil background insert to commit before re-fetching.
  useEffect(() => {
    function handleCheckinRefresh() {
      setTimeout(async () => {
        try {
          const params = buildParams(0, userId, userIdsFilter);
          const res = await fetch(`/api/activity?${params.toString()}`);
          if (!res.ok) return;
          const json = await res.json() as { data: ActivityLogEvent[]; hasMore: boolean };
          setLogs(json.data);
          setOffset(json.data.length);
          setHasMore(json.hasMore);
        } catch {
          // Non-fatal — user can manually reload
        }
      }, 1500);
    }
    window.addEventListener('checkin-refresh', handleCheckinRefresh);
    return () => window.removeEventListener('checkin-refresh', handleCheckinRefresh);
  }, [userId, userIdsFilter]);

  // Reset & re-fetch when userIdsFilter changes (admin multi-select)
  useEffect(() => {
    if (prevFilterKeyRef.current === filterKey) return;
    prevFilterKeyRef.current = filterKey;

    const controller = new AbortController();

    async function refetch() {
      setIsLoadingMore(true);
      try {
        const params = buildParams(0, userId, userIdsFilter);
        const res = await fetch(`/api/activity?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error("fetch failed");

        const json = await res.json() as { data: ActivityLogEvent[]; hasMore: boolean };
        setLogs(json.data);
        setOffset(json.data.length);
        setHasMore(json.hasMore);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Error refetching activity:", err);
      } finally {
        setIsLoadingMore(false);
      }
    }

    refetch();
    return () => controller.abort();
  }, [filterKey, userId, userIdsFilter]);

  const loadMoreLogs = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const params = buildParams(offset, userId, userIdsFilter);
      const res = await fetch(`/api/activity?${params.toString()}`);
      if (!res.ok) throw new Error("fetch failed");

      const json = await res.json() as { data: ActivityLogEvent[]; hasMore: boolean };
      setLogs((prev) => [...prev, ...json.data]);
      setOffset((prev) => prev + json.data.length);
      setHasMore(json.hasMore);
    } catch (err) {
      console.error("Error loading more activity:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, offset, userId, userIdsFilter]);

  if (logs.length === 0 && !isLoadingMore) {
    return (
      <div className="rounded-xl border border-border/30 bg-card-secondary p-8 text-center text-sm text-text-muted">
        Sin eventos de actividad
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Clock className="h-4 w-4 text-accent" />
        <h2 className="text-lg font-semibold text-text-heading">Línea de Tiempo</h2>
      </div>

      <div className="max-h-[550px] overflow-y-auto pr-2" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
        {isLoadingMore && logs.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-[#9e9e9e]" />
          </div>
        ) : (
          <div className="relative space-y-0">
            {/* Vertical line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-white/10" />

            {logs.map((event) => {
              const impactStyle = event.impact ? getImpactStyle(event.impact) : null;

              return (
                <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
                  {/* Avatar on timeline */}
                  <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center">
                    {event.user.avatar ? (
                      <Image
                        src={event.user.avatar}
                        alt={event.user.name}
                        width={32}
                        height={32}
                        className="rounded-full ring-2 ring-background"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent ring-2 ring-background">
                        {event.user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Content card */}
                  <div className="flex-1 rounded-lg border border-border/30 bg-card-secondary px-4 py-3 transition-colors hover:border-border">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-relaxed text-text">
                          <span className="font-semibold text-accent">{event.user.name}</span>
                          {" "}
                          <span className="text-[#b0b0b0]">{event.action}</span>
                          {event.target && (
                            <>
                              {" "}
                              <span className="font-medium text-white">{event.target}</span>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {impactStyle && event.impact && (
                          <span className={`rounded-full ${impactStyle.bg} px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${impactStyle.text}`}>
                            {getImpactLabel(event.impact)}
                          </span>
                        )}
                        <span className="whitespace-nowrap text-xs text-[#9e9e9e]" suppressHydrationWarning>
                          {formatRelative(event.timestamp)}
                        </span>
                      </div>
                    </div>

                    {/* Reason block */}
                    {event.reason && (
                      <div className="mt-2 rounded-r-md border-l-2 border-accent/40 bg-card-elevated p-2">
                        <p className="text-sm italic leading-relaxed text-text-muted">{event.reason}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load more button */}
        {hasMore && !isLoadingMore && (
          <div className="mt-4 flex justify-center pb-2">
            <button
              onClick={loadMoreLogs}
              disabled={isLoadingMore}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-transparent px-4 py-2 text-sm text-[#9e9e9e] transition-colors hover:border-white/20 hover:text-white disabled:opacity-50"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              Cargar más actividad
            </button>
          </div>
        )}

        {isLoadingMore && logs.length > 0 && (
          <div className="mt-4 flex justify-center pb-2">
            <Loader2 className="h-4 w-4 animate-spin text-[#9e9e9e]" />
          </div>
        )}
      </div>
    </div>
  );
}
