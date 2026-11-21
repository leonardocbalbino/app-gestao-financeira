// Uma chamada com tudo que o app precisa ao abrir: config remota, matriz de planos e
// (se autenticado) os entitlements do usuário. Alternativa às RPCs individuais.
import { corsHeaders, json, userClient } from '../_shared/supabaseAdmin.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const auth = req.headers.get('Authorization') ?? `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`;
  const db = userClient(auth);

  const [config, matrix, user] = await Promise.all([
    db.rpc('get_remote_config'),
    db.rpc('get_plan_matrix'),
    db.auth.getUser(),
  ]);
  if (config.error || matrix.error) return json({ error: 'config_failed' }, 500);

  let entitlements: unknown = null;
  if (user.data.user) {
    const ent = await db.rpc('my_entitlements');
    if (!ent.error) entitlements = ent.data;
  }

  return new Response(JSON.stringify({ config: config.data, matrix: matrix.data, entitlements }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
});
