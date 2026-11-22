import { Hono } from 'hono';
import {
  isAuthorized,
  mapEvent,
  resolveUserId,
  shouldApply,
  type RevenueCatEvent,
} from '../billing/revenuecat.ts';
import type { AppEnv, Deps } from '../context.ts';

/** Webhook do RevenueCat → tabela subscriptions. Authorization: "Bearer <REVENUECAT_WEBHOOK_AUTH>". */
export function webhookRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  r.post('/revenuecat', async (c) => {
    if (!isAuthorized(c.req.header('authorization') ?? null, d.cfg.REVENUECAT_WEBHOOK_AUTH ?? '')) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    const body = (await c.req.json().catch(() => null)) as { event?: RevenueCatEvent } | null;
    const event = body?.event;
    if (!event?.id || !event.type) return c.json({ error: 'invalid_payload' }, 400);
    const svc = d.db.service;

    if (event.type === 'TRANSFER') {
      const from = (event.transferred_from ?? []).filter((id) =>
        resolveUserId({ id: event.id, type: 'X', app_user_id: id }),
      );
      if (from.length)
        await svc.query(
          "update public.subscriptions set status = 'expired' where user_id = any($1::uuid[])",
          [from],
        );
      return c.json({ ok: true, handled: 'transfer' });
    }

    const up = mapEvent(event);
    if (!up) return c.json({ ok: true, ignored: event.type });
    const exists = await svc.query('select 1 from public.users where id = $1', [up.user_id]);
    if (!exists.rowCount) return c.json({ ok: true, ignored: 'unknown_user' });

    const { rows } = await svc.query<{ last_event_id: string | null; last_event_at: Date | null }>(
      'select last_event_id, last_event_at from public.subscriptions where user_id = $1',
      [up.user_id],
    );
    const cur = rows[0]
      ? {
          last_event_id: rows[0].last_event_id,
          last_event_at: rows[0].last_event_at?.toISOString() ?? null,
        }
      : null;
    if (!shouldApply(up, cur)) return c.json({ ok: true, skipped: 'stale_or_duplicate' });

    await svc.query(
      `insert into public.subscriptions (user_id, rc_entitlement, status, store, product_id, period_type, expires_at,
          original_transaction_id, last_event_id, last_event_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (user_id) do update set rc_entitlement = excluded.rc_entitlement, status = excluded.status,
          store = excluded.store, product_id = excluded.product_id, period_type = excluded.period_type,
          expires_at = excluded.expires_at, original_transaction_id = excluded.original_transaction_id,
          last_event_id = excluded.last_event_id, last_event_at = excluded.last_event_at`,
      [
        up.user_id,
        up.rc_entitlement,
        up.status,
        up.store,
        up.product_id,
        up.period_type,
        up.expires_at,
        up.original_transaction_id,
        up.last_event_id,
        up.last_event_at,
      ],
    );
    return c.json({ ok: true, status: up.status });
  });
  return r;
}
