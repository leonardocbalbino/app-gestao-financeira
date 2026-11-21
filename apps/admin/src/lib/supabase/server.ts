import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { env } from '@/lib/env';

/**
 * Cliente Supabase com a sessão do admin (cookie). Usa SEMPRE a anon key: as permissões vêm
 * do RLS + is_admin(). A service_role nunca é usada no painel.
 */
export async function createClient() {
  const store = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Chamado de um Server Component (somente leitura): o proxy renova a sessão.
        }
      },
    },
  });
}
