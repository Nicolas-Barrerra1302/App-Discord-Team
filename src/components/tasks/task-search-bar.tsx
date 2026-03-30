"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function TaskSearchBar() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const urlSearch = searchParams.get("search") ?? "";
  const [local, setLocal] = useState(urlSearch);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync URL → local on external navigation (back/forward)
  useEffect(() => {
    setLocal(urlSearch);
  }, [urlSearch]);

  const pushToUrl = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = value.trim();
      if (trimmed) {
        params.set("search", trimmed);
      } else {
        params.delete("search");
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const handleChange = (v: string) => {
    setLocal(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => pushToUrl(v), 300);
  };

  return (
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
      <input
        type="text"
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Buscar tareas..."
        className={cn(
          "h-10 w-full rounded-lg border border-white/10 bg-card-secondary pl-9 pr-8 text-sm text-text placeholder-text-muted/50",
          "focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/25 transition-colors"
        )}
      />
      {local && (
        <button
          onClick={() => handleChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-muted hover:text-text transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
