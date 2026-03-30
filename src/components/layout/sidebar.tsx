"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  CheckSquare,
  Trophy,
  Shield,
  Repeat,
  LogOut,
  Menu,
  X,
  Target,
  BarChart3,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/types";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Tareas", href: "/tareas", icon: CheckSquare },
  { label: "Recurrentes", href: "/recurrences", icon: Repeat },
  { label: "Bonos", href: "/bonos", icon: Trophy },
  { label: "Mis KPIs", href: "/kpis", icon: BarChart3 },
];

const ADMIN_NAV_ITEMS = [
  { label: "Panel Admin", href: "/admin", icon: Shield },
  { label: "KPIs", href: "/admin/kpis", icon: Target },
];

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  super_admin: {
    label: "Super Admin",
    className: "bg-role-super_admin/20 text-role-super_admin",
  },
  ceo: {
    label: "CEO",
    className: "bg-role-ceo/20 text-role-ceo",
  },
  member: {
    label: "Miembro",
    className: "bg-role-member/20 text-role-member",
  },
};

interface SidebarProps {
  user: User;
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = user.role === "super_admin" || user.role === "ceo";

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-card">
      {/* App name */}
      <div className="flex h-16 items-center gap-2 px-6">
        <span className="text-xl font-bold text-accent">Nico Barrera</span>
        <span className="text-xl font-bold text-text">Team</span>
      </div>

      {/* User section */}
      <div className="mx-4 mb-6 rounded-xl bg-card-secondary p-4">
        <div className="flex items-center gap-3">
          {user.avatar_url ? (
            <Image
              src={user.avatar_url}
              alt={user.name}
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-sm font-bold text-accent">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {user.name}
            </p>
            <span
              className={cn(
                "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                ROLE_BADGE[user.role]?.className ?? ROLE_BADGE.member.className
              )}
            >
              {ROLE_BADGE[user.role]?.label ?? "Miembro"}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-accent/15 text-accent"
                  : "text-[#9e9e9e] hover:bg-white/5 hover:text-[#e0e0e0]"
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}

        {/* Admin divider and section */}
        {isAdmin && (
          <>
            <div className="my-4 border-t border-white/10" />
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[#9e9e9e]">
              Administracion
            </p>
            {ADMIN_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-accent/15 text-accent"
                      : "text-[#9e9e9e] hover:bg-white/5 hover:text-[#e0e0e0]"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Sign out */}
      <div className="border-t border-white/10 p-3">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#9e9e9e] transition-colors hover:bg-white/5 hover:text-[#f44336]"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          Cerrar sesion
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger — Copper Gold, premium glow, 44×44 touch target */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-xl border border-accent/25 bg-card text-accent shadow-card transition-all duration-200 hover:border-accent/50 hover:shadow-neon-gold lg:hidden"
        aria-label="Abrir menú de navegación"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay — semi-transparent backdrop, click to close */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 lg:hidden",
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile sidebar — fixed drawer, slides in from left */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-200 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Close button — Grey Blue border, high contrast touch target */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl border border-border-subtle text-text-muted transition-colors duration-150 hover:border-border hover:text-text-heading"
          aria-label="Cerrar menú"
        >
          <X className="h-4 w-4" />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar — static, always visible */}
      <aside className="hidden w-[260px] flex-shrink-0 lg:block">
        {sidebarContent}
      </aside>
    </>
  );
}
