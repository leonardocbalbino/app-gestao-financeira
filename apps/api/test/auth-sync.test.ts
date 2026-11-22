import { afterAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../src/auth/crypto.ts';
import { setupApp } from './helpers.ts';

const t = setupApp();
afterAll(() => t.close());

describe('autenticação', () => {
  it('sessão anônima e plano Free', async () => {
    const s = await t.anon();
    const me = await t.call<{ is_anonymous: boolean }>('GET', '/v1/me', { token: s.accessToken });
    expect(me.body.is_anonymous).toBe(true);
    const ent = await t.call<{ plan_id: string; features: Record<string, unknown> }>(
      'GET',
      '/v1/me/entitlements',
      {
        token: s.accessToken,
      },
    );
    expect(ent.body.plan_id).toBe('free');
    expect(ent.body.features['reminders.max']).toBe(3);
  });

  it('sem token → 401', async () => {
    expect((await t.call('GET', '/v1/me')).status).toBe(401);
  });

  it('anônimo vincula e-mail mantendo o MESMO usuário', async () => {
    const s = await t.anon();
    const r = await t.loginEmail('vinculo@teste.dev', s.accessToken);
    expect(r.user.id).toBe(s.user.id);
    expect(r.user.isAnonymous).toBe(false);
  });

  it('e-mail já cadastrado: outro aparelho entra na mesma conta', async () => {
    const first = await t.loginEmail('existente@teste.dev');
    const other = await t.anon();
    const second = await t.loginEmail('existente@teste.dev', other.accessToken);
    expect(second.user.id).toBe(first.user.id);
  });

  it('código errado conta tentativa; código fixo de revisão funciona sem e-mail', async () => {
    await t.call('POST', '/v1/auth/email/start', { body: { email: 'errado@teste.dev' } });
    const bad = await t.call('POST', '/v1/auth/email/verify', {
      body: { email: 'errado@teste.dev', code: '000000' },
    });
    expect(bad.status).toBe(401);
    const before = t.sent.email.length;
    await t.call('POST', '/v1/auth/email/start', { body: { email: 'review@teste.dev' } });
    expect(t.sent.email.length).toBe(before);
    const ok = await t.call('POST', '/v1/auth/email/verify', {
      body: { email: 'review@teste.dev', code: '654321' },
    });
    expect(ok.status).toBe(200);
  });

  it('refresh rotativo; reuso revoga a família inteira', async () => {
    const s = await t.anon();
    const r1 = await t.call<{ refreshToken: string }>('POST', '/v1/auth/refresh', {
      body: { refreshToken: s.refreshToken },
    });
    expect(r1.status).toBe(200);
    const reuse = await t.call('POST', '/v1/auth/refresh', {
      body: { refreshToken: s.refreshToken },
    });
    expect(reuse.status).toBe(401);
    const afterTheft = await t.call('POST', '/v1/auth/refresh', {
      body: { refreshToken: r1.body.refreshToken },
    });
    expect(afterTheft.status).toBe(401);
  });

  it('Apple vincula ao anônimo; segundo login reusa a conta', async () => {
    const s = await t.anon();
    const a = await t.call<{ user: { id: string } }>('POST', '/v1/auth/apple', {
      token: s.accessToken,
      body: { identityToken: 'tok-apple-1', nonce: 'nonce-1234' },
    });
    expect(a.body.user.id).toBe(s.user.id);
    const again = await t.call<{ user: { id: string } }>('POST', '/v1/auth/apple', {
      body: { identityToken: 'tok-apple-1', nonce: 'nonce-1234' },
    });
    expect(again.body.user.id).toBe(s.user.id);
  });

  it('login por senha (admin)', async () => {
    await t.db.service.query(
      "insert into public.users (email, password_hash) values ('senha@teste.dev', $1)",
      [await hashPassword('Senha-Forte-123')],
    );
    expect(
      (
        await t.call('POST', '/v1/auth/password', {
          body: { email: 'senha@teste.dev', password: 'x' },
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await t.call('POST', '/v1/auth/password', {
          body: { email: 'senha@teste.dev', password: 'Senha-Forte-123' },
        })
      ).status,
    ).toBe(200);
  });

  it('perfil: SMS/WhatsApp exigem celular', async () => {
    const s = await t.loginEmail('perfil@teste.dev');
    const bad = await t.call('PATCH', '/v1/me', { token: s.accessToken, body: { smsOptIn: true } });
    expect(bad.status).toBe(422);
    const ok = await t.call<{ phone: string; sms_opt_in: boolean }>('PATCH', '/v1/me', {
      token: s.accessToken,
      body: { phone: '+5511999998888', smsOptIn: true, whatsappOptIn: true },
    });
    expect(ok.body).toMatchObject({ phone: '+5511999998888', sms_opt_in: true });
  });

  it('exclusão de conta exige confirmação e apaga tudo', async () => {
    const s = await t.loginEmail('apagar@teste.dev');
    expect((await t.call('DELETE', '/v1/me', { token: s.accessToken, body: {} })).status).toBe(422);
    expect(
      (await t.call('DELETE', '/v1/me', { token: s.accessToken, body: { confirm: 'EXCLUIR' } }))
        .status,
    ).toBe(200);
    const left = await t.db.service.query('select 1 from public.users where id = $1', [s.user.id]);
    expect(left.rowCount).toBe(0);
  });
});

describe('config pública', () => {
  it('matriz e config remota sem login', async () => {
    const r = await t.call<{ config: { app: unknown }; matrix: { plans: unknown[] } }>(
      'GET',
      '/v1/config',
    );
    expect(r.status).toBe(200);
    expect(r.body.matrix.plans).toHaveLength(2);
  });
});

describe('sync', () => {
  const account = (id: string, name: string, updated: string) => ({
    id,
    name,
    type: 'cash',
    initial_balance_cents: 0,
    color: '#000',
    icon: 'wallet',
    archived: false,
    sort_order: 0,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: updated,
    deleted_at: null,
  });

  it('Free não sincroniza; Pro faz push/pull com cursor', async () => {
    const s = await t.loginEmail('sync@teste.dev');
    const denied = await t.call<{ error: string }>('POST', '/v1/sync/accounts/push', {
      token: s.accessToken,
      body: { rows: [] },
    });
    expect(denied.status).toBe(403);
    expect(denied.body.error).toBe('sync_not_allowed');

    await t.db.service.query(
      "insert into public.user_plan_overrides (user_id, feature_key, value) values ($1, 'sync.cloud', 'true')",
      [s.user.id],
    );
    const id = '0f0f0f0f-0000-4000-8000-000000000001';
    const push = await t.call<{ applied: number }>('POST', '/v1/sync/accounts/push', {
      token: s.accessToken,
      body: { rows: [account(id, 'Banco', '2026-11-01T00:00:00Z')] },
    });
    expect(push.body.applied).toBe(1);
    const pull = await t.call<{ id: string; server_updated_at: string; household_id: unknown }[]>(
      'GET',
      '/v1/sync/accounts',
      {
        token: s.accessToken,
      },
    );
    expect(pull.body.map((x) => x.id)).toEqual([id]);
    const cursor = pull.body[0]!.server_updated_at;
    expect(cursor).toMatch(/\.\d{6}Z$/);
    const empty = await t.call<unknown[]>(
      'GET',
      `/v1/sync/accounts?since=${encodeURIComponent(cursor)}`,
      { token: s.accessToken },
    );
    expect(empty.body).toHaveLength(0);
  });
});

describe('família', () => {
  it('cria, entra pelo código e vê os membros', async () => {
    const owner = await t.loginEmail('dono@familia.dev');
    await t.db.service.query(
      "insert into public.user_plan_overrides (user_id, feature_key, value) values ($1, 'members.max', '3')",
      [owner.user.id],
    );
    const h = await t.call<{ invite_code: string }>('POST', '/v1/households', {
      token: owner.accessToken,
      body: { name: 'Casa' },
    });
    expect(h.status).toBe(201);
    const member = await t.loginEmail('membro@familia.dev');
    const bad = await t.call('POST', '/v1/households/join', {
      token: member.accessToken,
      body: { code: 'XXXXXXXX' },
    });
    expect(bad.status).toBe(404);
    const joined = await t.call<{ members: unknown[] }>('POST', '/v1/households/join', {
      token: member.accessToken,
      body: { code: h.body.invite_code },
    });
    expect(joined.body.members).toHaveLength(2);
    expect(
      (await t.call('DELETE', '/v1/households/me', { token: member.accessToken })).status,
    ).toBe(200);
    const mine = await t.call<{ members: unknown[] }>('GET', '/v1/households/me', {
      token: owner.accessToken,
    });
    expect(mine.body.members).toHaveLength(1);
  });

  it('Free: limite de membros (1) impede entrada', async () => {
    const owner = await t.loginEmail('dono2@familia.dev');
    const h = await t.call<{ invite_code: string }>('POST', '/v1/households', {
      token: owner.accessToken,
      body: {},
    });
    const m = await t.loginEmail('membro2@familia.dev');
    const r = await t.call<{ error: string }>('POST', '/v1/households/join', {
      token: m.accessToken,
      body: { code: h.body.invite_code },
    });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('limit_reached:members.max');
  });
});

describe('webhook RevenueCat', () => {
  it('valida segredo e ativa o Pro', async () => {
    const s = await t.loginEmail('assinante@teste.dev');
    const event = {
      id: 'evt-1',
      type: 'INITIAL_PURCHASE',
      app_user_id: s.user.id,
      entitlement_ids: ['pro'],
      expiration_at_ms: Date.now() + 30 * 864e5,
      event_timestamp_ms: Date.now(),
    };
    const req = (auth: string) =>
      t.app.request('/v1/webhooks/revenuecat', {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ event }),
      });
    expect((await req('Bearer errado')).status).toBe(401);
    expect((await req('Bearer rc-secret')).status).toBe(200);
    const dup = await (await req('Bearer rc-secret')).json();
    expect(dup.skipped).toBe('stale_or_duplicate');
    const ent = await t.call<{ plan_id: string }>('GET', '/v1/me/entitlements', {
      token: s.accessToken,
    });
    expect(ent.body.plan_id).toBe('pro');
  });
});

describe('admin', () => {
  it('não-admin recebe 403; admin publica matriz e concede plano (auditado)', async () => {
    const user = await t.loginEmail('cliente@admin.dev');
    expect((await t.call('GET', '/v1/admin/stats', { token: user.accessToken })).status).toBe(403);

    const admin = await t.loginEmail('editor@admin.dev');
    await t.db.service.query("insert into public.admins (user_id, role) values ($1, 'editor')", [
      admin.user.id,
    ]);
    const stats = await t.call<{ users_total: number }>('GET', '/v1/admin/stats', {
      token: admin.accessToken,
    });
    expect(stats.body.users_total).toBeGreaterThan(1);

    await t.call('PUT', '/v1/admin/matrix/draft', {
      token: admin.accessToken,
      body: { planId: 'free', featureKey: 'goals.max', value: 2 },
    });
    const m = await t.call<{ diff: unknown[] }>('GET', '/v1/admin/matrix', {
      token: admin.accessToken,
    });
    expect(m.body.diff).toHaveLength(1);
    const pub = await t.call<{ changed: number }>('POST', '/v1/admin/matrix/publish', {
      token: admin.accessToken,
    });
    expect(pub.body.changed).toBe(1);
    const ent = await t.call<{ features: Record<string, unknown> }>('GET', '/v1/me/entitlements', {
      token: user.accessToken,
    });
    expect(ent.body.features['goals.max']).toBe(2);

    const g = await t.call('POST', `/v1/admin/users/${user.user.id}/grants`, {
      token: admin.accessToken,
      body: { planId: 'pro', days: 7, reason: 'teste' },
    });
    expect(g.status).toBe(201);
    const audit = await t.call<{ entity: string; actor_email: string }[]>(
      'GET',
      '/v1/admin/audit?entity=manual_grants',
      {
        token: admin.accessToken,
      },
    );
    expect(audit.body[0]).toMatchObject({
      entity: 'manual_grants',
      actor_email: 'editor@admin.dev',
    });
    // editor não gerencia admins
    expect(
      (
        await t.call('PUT', '/v1/admin/admins', {
          token: admin.accessToken,
          body: { email: 'x@y.z', role: 'viewer' },
        })
      ).status,
    ).toBe(403);
  });
});
