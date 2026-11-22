import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { roleAtLeast, type AdminRole } from '@/lib/roles';

export interface AdminSession {
  userId: string;
  email: string | null;
  role: AdminRole;
}

/** Sessão + papel do admin (uma consulta por request). */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  try {
    return await apiFetch<AdminSession>('GET', '/admin/session');
  } catch {
    return null;
  }
});

/** Exige papel mínimo; redireciona para o login caso contrário. */
export async function requireAdmin(min: AdminRole = 'viewer'): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect('/login?error=forbidden');
  if (!roleAtLeast(session.role, min)) redirect('/?error=role');
  return session;
}
