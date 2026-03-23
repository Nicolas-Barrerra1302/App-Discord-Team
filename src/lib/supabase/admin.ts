import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types';

/**
 * Creates a Supabase client with the service role key.
 * This bypasses RLS and should ONLY be used in server-side code
 * (API routes, cron jobs, server actions) — never in client components.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
