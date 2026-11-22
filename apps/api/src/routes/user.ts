import { Hono } from 'hono';
import { z } from 'zod';
import { e164 } from '@app/shared';
import { asUser } from '../db.ts';
import { ApiError, requireUser, type AppEnv, type Deps } from '../context.ts';

const SYNC_TABLES = [
  'accounts',
  'categories',
  'transactions',
  'budgets',
  'goals',
  'bills',
] as const;

export function userRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  // ---- Perfil e consentimentos de canal ----
  r.get('/me', async (c) => {
    const uid = requireUser(c.get('userId'));
    const row = await asUser(d.db.api, uid, async (q) => {
      const { rows } = await q.query(
        `select id, email, is_anonymous, display_name, phone, email_opt_in, sms_opt_in, whatsapp_opt_in,
                (apple_sub is not null) as has_apple, (google_sub is not null) as has_google, created_at
           from public.users where id = app.uid()`,
      );
      return rows[0];
    });
    if (!row) throw new ApiError(401, 'unauthorized');
    return c.json(row);
  });

  r.patch('/me', async (c) => {
    const uid = requireUser(c.get('userId'));
    const body = z
      .object({
        displayName: z.string().trim().max(60).nullable().optional(),
        phone: e164.nullable().optional(),
        emailOptIn: z.boolean().optional(),
        smsOptIn: z.boolean().optional(),
        whatsappOptIn: z.boolean().optional(),
      })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ApiError(422, 'invalid_value', body.error.issues[0]?.message);
    const v = body.data;
    if ((v.smsOptIn || v.whatsappOptIn) && v.phone === null) {
      throw new ApiError(422, 'phone_required', 'Informe o celular para SMS/WhatsApp.');
    }
    // Escrita em users só pelo pool de serviço, sempre restrita ao próprio id.
    const { rows } = await d.db.service.query(
      `update public.users set
          display_name = case when $2 then $3 else display_name end,
          phone = case when $4 then $5 else phone end,
          email_opt_in = coalesce($6, email_opt_in),
          sms_opt_in = case when coalesce($4 and $5 is null, false) then false else coalesce($7, sms_opt_in) end,
          whatsapp_opt_in = case when coalesce($4 and $5 is null, false) then false else coalesce($8, whatsapp_opt_in) end
        where id = $1
        returning id, email, display_name, phone, email_opt_in, sms_opt_in, whatsapp_opt_in`,
      [
        uid,
        v.displayName !== undefined,
        v.displayName ?? null,
        v.phone !== undefined,
        v.phone ?? null,
        v.emailOptIn ?? null,
        v.smsOptIn ?? null,
        v.whatsappOptIn ?? null,
      ],
    );
    const u = rows[0] as { phone: string | null; sms_opt_in: boolean; whatsapp_opt_in: boolean };
    if ((u.sms_opt_in || u.whatsapp_opt_in) && !u.phone) {
      await d.db.service.query(
        'update public.users set sms_opt_in = false, whatsapp_opt_in = false where id = $1',
        [uid],
      );
      throw new ApiError(422, 'phone_required', 'Informe o celular para SMS/WhatsApp.');
    }
    return c.json(rows[0]);
  });

  /** Exclusão de conta (exigência das lojas): apaga o usuário e, em cascata, todos os dados. */
  r.delete('/me', async (c) => {
    const uid = requireUser(c.get('userId'));
    const body = z
      .object({ confirm: z.literal('EXCLUIR') })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ApiError(422, 'confirmation_required');
    await d.db.service.query('delete from public.users where id = $1', [uid]);
    return c.json({ ok: true });
  });

  r.get('/me/entitlements', async (c) => {
    const uid = requireUser(c.get('userId'));
    const data = await asUser(
      d.db.api,
      uid,
      async (q) => (await q.query('select public.my_entitlements() as e')).rows[0].e,
    );
    return c.json(data);
  });

  r.post('/me/push-tokens', async (c) => {
    const uid = requireUser(c.get('userId'));
    const body = z
      .object({
        token: z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[.+\]$/),
        platform: z.enum(['ios', 'android', 'web']),
      })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ApiError(422, 'invalid_token');
    // Um token pertence a um aparelho: se trocou de conta, passa para o novo usuário.
    await d.db.service.query(
      `insert into public.push_tokens (token, user_id, platform) values ($1, $2, $3)
       on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform,
         updated_at = now(), invalid_at = null`,
      [body.data.token, uid, body.data.platform],
    );
    return c.json({ ok: true });
  });

  r.delete('/me/push-tokens', async (c) => {
    const uid = requireUser(c.get('userId'));
    const token = z.string().safeParse((await c.req.json().catch(() => ({}))).token);
    if (token.success) {
      await d.db.service.query('delete from public.push_tokens where token = $1 and user_id = $2', [
        token.data,
        uid,
      ]);
    }
    return c.json({ ok: true });
  });

  // ---- Config pública (paywall e config remota funcionam sem login) ----
  r.get('/config', async (c) => {
    const data = await asUser(d.db.api, c.get('userId'), async (q) => {
      const { rows } = await q.query(
        'select public.get_remote_config() as config, public.get_plan_matrix() as matrix',
      );
      return rows[0];
    });
    c.header('Cache-Control', 'no-store');
    return c.json(data);
  });

  // ---- Sync ----
  r.post('/sync/:table/push', async (c) => {
    const uid = requireUser(c.get('userId'));
    const table = c.req.param('table');
    if (!SYNC_TABLES.includes(table as (typeof SYNC_TABLES)[number]))
      throw new ApiError(404, 'invalid_table');
    const body = z
      .object({ rows: z.array(z.record(z.string(), z.unknown())).max(500) })
      .safeParse(await c.req.json());
    if (!body.success) throw new ApiError(422, 'invalid_rows');
    const res = await asUser(d.db.api, uid, async (q) => {
      const { rows } = await q.query('select public.sync_push($1, $2::jsonb) as r', [
        table,
        JSON.stringify(body.data.rows),
      ]);
      return rows[0].r;
    });
    return c.json(res);
  });

  r.get('/sync/:table', async (c) => {
    const uid = requireUser(c.get('userId'));
    const table = c.req.param('table');
    if (!SYNC_TABLES.includes(table as (typeof SYNC_TABLES)[number]))
      throw new ApiError(404, 'invalid_table');
    const since = c.req.query('since') || null;
    const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 500) || 500, 1), 1000);
    const rows = await asUser(d.db.api, uid, async (q) => {
      // Cursor como texto ISO com microssegundos (sem perder precisão no JS).
      const res = await q.query(
        `select to_jsonb(t) - 'server_updated_at'
                || jsonb_build_object('server_updated_at',
                     to_char(t.server_updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) as row
           from public.${table} t
          where ($1::timestamptz is null or t.server_updated_at > $1::timestamptz)
          order by t.server_updated_at limit $2`,
        [since, limit],
      );
      return res.rows.map((x) => x.row);
    });
    return c.json(rows);
  });

  // ---- Família ----
  r.get('/households/me', async (c) => {
    const uid = requireUser(c.get('userId'));
    const h = await asUser(
      d.db.api,
      uid,
      async (q) => (await q.query('select public.my_household() as h')).rows[0].h,
    );
    return c.json(h ?? null);
  });

  r.post('/households', async (c) => {
    const uid = requireUser(c.get('userId'));
    const body = z
      .object({ name: z.string().trim().max(40).default('Família') })
      .safeParse(await c.req.json().catch(() => ({})));
    await asUser(d.db.api, uid, async (q) => {
      const mine = await q.query('select public.my_household() as h');
      if (mine.rows[0].h)
        throw new ApiError(409, 'already_in_household', 'Você já participa de uma família.');
      await q.query('select public.create_household($1)', [
        body.success ? body.data.name : 'Família',
      ]);
    });
    const h = await asUser(
      d.db.api,
      uid,
      async (q) => (await q.query('select public.my_household() as h')).rows[0].h,
    );
    return c.json(h, 201);
  });

  r.post('/households/join', async (c) => {
    const uid = requireUser(c.get('userId'));
    const body = z
      .object({ code: z.string().trim().min(4).max(16) })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ApiError(422, 'invalid_code');
    await asUser(d.db.api, uid, async (q) => {
      const mine = await q.query('select public.my_household() as h');
      if (mine.rows[0].h)
        throw new ApiError(
          409,
          'already_in_household',
          'Saia da família atual antes de entrar em outra.',
        );
      await q.query('select public.join_household($1)', [body.data.code]);
    });
    const h = await asUser(
      d.db.api,
      uid,
      async (q) => (await q.query('select public.my_household() as h')).rows[0].h,
    );
    return c.json(h);
  });

  r.delete('/households/me', async (c) => {
    const uid = requireUser(c.get('userId'));
    await asUser(d.db.api, uid, async (q) => {
      const h = (await q.query('select public.my_household() as h')).rows[0].h as {
        id: string;
        owner_id: string;
      } | null;
      if (!h) return;
      if (h.owner_id === uid) {
        // Dono encerra a família: todos voltam a ter dados só seus.
        await d.db.service.query('delete from public.household_members where household_id = $1', [
          h.id,
        ]);
        await d.db.service.query('delete from public.households where id = $1', [h.id]);
      } else {
        await q.query(
          'delete from public.household_members where household_id = $1 and user_id = app.uid()',
          [h.id],
        );
      }
    });
    return c.json({ ok: true });
  });

  return r;
}
