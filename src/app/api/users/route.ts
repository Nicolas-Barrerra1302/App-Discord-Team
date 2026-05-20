import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/supabase/database';
import type { User } from '@/lib/types';

// =============================================================================
// GET /api/users — Lista de miembros del equipo
// =============================================================================
export async function GET() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, avatar_url, role, area, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true }) as {
    data: Pick<User, 'id' | 'name' | 'avatar_url' | 'role' | 'area' | 'is_active'>[] | null;
    error: unknown;
  };

  if (error) {
    console.error('Error al obtener usuarios:', error);
    return NextResponse.json(
      { error: 'Error al obtener usuarios' },
      { status: 500 }
    );
  }

  return NextResponse.json(users ?? []);
}
