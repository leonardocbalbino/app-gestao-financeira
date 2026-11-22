import { loadConfig } from '../src/config.ts';
import { buildDeps } from '../src/deps.ts';
import { createApp } from '../src/app.ts';
import { createDb } from '../src/db.ts';
import { ReminderDispatcher } from '../src/reminders/dispatcher.ts';
import type {
  ChannelProviders,
  EmailMessage,
  PushMessage,
  SendResult,
} from '../src/channels/types.ts';
import type { SocialVerifier } from '../src/auth/social.ts';
import { TEST_DB } from './global-setup.ts';

const HOST = '127.0.0.1:56432';

export interface Sent {
  email: EmailMessage[];
  push: PushMessage[];
  sms: { to: string; body: string }[];
  whatsapp: { to: string; body: string }[];
}

export function fakeProviders() {
  const sent: Sent = { email: [], push: [], sms: [], whatsapp: [] };
  const ok = (provider: string): SendResult => ({
    status: 'sent',
    provider,
    messageId: `msg_${Math.random()}`,
  });
  const providers: ChannelProviders = {
    email: async (m) => (sent.email.push(m), ok('fake-email')),
    push: async (m) => (sent.push.push(m), ok('fake-push')),
    sms: async (to, body) => (sent.sms.push({ to, body }), ok('fake-sms')),
    whatsapp: async (to, body) => (sent.whatsapp.push({ to, body }), ok('fake-whatsapp')),
    status: () => ({
      email: 'configured',
      push: 'configured',
      sms: 'configured',
      whatsapp: 'configured',
    }),
  };
  return { providers, sent };
}

export const fakeSocial: SocialVerifier = {
  apple: async (token) => ({
    sub: `apple-${token}`,
    email: `${token}@privaterelay.appleid.com`,
    emailVerified: true,
  }),
  google: async (token) => ({
    sub: `google-${token}`,
    email: `${token}@gmail.com`,
    emailVerified: true,
  }),
};

/** App completo apontando para o banco de teste, com provedores falsos e relógio controlável. */
export function setupApp(env: Record<string, string> = {}) {
  const cfg = loadConfig({
    DATABASE_URL: `postgres://app_api:dev_app_api@${HOST}/${TEST_DB}`,
    SERVICE_DATABASE_URL: `postgres://app_service:dev_app_service@${HOST}/${TEST_DB}`,
    JWT_SECRET: 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres',
    REVENUECAT_WEBHOOK_AUTH: 'rc-secret',
    FIXED_OTP_ACCOUNTS: 'review@teste.dev:654321',
    ...env,
  });
  const db = createDb(cfg.DATABASE_URL, cfg.SERVICE_DATABASE_URL);
  const { providers, sent } = fakeProviders();
  const clock = { now: new Date() };
  const dispatcher = new ReminderDispatcher(db, providers, 'App Teste', () => clock.now);
  const deps = buildDeps(cfg, { db, providers, social: fakeSocial, dispatcher });
  const app = createApp(deps);

  async function call<T = unknown>(
    method: string,
    path: string,
    opts: { token?: string; body?: unknown } = {},
  ): Promise<{ status: number; body: T }> {
    const res = await app.request(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
  }

  async function anon() {
    const r = await call<{ accessToken: string; refreshToken: string; user: { id: string } }>(
      'POST',
      '/v1/auth/anonymous',
    );
    return r.body;
  }

  /** Cria sessão com e-mail (código capturado no provedor falso). */
  async function loginEmail(email: string, token?: string) {
    await call('POST', '/v1/auth/email/start', { body: { email }, token });
    const last = [...sent.email].reverse().find((m) => m.to === email)!;
    const code = last.subject.slice(0, 6);
    const r = await call<{
      accessToken: string;
      refreshToken: string;
      user: { id: string; isAnonymous: boolean };
    }>('POST', '/v1/auth/email/verify', { body: { email, code } });
    return r.body;
  }

  return { app, deps, db, sent, clock, call, anon, loginEmail, close: () => db.close() };
}
