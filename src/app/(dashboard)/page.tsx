import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Clock, CheckCircle2, AlertTriangle, Zap } from "lucide-react";
import type { User } from "@/lib/types";

const STATS = [
  {
    label: "Tareas Pendientes",
    value: 0,
    icon: Clock,
    color: "#2196f3",
  },
  {
    label: "Completadas Hoy",
    value: 0,
    icon: CheckCircle2,
    color: "#00e676",
  },
  {
    label: "Atrasadas",
    value: 0,
    icon: AlertTriangle,
    color: "#f44336",
  },
  {
    label: "Racha",
    value: 0,
    icon: Zap,
    color: "#ff9800",
  },
];

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/login");

  const discordId =
    authUser.user_metadata?.provider_id || authUser.user_metadata?.sub;
  const { data: user } = (await supabase
    .from("users")
    .select("*")
    .eq("discord_id", discordId)
    .single()) as { data: User | null };

  if (!user) redirect("/login");

  const firstName = user.name.split(" ")[0];
  const today = new Date();

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-white md:text-3xl">
          Hola, {firstName}
        </h1>
        <p className="mt-1 text-sm capitalize text-[#9e9e9e]">
          {formatDate(today)}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-xl border border-white/5 bg-[#1e1e2e] p-5"
            >
              <div className="mb-3 flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${stat.color}15` }}
                >
                  <Icon
                    className="h-5 w-5"
                    style={{ color: stat.color }}
                  />
                </div>
              </div>
              <p className="text-3xl font-bold text-white">{stat.value}</p>
              <p className="mt-1 text-sm text-[#9e9e9e]">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Recent activity */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">
          Actividad Reciente
        </h2>
        <div className="rounded-xl border border-white/5 bg-[#1e1e2e] p-8 text-center text-[#9e9e9e]">
          Sin actividad reciente
        </div>
      </div>
    </div>
  );
}
