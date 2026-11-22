import { Hono } from 'hono';
import { z } from 'zod';
import { brand } from '@app/shared';
import { ApiError, type AppEnv, type Deps } from '../context.ts';
import { generateOtp, hashOtp, safeEqual, verifyPassword } from '../auth/crypto.ts';

const email = z.string().trim().toLowerCase().email();
const OTP_TTL_MIN = 10;
const OTP_MAX_ATTEMPTS = 5;

interface UserRow {
  id: string;
  is_anonymous: boolean;
}

export function authRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  const svc = d.db.service;
  const ua = (h: string | undefined) => h ?? undefined;

  const respond = async (user: UserRow, userAgent?: string) => ({
    ...(await d.tokens.issue(user.id, user.is_anonymous, undefined, userAgent)),
    user: { id: user.id, isAnonymous: user.is_anonymous },
  });

  /** Sessão anônima: o app funciona sem cadastro (compras e entitlements ficam vinculados). */
  r.post('/anonymous', async (c) => {
    const { rows } = await svc.query<UserRow>(
      'insert into public.users (is_anonymous) values (true) returning id, is_anonymous',
    );
    return c.json(await respond(rows[0]!, ua(c.req.header('user-agent'))));
  });

  /**
   * Envia código por e-mail. Se o chamador é anônimo e o e-mail é novo, o código vincula o e-mail
   * ao MESMO usuário (mantém dados e assinatura); se o e-mail já tem conta, faz login nela.
   */
  r.post('/email/start', async (c) => {
    const body = z.object({ email }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ApiError(422, 'invalid_email', 'E-mail inválido.');
    const addr = body.data.email;

    const recent = await svc.query<{ n: number }>(
      "select count(*)::int as n from public.email_otps where email = $1 and created_at > now() - interval '10 minutes'",
      [addr],
    );
    if ((recent.rows[0]?.n ?? 0) >= 5)
      throw new ApiError(429, 'rate_limited', 'Muitas tentativas. Aguarde alguns minutos.');

    let linkUserId: string | null = null;
    const caller = c.get('userId');
    if (caller && c.get('anon')) {
      const taken = await svc.query('select 1 from public.users where email = $1', [addr]);
      if (!taken.rowCount) linkUserId = caller;
    }

    const fixed = d.cfg.fixedOtp.get(addr);
    const code = fixed ?? generateOtp();
    await svc.query(
      `insert into public.email_otps (email, code_hash, link_user_id, expires_at)
       values ($1, $2, $3, now() + ($4 || ' minutes')::interval)`,
      [addr, hashOtp(d.cfg.JWT_SECRET, addr, code), linkUserId, String(OTP_TTL_MIN)],
    );
    if (!fixed) {
      await d.providers.email({
        to: addr,
        subject: `${code} é seu código de acesso`,
        text: `Seu código para entrar no ${brand.name}: ${code}\nEle expira em ${OTP_TTL_MIN} minutos. Se não foi você, ignore este e-mail.`,
        html: `<div style="font-family:sans-serif;color:#14201B"><p>Seu código para entrar no <b>${brand.name}</b>:</p><p style="font-size:32px;font-weight:800;letter-spacing:6px;color:#0B6E4F">${code}</p><p style="color:#5B6661">Expira em ${OTP_TTL_MIN} minutos. Se não foi você, ignore este e-mail.</p></div>`,
      });
    }
    return c.json({ flow: linkUserId ? 'link' : 'sign_in' });
  });

  r.post('/email/verify', async (c) => {
    const body = z
      .object({ email, code: z.string().regex(/^\d{6}$/) })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ApiError(422, 'invalid_code', 'Código inválido.');
    const { email: addr, code } = body.data;

    const { rows } = await svc.query<{
      id: string;
      code_hash: string;
      attempts: number;
      link_user_id: string | null;
    }>(
      `select id, code_hash, attempts, link_user_id from public.email_otps
        where email = $1 and consumed_at is null and expires_at > now()
        order by created_at desc limit 1`,
      [addr],
    );
    const otp = rows[0];
    if (!otp || otp.attempts >= OTP_MAX_ATTEMPTS)
      throw new ApiError(401, 'invalid_code', 'Código inválido ou expirado.');
    if (!safeEqual(otp.code_hash, hashOtp(d.cfg.JWT_SECRET, addr, code))) {
      await svc.query('update public.email_otps set attempts = attempts + 1 where id = $1', [
        otp.id,
      ]);
      throw new ApiError(401, 'invalid_code', 'Código inválido ou expirado.');
    }
    await svc.query('update public.email_otps set consumed_at = now() where id = $1', [otp.id]);

    let user: UserRow | undefined;
    if (otp.link_user_id) {
      const res = await svc.query<UserRow>(
        `update public.users set email = $2, email_verified_at = now(), is_anonymous = false
          where id = $1 and not exists (select 1 from public.users where email = $2)
          returning id, is_anonymous`,
        [otp.link_user_id, addr],
      );
      user = res.rows[0];
    }
    if (!user) {
      const res = await svc.query<UserRow>(
        `insert into public.users (email, email_verified_at, is_anonymous) values ($1, now(), false)
         on conflict (email) do update set email_verified_at = coalesce(public.users.email_verified_at, now())
         returning id, is_anonymous`,
        [addr],
      );
      user = res.rows[0]!;
    }
    return c.json(await respond(user, ua(c.req.header('user-agent'))));
  });

  async function socialLogin(
    provider: 'apple' | 'google',
    identity: { sub: string; email: string | null; emailVerified: boolean },
    caller: string | null,
    callerAnon: boolean,
  ): Promise<UserRow> {
    const col = provider === 'apple' ? 'apple_sub' : 'google_sub';
    const existing = await svc.query<UserRow>(
      `select id, is_anonymous from public.users where ${col} = $1`,
      [identity.sub],
    );
    if (existing.rows[0]) return existing.rows[0];
    const verifiedEmail = identity.emailVerified ? (identity.email?.toLowerCase() ?? null) : null;
    if (verifiedEmail) {
      const byEmail = await svc.query<UserRow>(
        `update public.users set ${col} = $2 where email = $1 returning id, is_anonymous`,
        [verifiedEmail, identity.sub],
      );
      if (byEmail.rows[0]) return byEmail.rows[0];
    }
    if (caller && callerAnon) {
      const linked = await svc.query<UserRow>(
        `update public.users set ${col} = $2, email = coalesce(email, $3),
                email_verified_at = case when $3 is not null then now() else email_verified_at end,
                is_anonymous = false
          where id = $1 returning id, is_anonymous`,
        [caller, identity.sub, verifiedEmail],
      );
      if (linked.rows[0]) return linked.rows[0];
    }
    const created = await svc.query<UserRow>(
      `insert into public.users (${col}, email, email_verified_at, is_anonymous)
       values ($1, $2, case when $2::text is not null then now() end, false) returning id, is_anonymous`,
      [identity.sub, verifiedEmail],
    );
    return created.rows[0]!;
  }

  r.post('/apple', async (c) => {
    const body = z
      .object({ identityToken: z.string().min(10), nonce: z.string().min(8) })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ApiError(422, 'invalid_token');
    const identity = await d.social.apple(body.data.identityToken, body.data.nonce).catch(() => {
      throw new ApiError(401, 'invalid_token', 'Não foi possível validar o login da Apple.');
    });
    const user = await socialLogin('apple', identity, c.get('userId'), c.get('anon'));
    return c.json(await respond(user, ua(c.req.header('user-agent'))));
  });

  r.post('/google', async (c) => {
    const body = z
      .object({ idToken: z.string().min(10) })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ApiError(422, 'invalid_token');
    const identity = await d.social.google(body.data.idToken).catch(() => {
      throw new ApiError(401, 'invalid_token', 'Não foi possível validar o login do Google.');
    });
    const user = await socialLogin('google', identity, c.get('userId'), c.get('anon'));
    return c.json(await respond(user, ua(c.req.header('user-agent'))));
  });

  /** Login por senha — usado pelo painel admin. */
  r.post('/password', async (c) => {
    const body = z
      .object({ email, password: z.string().min(1).max(200) })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ApiError(422, 'invalid_credentials');
    const { rows } = await svc.query<UserRow & { password_hash: string | null }>(
      'select id, is_anonymous, password_hash from public.users where email = $1',
      [body.data.email],
    );
    const u = rows[0];
    const ok = await verifyPassword(body.data.password, u?.password_hash ?? null);
    if (!u || !ok) throw new ApiError(401, 'invalid_credentials', 'E-mail ou senha incorretos.');
    return c.json(await respond(u, ua(c.req.header('user-agent'))));
  });

  r.post('/refresh', async (c) => {
    const body = z
      .object({ refreshToken: z.string().min(20) })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ApiError(401, 'invalid_refresh');
    const pair = await d.tokens.rotate(body.data.refreshToken, ua(c.req.header('user-agent')));
    if (!pair) throw new ApiError(401, 'invalid_refresh', 'Sessão expirada. Entre novamente.');
    return c.json(pair);
  });

  r.post('/logout', async (c) => {
    const body = z
      .object({ refreshToken: z.string() })
      .safeParse(await c.req.json().catch(() => ({})));
    if (body.success) await d.tokens.revoke(body.data.refreshToken);
    return c.json({ ok: true });
  });

  return r;
}
