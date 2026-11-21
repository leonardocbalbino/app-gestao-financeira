// Exclusão de conta (exigência das lojas). Apaga o usuário no Auth; as tabelas com
// "on delete cascade" (perfil, dados sincronizados, assinaturas, overrides) vão junto.
import { adminClient, corsHeaders, json, userClient } from '../_shared/supabaseAdmin.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'unauthorized' }, 401);

  const { data, error } = await userClient(auth).auth.getUser();
  if (error || !data.user) return json({ error: 'unauthorized' }, 401);

  const body = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (body.confirm !== 'EXCLUIR') return json({ error: 'confirmation_required' }, 400);

  const { error: delErr } = await adminClient().auth.admin.deleteUser(data.user.id);
  if (delErr) return json({ error: 'delete_failed' }, 500);
  return json({ ok: true });
});
