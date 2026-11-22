import { Hono } from 'hono';
import { z } from 'zod';
import { adConfigSchema, appConfigSchema, e164 } from '@app/shared';
import { asUser, type Queryable } from '../db.ts';
import { ApiError, requireUser, type AppEnv, type Deps } from '../context.ts';
import { hashPassword } from '../auth/crypto.ts';

type Role = 'viewer' | 'editor' | 'owner';
const featureValue = z.union([z.boolean(), z.number().int().min(0), z.null()]);

/**
 * Painel admin. Todas as consultas rodam COMO o admin (RLS + is_admin), então a auditoria
 * registra quem fez cada mudança.
 */
export function adminRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  async function asAdmin<T>(
    uid: string | null,
    min: Role,
    fn: (q: Queryable) => Promise<T>,
  ): Promise<T> {
    const id = requireUser(uid);
    return asUser(d.db.api, id, async (q) => {
      const ok = (await q.query('select public.is_admin($1) as ok', [min])).rows[0].ok;
      if (!ok) throw new ApiError(403, 'forbidden', 'Sem permissão para esta ação.');
      return fn(q);
    });
  }
  const json = async (c: { req: { json: () => Promise<unknown> } }) =>
    c.req.json().catch(() => ({}));

  r.get('/session', async (c) => {
    const uid = requireUser(c.get('userId'));
    const row = await asUser(
      d.db.api,
      uid,
      async (q) =>
        (
          await q.query(
            'select a.role, u.email from public.admins a join public.users u on u.id = a.user_id where a.user_id = app.uid()',
          )
        ).rows[0],
    );
    if (!row) throw new ApiError(403, 'forbidden');
    return c.json({ userId: uid, email: row.email, role: row.role });
  });

  r.get('/stats', (c) =>
    asAdmin(c.get('userId'), 'viewer', async (q) =>
      c.json((await q.query('select public.admin_stats() as s')).rows[0].s),
    ),
  );

  r.get('/audit', (c) =>
    asAdmin(c.get('userId'), 'viewer', async (q) => {
      const entity = c.req.query('entity') || null;
      const page = Math.max(0, Number(c.req.query('page') ?? 0) || 0);
      const limit = Math.min(Number(c.req.query('limit') ?? 50) || 50, 200);
      const { rows } = await q.query(
        `select l.id, l.actor_id, u.email as actor_email, l.action, l.entity, l.entity_id, l.before, l.after, l.created_at
           from public.admin_audit_log l left join public.users u on u.id = l.actor_id
          where ($1::text is null or l.entity = $1) order by l.created_at desc limit $2 offset $3`,
        [entity, limit, page * limit],
      );
      return c.json(rows);
    }),
  );

  // ---- Planos e matriz ----
  r.get('/plans', (c) =>
    asAdmin(c.get('userId'), 'viewer', async (q) =>
      c.json((await q.query('select * from public.plans order by sort_order')).rows),
    ),
  );

  const planBody = z.object({
    id: z.string().regex(/^[a-z0-9_]+$/),
    name: z.string().trim().min(1).max(40),
    description: z.string().trim().max(200).default(''),
    rc_entitlement: z
      .string()
      .trim()
      .nullable()
      .transform((v) => (v ? v : null)),
    sort_order: z.number().int(),
    active: z.boolean(),
  });

  r.post('/plans', (c) =>
    asAdmin(c.get('userId'), 'editor', async (q) => {
      const b = planBody.safeParse(await json(c));
      if (!b.success) throw new ApiError(422, 'invalid_plan', b.error.issues[0]?.message);
      await q.query(
        'insert into public.plans (id, name, description, rc_entitlement, sort_order, active) values ($1,$2,$3,$4,$5,$6)',
        [
          b.data.id,
          b.data.name,
          b.data.description,
          b.data.rc_entitlement,
          b.data.sort_order,
          b.data.active,
        ],
      );
      return c.json({ ok: true }, 201);
    }),
  );

  r.put('/plans/:id', (c) =>
    asAdmin(c.get('userId'), 'editor', async (q) => {
      const b = planBody.omit({ id: true }).safeParse(await json(c));
      if (!b.success) throw new ApiError(422, 'invalid_plan', b.error.issues[0]?.message);
      await q.query(
        'update public.plans set name=$2, description=$3, rc_entitlement=$4, sort_order=$5, active=$6 where id=$1',
        [
          c.req.param('id'),
          b.data.name,
          b.data.description,
          b.data.rc_entitlement,
          b.data.sort_order,
          b.data.active,
        ],
      );
      return c.json({ ok: true });
    }),
  );

  r.get('/matrix', (c) =>
    asAdmin(c.get('userId'), 'viewer', async (q) => {
      const [plans, features, draft, diff] = await Promise.all([
        q.query('select id, name, is_default, active from public.plans order by sort_order'),
        q.query(
          'select key, type, label, group_name, paywall_visible from public.features order by sort_order',
        ),
        q.query('select plan_id, feature_key, value from public.plan_features_draft'),
        q.query('select * from public.plan_matrix_diff()'),
      ]);
      return c.json({
        plans: plans.rows,
        features: features.rows,
        draft: draft.rows,
        diff: diff.rows,
      });
    }),
  );

  r.put('/matrix/draft', (c) =>
    asAdmin(c.get('userId'), 'editor', async (q) => {
      const b = z
        .object({ planId: z.string(), featureKey: z.string(), value: featureValue })
        .safeParse(await json(c));
      if (!b.success) throw new ApiError(422, 'invalid_value');
      await q.query(
        `insert into public.plan_features_draft (plan_id, feature_key, value, updated_at) values ($1, $2, $3::jsonb, now())
         on conflict (plan_id, feature_key) do update set value = excluded.value, updated_at = now(), updated_by = app.uid()`,
        [b.data.planId, b.data.featureKey, JSON.stringify(b.data.value)],
      );
      return c.json({ ok: true });
    }),
  );

  r.put('/features/:key/paywall', (c) =>
    asAdmin(c.get('userId'), 'editor', async (q) => {
      const b = z.object({ visible: z.boolean() }).safeParse(await json(c));
      if (!b.success) throw new ApiError(422, 'invalid_value');
      await q.query('update public.features set paywall_visible = $2 where key = $1', [
        c.req.param('key'),
        b.data.visible,
      ]);
      return c.json({ ok: true });
    }),
  );

  r.post('/matrix/publish', (c) =>
    asAdmin(c.get('userId'), 'editor', async (q) =>
      c.json({ changed: (await q.query('select public.publish_plan_matrix() as n')).rows[0].n }),
    ),
  );
  r.post('/matrix/discard', (c) =>
    asAdmin(c.get('userId'), 'editor', async (q) => {
      await q.query('select public.discard_plan_matrix_draft()');
      return c.json({ ok: true });
    }),
  );

  // ---- Configurações remotas ----
  for (const [path, table, schema] of [
    ['ad-config', 'ad_config', adConfigSchema],
    ['app-config', 'app_config', appConfigSchema],
  ] as const) {
    r.get(`/${path}`, (c) =>
      asAdmin(c.get('userId'), 'viewer', async (q) => {
        const { rows } = await q.query(`select data, updated_at from public.${table} where id = 1`);
        return c.json({
          data: schema.parse(rows[0]?.data ?? {}),
          updatedAt: rows[0]?.updated_at ?? null,
        });
      }),
    );
    r.put(`/${path}`, (c) =>
      asAdmin(c.get('userId'), 'editor', async (q) => {
        const b = schema.safeParse(await json(c));
        if (!b.success) throw new ApiError(422, 'invalid_config', b.error.issues[0]?.message);
        await q.query(`update public.${table} set data = $1::jsonb where id = 1`, [
          JSON.stringify(b.data),
        ]);
        return c.json({ ok: true });
      }),
    );
  }

  // ---- Usuários ----
  r.get('/users', (c) =>
    asAdmin(c.get('userId'), 'viewer', async (q) => {
      const { rows } = await q.query('select * from public.admin_search_users($1, $2, $3)', [
        c.req.query('q') ?? '',
        Number(c.req.query('limit') ?? 50) || 50,
        Number(c.req.query('offset') ?? 0) || 0,
      ]);
      return c.json(rows);
    }),
  );

  r.get('/users/:id', (c) =>
    asAdmin(c.get('userId'), 'viewer', async (q) => {
      const detail = (
        await q.query('select public.admin_user_detail($1) as d', [c.req.param('id')])
      ).rows[0].d;
      if (!detail?.user) throw new ApiError(404, 'not_found');
      return c.json(detail);
    }),
  );

  r.post('/users/:id/grants', (c) =>
    asAdmin(c.get('userId'), 'editor', async (q) => {
      const b = z
        .object({
          planId: z.string(),
          days: z.number().int().min(0).max(3650),
          reason: z.string().trim().min(1).max(200),
        })
        .safeParse(await json(c));
      if (!b.success) throw new ApiError(422, 'invalid_grant', 'Informe plano, duração e motivo.');
      await q.query(
        `insert into public.manual_grants (user_id, plan_id, expires_at, reason)
         values ($1, $2, case when $3 > 0 then now() + ($3 || ' days')::interval end, $4)`,
        [c.req.param('id'), b.data.planId, b.data.days, b.data.reason],
      );
      return c.json({ ok: true }, 201);
    }),
  );

  r.post('/grants/:id/revoke', (c) =>
    asAdmin(c.get('userId'), 'editor', async (q) => {
      await q.query(
        'update public.manual_grants set revoked_at = now() where id = $1 and revoked_at is null',
        [c.req.param('id')],
      );
      return c.json({ ok: true });
    }),
  );

  r.put('/users/:id/overrides/:key', (c) =>
    asAdmin(c.get('userId'), 'editor', async (q) => {
      const b = z
        .object({
          value: featureValue,
          days: z.number().int().min(0).default(0),
          reason: z.string().max(200).default(''),
        })
        .safeParse(await json(c));
      if (!b.success) throw new ApiError(422, 'invalid_value');
      await q.query(
        `insert into public.user_plan_overrides (user_id, feature_key, value, reason, expires_at)
         values ($1, $2, $3::jsonb, $4, case when $5 > 0 then now() + ($5 || ' days')::interval end)
         on conflict (user_id, feature_key) do update set value = excluded.value, reason = excluded.reason,
           expires_at = excluded.expires_at`,
        [
          c.req.param('id'),
          c.req.param('key'),
          JSON.stringify(b.data.value),
          b.data.reason,
          b.data.days,
        ],
      );
      return c.json({ ok: true });
    }),
  );

  r.delete('/users/:id/overrides/:key', (c) =>
    asAdmin(c.get('userId'), 'editor', async (q) => {
      await q.query(
        'delete from public.user_plan_overrides where user_id = $1 and feature_key = $2',
        [c.req.param('id'), c.req.param('key')],
      );
      return c.json({ ok: true });
    }),
  );

  // ---- Lembretes: envios e status dos canais ----
  r.get('/deliveries', (c) =>
    asAdmin(c.get('userId'), 'viewer', async (q) => {
      const status = c.req.query('status') || null;
      const { rows } = await q.query(
        `select d.id, d.channel, d.recipient, d.status, d.scheduled_for, d.sent_at, d.attempts, d.last_error, d.provider,
                u.email as user_email, r.title, r.kind
           from public.reminder_deliveries d
           join public.users u on u.id = d.user_id
           join public.reminders r on r.id = d.reminder_id
          where ($1::text is null or d.status = $1) and d.status <> 'cancelled'
          order by d.scheduled_for desc limit 200`,
        [status],
      );
      const { rows: counts } = await q.query(
        `select channel, status, count(*)::int as n from public.reminder_deliveries
          where created_at > now() - interval '7 days' and status <> 'cancelled' group by 1, 2`,
      );
      return c.json({ deliveries: rows, last7d: counts, channels: d.providers.status() });
    }),
  );

  // ---- Administradores (owner) ----
  r.get('/admins', (c) =>
    asAdmin(c.get('userId'), 'viewer', async (q) =>
      c.json((await q.query('select * from public.admin_list_admins()')).rows),
    ),
  );

  r.put('/admins', (c) =>
    asAdmin(c.get('userId'), 'owner', async (q) => {
      const b = z
        .object({
          email: z.string().trim().toLowerCase().email(),
          role: z.enum(['viewer', 'editor', 'owner', '']),
          password: z.string().min(10).max(200).optional(),
        })
        .safeParse(await json(c));
      if (!b.success)
        throw new ApiError(422, 'invalid_admin', 'E-mail válido e senha com 10+ caracteres.');
      if (b.data.password) {
        // Cria (ou atualiza a senha de) uma conta de administrador.
        await d.db.service.query(
          `insert into public.users (email, email_verified_at, password_hash) values ($1, now(), $2)
           on conflict (email) do update set password_hash = excluded.password_hash`,
          [b.data.email, await hashPassword(b.data.password)],
        );
      }
      await q.query('select public.admin_set_role($1, $2)', [b.data.email, b.data.role]);
      return c.json({ ok: true });
    }),
  );

  // Telefone de teste para canais (útil para validar Twilio sem criar lembrete)
  r.post('/channels/test', (c) =>
    asAdmin(c.get('userId'), 'editor', async () => {
      const b = z
        .object({ channel: z.enum(['email', 'sms', 'whatsapp']), to: z.string().min(3) })
        .safeParse(await json(c));
      if (!b.success) throw new ApiError(422, 'invalid_value');
      const text = 'Mensagem de teste do painel administrativo.';
      if (b.data.channel !== 'email' && !e164.safeParse(b.data.to).success)
        throw new ApiError(422, 'invalid_phone');
      const res =
        b.data.channel === 'email'
          ? await d.providers.email({ to: b.data.to, subject: 'Teste de canal', text })
          : b.data.channel === 'sms'
            ? await d.providers.sms(b.data.to, text)
            : await d.providers.whatsapp(b.data.to, text);
      return c.json(res);
    }),
  );

  return r;
}
