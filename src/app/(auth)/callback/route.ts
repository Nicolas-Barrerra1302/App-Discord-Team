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
          .select('id, discord_id, role, name, avatar_url')
          .eq('discord_id', discordId)
          .single();

        if (!dbUser) {
          // Not in the whitelist — sign them out immediately
          await supabase.auth.signOut();
          return NextResponse.redirect(
            `${origin}/login?error=unauthorized`
          );
        }

        // User is whitelisted — sync avatar & name from Discord
        const avatarHash = user.user_metadata?.avatar_url;
        const discordName =
          user.user_metadata?.custom_claims?.global_name ??
          user.user_metadata?.global_name ??
          user.user_metadata?.full_name ??
          null;

        const updates: Record<string, string> = {};
        if (avatarHash && avatarHash !== dbUser.avatar_url) {
          updates.avatar_url = avatarHash;
        }
        if (discordName && discordName !== dbUser.name) {
          updates.name = discordName;
        }

        if (Object.keys(updates).length > 0) {
          await supabase
            .from('users')
            .update(updates)
            .eq('id', dbUser.id);
        }

        return NextResponse.redirect(`${origin}/`);
      }
    }
  }

  // Fallback: something went wrong during the OAuth exchange
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
