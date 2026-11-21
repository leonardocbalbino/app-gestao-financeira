import { createClient } from '@supabase/supabase-js';
import { ADMIN, CUSTOMER } from './fixtures';

/** Cria (ou recria) o admin owner e um cliente de teste no Supabase local. */
export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service)
    throw new Error(
      'Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (Supabase local).',
    );
  if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error('E2E só roda contra Supabase local.');
  const sb = createClient(url, service, { auth: { persistSession: false } });

  const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
  for (const u of list?.users ?? []) {
    if (u.email === ADMIN.email || u.email === CUSTOMER.email) await sb.auth.admin.deleteUser(u.id);
  }
  const admin = await sb.auth.admin.createUser({ ...ADMIN, email_confirm: true });
  await sb.auth.admin.createUser({ ...CUSTOMER, email_confirm: true });
  if (!admin.data.user) throw new Error('Falha ao criar admin de teste');
  const { error } = await sb.from('admins').insert({ user_id: admin.data.user.id, role: 'owner' });
  if (error) throw error;
  // matriz limpa para o teste
  await sb.rpc('discard_plan_matrix_draft').then(
    () => undefined,
    () => undefined,
  );
}
