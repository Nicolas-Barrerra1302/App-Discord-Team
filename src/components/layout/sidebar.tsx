"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  CheckSquare,
  Trophy,
  Calendar,
  Shield,
  Repeat,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/types";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Tareas", href: "/dashboard/tasks", icon: CheckSquare },
  { label: "Bonos", href: "/dashboard/bonuses", icon: Trophy },
  { label: "Calendario", href: "/dashboard/calendar", icon: Calendar },
];

const ADMIN_NAV_ITEMS = [
  { label: "Panel Admin", href: "/dashboard/admin/dashboard", icon: Shield },
  { label: "Recurrentes", href: "/dashboard/admin/recurrences", icon: Repeat },
];

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  super_admin: {
    label: "Super Admin",
    className: "bg-[#e91e63]/20 text-[#e91e63]",
  },
  ceo: {
    label: "CEO",
    className: "bg-[#2196f3]/20 text-[#2196f3]",
  },
  member: {
    label: "Miembro",
    className: "bg-[#9e9e9e]/20 text-[#9e9e9e]",
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
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#16213e]">
      {/* App name */}
      <div className="flex h-16 items-center gap-2 px-6">
        <span className="text-xl font-bold text-[#e91e63]">Mind Fuel</span>
        <span className="text-xl font-bold text-white">Team</span>
      </div>

      {/* User section */}
      <div className="mx-4 mb-6 rounded-xl bg-[#1e1e2e] p-4">
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
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e91e63]/20 text-sm font-bold text-[#e91e63]">
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
                  ? "bg-[#e91e63]/15 text-[#e91e63]"
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
                      ? "bg-[#e91e63]/15 text-[#e91e63]"
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
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-lg bg-[#1e1e2e] p-2 text-[#e0e0e0] lg:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[260px] transform transition-transform duration-200 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-4 rounded-lg p-1 text-[#9e9e9e] hover:text-white"
          aria-label="Cerrar menu"
        >
          <X className="h-5 w-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden w-[260px] flex-shrink-0 lg:block">
        {sidebarContent}
      </aside>
    </>
  );
}
