import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import type pg from 'pg';

export const ACCESS_TTL_SEC = 15 * 60;
export const REFRESH_TTL_DAYS = 60;

export interface AccessClaims {
  sub: string;
  anon: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export class TokenService {
  private key: Uint8Array;
  constructor(
    secret: string,
    private service: pg.Pool,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  async signAccess(claims: AccessClaims): Promise<string> {
    return new SignJWT({ anon: claims.anon })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.sub)
      .setIssuedAt()
      .setIssuer('gestao-api')
      .setAudience('gestao-app')
      .setExpirationTime(`${ACCESS_TTL_SEC}s`)
      .sign(this.key);
  }

  async verifyAccess(token: string): Promise<AccessClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: 'gestao-api',
        audience: 'gestao-app',
      });
      if (!payload.sub) return null;
      return { sub: payload.sub, anon: payload.anon === true };
    } catch {
      return null;
    }
  }

  /** Emite access + refresh (refresh opaco; só o hash vai para o banco). */
  async issue(
    userId: string,
    anon: boolean,
    family: string = randomUUID(),
    userAgent?: string,
  ): Promise<TokenPair> {
    const refresh = randomBytes(32).toString('base64url');
    await this.service.query(
      `insert into public.refresh_tokens (user_id, token_hash, family, expires_at, user_agent)
       values ($1, $2, $3, now() + ($4 || ' days')::interval, $5)`,
      [userId, sha256(refresh), family, String(REFRESH_TTL_DAYS), userAgent?.slice(0, 200) ?? null],
    );
    await this.service.query('update public.users set last_sign_in_at = now() where id = $1', [
      userId,
    ]);
    return {
      accessToken: await this.signAccess({ sub: userId, anon }),
      refreshToken: refresh,
      expiresIn: ACCESS_TTL_SEC,
    };
  }

  /**
   * Rotação: o refresh usado é revogado e um novo é emitido na mesma família.
   * Reuso de um refresh já revogado revoga a família inteira (token vazado).
   */
  async rotate(refreshToken: string, userAgent?: string): Promise<TokenPair | null> {
    const { rows } = await this.service.query<{
      id: string;
      user_id: string;
      family: string;
      revoked_at: Date | null;
      expired: boolean;
      is_anonymous: boolean;
    }>(
      `select t.id, t.user_id, t.family, t.revoked_at, t.expires_at < now() as expired, u.is_anonymous
         from public.refresh_tokens t join public.users u on u.id = t.user_id
        where t.token_hash = $1`,
      [sha256(refreshToken)],
    );
    const row = rows[0];
    if (!row) return null;
    if (row.revoked_at) {
      await this.revokeFamily(row.family);
      return null;
    }
    if (row.expired) return null;
    const upd = await this.service.query(
      'update public.refresh_tokens set revoked_at = now() where id = $1 and revoked_at is null',
      [row.id],
    );
    if (upd.rowCount !== 1) {
      await this.revokeFamily(row.family);
      return null;
    }
    return this.issue(row.user_id, row.is_anonymous, row.family, userAgent);
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.service.query(
      'update public.refresh_tokens set revoked_at = now() where token_hash = $1 and revoked_at is null',
      [sha256(refreshToken)],
    );
  }

  async revokeFamily(family: string): Promise<void> {
    await this.service.query(
      'update public.refresh_tokens set revoked_at = now() where family = $1 and revoked_at is null',
      [family],
    );
  }

  async revokeAll(userId: string): Promise<void> {
    await this.service.query(
      'update public.refresh_tokens set revoked_at = now() where user_id = $1 and revoked_at is null',
      [userId],
    );
  }
}
