"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Image from "next/image";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserOption {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface AdminMultiSelectProps {
  users: UserOption[];
  onChange?: (selectedIds: string[]) => void;
}

export function AdminMultiSelect({ users, onChange }: AdminMultiSelectProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Local selected state (initialized from URL, managed locally for instant UX)
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const raw = searchParams.get("users") ?? "";
    return raw ? raw.split(",").filter(Boolean) : [];
  });

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Update URL without triggering server navigation (preserves open state)
  const updateUrl = useCallback((ids: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    if (ids.length > 0) {
      params.set("users", ids.join(","));
    } else {
      params.delete("users");
    }
    const qs = params.toString();
    window.history.replaceState(null, "", `${pathname}${qs ? `?${qs}` : ""}`);
  }, [pathname, searchParams]);

  function toggle(userId: string) {
    const next = selectedIds.includes(userId)
      ? selectedIds.filter(id => id !== userId)
      : [...selectedIds, userId];

    setSelectedIds(next);
    updateUrl(next);
    onChange?.(next);
  }

  const label =
    selectedIds.length === 0
      ? "Todos los miembros"
      : `${selectedIds.length} seleccionado${selectedIds.length > 1 ? "s" : ""}`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          "flex items-center gap-2 rounded-lg border bg-card-secondary py-1.5 pl-3 pr-8 text-sm outline-none transition-colors hover:border-border",
          selectedIds.length > 0
            ? "border-accent/40 text-text"
            : "border-border/50 text-text"
        )}
      >
        {label}
        <ChevronDown
          className={cn(
            "pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9e9e9e] transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-card-secondary py-1 shadow-xl">
          {users.map(u => {
            const checked = selectedIds.includes(u.id);
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => toggle(u.id)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-white/5"
              >
                {/* Checkbox */}
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                    checked
                      ? "border-accent bg-accent"
                      : "border-border/50 bg-transparent"
                  )}
                >
                  {checked && <Check className="h-3 w-3 text-white" />}
                </span>

                {/* Avatar */}
                {u.avatar_url ? (
                  <Image
                    src={u.avatar_url}
                    alt={u.name}
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                ) : (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
                    {u.name.charAt(0).toUpperCase()}
                  </span>
                )}

                {/* Name */}
                <span className={cn("truncate", checked ? "text-white" : "text-[#e0e0e0]")}>
                  {u.name}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
