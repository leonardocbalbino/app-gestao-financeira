import * as SecureStore from 'expo-secure-store';
import { env } from './env';

/**
 * Cliente da API própria (Postgres + Hono). Access token curto em memória; refresh token
 * no SecureStore (Keychain/Keystore). Renova automaticamente em 401.
 */

export interface SessionUser {
  id: string;
  isAnonymous: boolean;
}

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const REFRESH_KEY = 'auth.refreshToken';
const USER_KEY = 'auth.user';

let accessToken: string | null = null;
let currentUser: SessionUser | null = null;
let refreshing: Promise<boolean> | null = null;
let restoring: Promise<SessionUser | null> | null = null;
const listeners = new Set<(u: SessionUser | null) => void>();

export const isApiConfigured = (): boolean => !!env.apiUrl;

export function onSessionChange(cb: (u: SessionUser | null) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() {
  listeners.forEach((l) => l(currentUser));
}

export function getSessionUser(): SessionUser | null {
  return currentUser;
}

/** Restaura a sessão salva (uma vez por processo; chamadas seguintes reaproveitam). */
export function restoreSession(): Promise<SessionUser | null> {
  restoring ??= (async () => {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    currentUser ??= raw ? (JSON.parse(raw) as SessionUser) : null;
    emit();
    return currentUser;
  })();
  return restoring;
}

export async function saveSession(t: Tokens & { user: SessionUser }): Promise<void> {
  accessToken = t.accessToken;
  currentUser = t.user;
  await SecureStore.setItemAsync(REFRESH_KEY, t.refreshToken);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(t.user));
  emit();
}

export async function clearSession(): Promise<void> {
  accessToken = null;
  currentUser = null;
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
  emit();
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

async function refresh(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const token = await getRefreshToken();
      if (!token) return false;
      const res = await fetch(`${env.apiUrl}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: token }),
      });
      if (!res.ok) {
        if (res.status === 401) await clearSession();
        return false;
      }
      const t = (await res.json()) as Tokens;
      accessToken = t.accessToken;
      await SecureStore.setItemAsync(REFRESH_KEY, t.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export interface RequestOptions {
  body?: unknown;
  /** Envia o token se houver sessão (padrão: true). */
  auth?: boolean;
  signal?: AbortSignal;
}

export async function api<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  if (!isApiConfigured()) throw new ApiRequestError(0, 'offline', 'Servidor não configurado.');
  const send = async () => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(`${env.apiUrl}/v1${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  };

  // Primeira chamada do processo: ainda não há access token em memória.
  if (opts.auth !== false && !accessToken && currentUser) await refresh();
  let res = await send();
  if (res.status === 401 && opts.auth !== false && currentUser && (await refresh()))
    res = await send();

  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const e = (json ?? {}) as { error?: string; message?: string };
    throw new ApiRequestError(
      res.status,
      e.error ?? 'error',
      e.message ?? 'Erro de comunicação com o servidor.',
    );
  }
  return json as T;
}

/** Para testes. */
export function __resetApiForTests() {
  accessToken = null;
  currentUser = null;
  refreshing = null;
  restoring = null;
  listeners.clear();
}
