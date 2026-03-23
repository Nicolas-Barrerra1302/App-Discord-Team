import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Get the authenticated user's Discord info
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Extract the Discord ID from user metadata
        const discordId =
          user.user_metadata?.provider_id ??
          user.user_metadata?.sub ??
          null;

        if (!discordId) {
          await supabase.auth.signOut();
          return NextResponse.redirect(
            `${origin}/login?error=auth_failed`
          );
        }

        // Whitelist check: user must exist in the pre-seeded users table
        const { data: dbUser } = await supabase
          .from('users')
          .select('id, discord_id, role')
          .eq('discord_id', discordId)
          .single();

        if (!dbUser) {
          // Not in the whitelist — sign them out immediately
          await supabase.auth.signOut();
          return NextResponse.redirect(
            `${origin}/login?error=unauthorized`
          );
        }

        // User is whitelisted — proceed to dashboard
        return NextResponse.redirect(`${origin}/dashboard`);
      }
    }
  }

  // Fallback: something went wrong during the OAuth exchange
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
