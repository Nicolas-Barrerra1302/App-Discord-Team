import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import type { User } from "@/lib/types";

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

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f0f0f]">
      <Sidebar user={user} />
      <main className="flex-1 overflow-y-auto p-6 pt-16 lg:p-8 lg:pt-8">
        {children}
      </main>
    </div>
  );
}
