// Webhook do RevenueCat → tabela subscriptions (fonte do plano efetivo).
// Configure no painel do RevenueCat: Authorization = "Bearer <REVENUECAT_WEBHOOK_AUTH>".
import { adminClient, json } from '../_shared/supabaseAdmin.ts';
import {
  isAuthorized,
  mapEvent,
  resolveUserId,
  shouldApply,
  type RevenueCatEvent,
} from '../_shared/revenuecat.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_AUTH') ?? '';
  if (!isAuthorized(req.headers.get('Authorization'), secret)) {
    return json({ error: 'unauthorized' }, 401);
  }

  let event: RevenueCatEvent;
  try {
    const body = (await req.json()) as { event?: RevenueCatEvent };
    if (!body.event?.id || !body.event.type) return json({ error: 'invalid_payload' }, 400);
    event = body.event;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const db = adminClient();

  // Transferência entre usuários: expira no(s) antigo(s); o novo dono recebe evento próprio.
  if (event.type === 'TRANSFER') {
    const from = (event.transferred_from ?? []).filter((id) =>
      resolveUserId({ id: event.id, type: 'X', app_user_id: id }),
    );
    if (from.length) {
      await db.from('subscriptions').update({ status: 'expired' }).in('user_id', from);
    }
    return json({ ok: true, handled: 'transfer' });
  }

  const upsert = mapEvent(event);
  if (!upsert) return json({ ok: true, ignored: event.type });

  const { data: current, error: readErr } = await db
    .from('subscriptions')
    .select('last_event_id,last_event_at')
    .eq('user_id', upsert.user_id)
    .maybeSingle();
  if (readErr) return json({ error: 'db_read_failed' }, 500);

  if (!shouldApply(upsert, current)) return json({ ok: true, skipped: 'stale_or_duplicate' });

  const { error } = await db.from('subscriptions').upsert(upsert, { onConflict: 'user_id' });
  if (error) {
    // 500 faz o RevenueCat reenviar o evento depois.
    return json({ error: 'db_write_failed' }, 500);
  }
  return json({ ok: true, status: upsert.status });
});
