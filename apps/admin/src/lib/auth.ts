import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { roleAtLeast, type AdminRole } from '@/lib/roles';

export interface AdminSession {
  userId: string;
  email: string | null;
  role: AdminRole;
}

/** Camada de acesso: lê a sessão e o papel uma vez por request. */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  // RLS de admins só devolve linhas para quem é admin.
  const { data: row } = await supabase
    .from('admins')
    .select('role')
    .eq('user_id', data.user.id)
    .maybeSingle();
  if (!row) return null;
  return { userId: data.user.id, email: data.user.email ?? null, role: row.role as AdminRole };
});

/** Exige papel mínimo; redireciona para o login caso contrário. */
export async function requireAdmin(min: AdminRole = 'viewer'): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect('/login?error=forbidden');
  if (!roleAtLeast(session.role, min)) redirect('/?error=role');
  return session;
}
