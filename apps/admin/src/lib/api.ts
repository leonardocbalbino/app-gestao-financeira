import 'server-only';
import { cookies } from 'next/headers';
import { COOKIE_ACCESS, COOKIE_REFRESH, env } from './env';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const cookieOpts = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge,
});

/** Grava a sessão em cookies httpOnly (só em Server Actions / Route Handlers). */
export async function setSessionCookies(t: Tokens) {
  const store = await cookies();
  store.set(COOKIE_ACCESS, t.accessToken, cookieOpts(t.expiresIn));
  store.set(COOKIE_REFRESH, t.refreshToken, cookieOpts(60 * 60 * 24 * 30));
}

export async function clearSessionCookies() {
  const store = await cookies();
  store.delete(COOKIE_ACCESS);
  store.delete(COOKIE_REFRESH);
}

/** Chamada à API como o admin logado (o proxy.ts renova o access token antes). */
export async function apiFetch<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = (await cookies()).get(COOKIE_ACCESS)?.value;
  const res = await fetch(`${env.apiUrl}/v1${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const e = (json ?? {}) as { error?: string; message?: string };
    throw new ApiError(res.status, e.error ?? 'error', e.message ?? `Erro ${res.status}`);
  }
  return json as T;
}

/** Sem cookie de sessão (login). */
export async function apiPublic<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${env.apiUrl}/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!res.ok)
    throw new ApiError(res.status, json.error ?? 'error', json.message ?? `Erro ${res.status}`);
  return json;
}
