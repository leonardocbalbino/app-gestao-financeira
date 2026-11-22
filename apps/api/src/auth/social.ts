import { createHash } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface SocialIdentity {
  sub: string;
  email: string | null;
  emailVerified: boolean;
}

/** Verificador de tokens de login social (injetável para testes). */
export interface SocialVerifier {
  apple(identityToken: string, rawNonce: string): Promise<SocialIdentity>;
  google(idToken: string): Promise<SocialIdentity>;
}

const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export function createSocialVerifier(
  appleAudiences: string[],
  googleAudiences: string[],
): SocialVerifier {
  return {
    async apple(identityToken, rawNonce) {
      if (!appleAudiences.length) throw new Error('apple_not_configured');
      const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
        issuer: 'https://appleid.apple.com',
        audience: appleAudiences,
      });
      // O app envia o SHA-256 do nonce para a Apple e o nonce cru para nós.
      const expected = createHash('sha256').update(rawNonce).digest('hex');
      if (payload.nonce !== expected) throw new Error('invalid_nonce');
      return {
        sub: String(payload.sub),
        email: typeof payload.email === 'string' ? payload.email : null,
        emailVerified: payload.email_verified === true || payload.email_verified === 'true',
      };
    },
    async google(idToken) {
      if (!googleAudiences.length) throw new Error('google_not_configured');
      const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: googleAudiences,
      });
      return {
        sub: String(payload.sub),
        email: typeof payload.email === 'string' ? payload.email : null,
        emailVerified: payload.email_verified === true,
      };
    },
  };
}
