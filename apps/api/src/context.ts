import type { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Config } from './config.ts';
import type { Db } from './db.ts';
import type { ChannelProviders } from './channels/types.ts';
import type { SocialVerifier } from './auth/social.ts';
import type { TokenService } from './auth/tokens.ts';
import type { ReminderDispatcher } from './reminders/dispatcher.ts';

export interface Deps {
  cfg: Config;
  db: Db;
  tokens: TokenService;
  providers: ChannelProviders;
  social: SocialVerifier;
  dispatcher: ReminderDispatcher;
}

export interface AppEnv {
  Variables: {
    userId: string | null;
    anon: boolean;
  };
}

export type App = Hono<AppEnv>;

export class ApiError extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500,
    code: string,
    message?: string,
  ) {
    super(status, { message: message ?? code, cause: code });
  }
}

export function requireUser(userId: string | null): string {
  if (!userId) throw new ApiError(401, 'unauthorized', 'Sessão expirada. Entre novamente.');
  return userId;
}

/** Erros do Postgres → HTTP. Mensagens de regra de negócio viram códigos estáveis. */
export function mapDbError(e: unknown): ApiError | null {
  const err = e as { code?: string; message?: string };
  if (!err?.code) return null;
  const msg = err.message ?? '';
  if (err.code === '42501')
    return new ApiError(403, msg.includes('sync_not_allowed') ? 'sync_not_allowed' : 'forbidden');
  if (err.code === 'P0001') {
    const m = msg.match(/(limit_reached|feature_required):([a-z.]+)/);
    if (m) return new ApiError(409, `${m[1]}:${m[2]}`);
    return new ApiError(409, msg);
  }
  if (err.code === 'P0002') return new ApiError(404, msg);
  if (err.code === '23505') return new ApiError(409, 'conflict');
  if (err.code === '23514' || err.code === '22023' || err.code === '22P02')
    return new ApiError(422, 'invalid_value');
  return null;
}
