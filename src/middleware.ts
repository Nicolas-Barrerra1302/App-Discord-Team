import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do not remove this line — it refreshes the auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public routes that don't require authentication
  const isAuthRoute =
    pathname === '/login' || pathname.startsWith('/callback');
  const isApiRoute = pathname.startsWith('/api');

  // Unauthenticated user trying to access a protected route
  if (!user && !isAuthRoute && !isApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Authenticated user — verify they exist in the whitelist (public.users)
  if (user && !isApiRoute) {
    const discordId =
      user.user_metadata?.provider_id ??
      user.user_metadata?.sub ??
      null;

    if (discordId) {
      const { data: dbUser } = await supabase
        .from('users')
        .select('id')
        .eq('discord_id', discordId)
        .single();

      if (!dbUser) {
        // Valid auth session but not in whitelist — destroy session
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.searchParams.set('error', 'not_in_whitelist');
        return NextResponse.redirect(url);
      }
    }

    // Authenticated + whitelisted user on /login — redirect to dashboard
    if (pathname === '/login') {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/).*)',
  ],
};
