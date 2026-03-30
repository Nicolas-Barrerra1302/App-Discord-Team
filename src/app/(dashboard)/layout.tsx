import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { evaluateGhostClose } from "@/lib/gamification/ledger-service";
import type { User } from "@/lib/types";

// ---------------------------------------------------------------------------
// Ghost Close — Lazy Evaluation (deduplicated per React request tree)
// Checks if the user forgot to close yesterday's day and inserts a
// "missed_daily_close" record. Runs once per request, silently fails.
// ---------------------------------------------------------------------------
const runGhostCloseOnce = cache(async (userId: string) => {
  try {
    await evaluateGhostClose(userId, userId);
  } catch {
    // Non-critical: ghost close must never block dashboard rendering
  }
});

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  // Fire ghost close check — non-blocking, deduplicated per request
  void runGhostCloseOnce(user.id);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar user={user} />
      <main
        id="main-content"
        className="flex-1 overflow-x-hidden overflow-y-auto overscroll-x-none p-6 pt-16 lg:p-8 lg:pt-8"
        aria-label="Contenido principal"
      >
        {children}
      </main>
    </div>
  );
}
