/**
 * Global dashboard loading skeleton.
 * Rendered by Next.js App Router as the Suspense fallback for all
 * `(dashboard)` page segments while their async Server Components resolve.
 * Layout mirrors PersonalDashboard so the transition is near-seamless.
 */
export default function DashboardLoading() {
  return (
    <div
      className="space-y-8"
      aria-busy="true"
      aria-label="Cargando panel de control"
      role="status"
    >
      {/* ------------------------------------------------------------------ */}
      {/* HEADER + FILTER BAR                                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-44 animate-pulse rounded-lg bg-white/[0.07]" />
          <div className="h-4 w-36 animate-pulse rounded bg-white/[0.05]" />
        </div>
        {/* Date range tabs placeholder */}
        <div className="h-10 w-64 animate-pulse rounded-lg bg-white/[0.07]" />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* HERO SECTION — top-2 priority tasks                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-2xl border border-border bg-card-secondary p-6 md:p-8">
        <div className="mb-6 space-y-2">
          <div className="h-7 w-56 animate-pulse rounded-lg bg-white/[0.07]" />
          <div className="h-4 w-40 animate-pulse rounded bg-white/[0.05]" />
          <div className="mt-3 h-8 w-36 animate-pulse rounded-full bg-white/[0.05]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 animate-pulse rounded bg-white/[0.07]" />
                <div className="h-3.5 w-20 animate-pulse rounded bg-white/[0.05]" />
              </div>
              <div className="h-5 w-full animate-pulse rounded bg-white/[0.07]" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-white/[0.05]" />
              <div className="flex items-center gap-2">
                <div className="h-5 w-16 animate-pulse rounded-full bg-white/[0.05]" />
                <div className="h-5 w-16 animate-pulse rounded-full bg-white/[0.05]" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* STAT CARDS (4)                                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card-secondary p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-lg bg-white/[0.07]" />
              <div className="space-y-1.5">
                <div className="h-7 w-10 animate-pulse rounded bg-white/[0.08]" />
                <div className="h-3 w-20 animate-pulse rounded bg-white/[0.05]" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* HEALTH GRID — completion ring + cognitive load + estimation + stress */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-2xl border border-border bg-card-secondary p-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="h-4 w-4 animate-pulse rounded bg-white/[0.05]" />
          <div className="h-5 w-48 animate-pulse rounded bg-white/[0.07]" />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-lg bg-white/[0.07]" />
                <div className="space-y-1">
                  <div className="h-3.5 w-24 animate-pulse rounded bg-white/[0.07]" />
                  <div className="h-3 w-20 animate-pulse rounded bg-white/[0.04]" />
                </div>
              </div>
              <div className="h-28 w-full animate-pulse rounded-lg bg-white/[0.06]" />
              <div className="h-7 w-full animate-pulse rounded-lg bg-white/[0.05]" />
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* IMPACT + ACTIVITY ROW                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Value matrix skeleton */}
        <div className="rounded-xl border border-border bg-card-secondary p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-pulse rounded bg-white/[0.05]" />
            <div className="h-5 w-36 animate-pulse rounded bg-white/[0.07]" />
          </div>
          <div className="grid grid-cols-2 grid-rows-2 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-white/[0.06]" />
            ))}
          </div>
        </div>

        {/* Activity log skeleton */}
        <div className="rounded-xl border border-border bg-card-secondary p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-pulse rounded bg-white/[0.05]" />
            <div className="h-5 w-28 animate-pulse rounded bg-white/[0.07]" />
          </div>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-white/[0.07]" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-full animate-pulse rounded bg-white/[0.07]" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-white/[0.04]" />
              </div>
            </div>
          ))}
          <div className="h-8 w-28 animate-pulse rounded-lg bg-white/[0.05]" />
        </div>
      </div>
    </div>
  );
}
