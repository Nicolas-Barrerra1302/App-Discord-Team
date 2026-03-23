'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@/lib/types';

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    async function getUser() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (authUser) {
        const discordId =
          authUser.user_metadata?.provider_id ??
          authUser.user_metadata?.sub ??
          null;

        if (discordId) {
          const { data } = await supabase
            .from('users')
            .select('*')
            .eq('discord_id', discordId)
            .single();

          if (!cancelled) {
            setUser(data as User | null);
          }
        }
      }

      if (!cancelled) {
        setLoading(false);
      }
    }

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
        setLoading(false);
      } else {
        getUser();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, loading };
}
