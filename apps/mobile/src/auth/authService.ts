import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import {
  api,
  clearSession,
  getRefreshToken,
  getSessionUser,
  isApiConfigured,
  restoreSession,
  saveSession,
  type SessionUser,
} from '@/lib/api';

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

let ensuring: Promise<void> | null = null;

/** Primeiro uso: sessão anônima (compras e entitlements vinculados sem cadastro). Deduplicada. */
export function ensureAnonymousSession(): Promise<void> {
  ensuring ??= (async () => {
    if (!isApiConfigured()) return;
    await restoreSession();
    if (getSessionUser()) return;
    await saveSession(await api<AuthResponse>('POST', '/auth/anonymous', { auth: false }));
  })().finally(() => {
    ensuring = null;
  });
  return ensuring;
}

export type EmailFlow = 'link' | 'sign_in';

/**
 * Envia o código por e-mail. Se a sessão atual é anônima e o e-mail é novo, a API vincula o
 * e-mail ao MESMO usuário (mantém dados e assinatura). Se o e-mail já tem conta, entra nela.
 */
export async function sendEmailCode(email: string): Promise<EmailFlow> {
  const r = await api<{ flow: EmailFlow }>('POST', '/auth/email/start', { body: { email } });
  return r.flow;
}

export async function verifyEmailCode(email: string, code: string): Promise<void> {
  await saveSession(
    await api<AuthResponse>('POST', '/auth/email/verify', { body: { email, code } }),
  );
}

/** Sign in with Apple nativo: a Apple recebe o SHA-256 do nonce; a API recebe o nonce cru. */
export async function signInWithApple(): Promise<'ok' | 'cancelled'> {
  const rawNonce = Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  try {
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashed,
    });
    if (!cred.identityToken) throw new Error('A Apple não retornou o token.');
    await saveSession(
      await api<AuthResponse>('POST', '/auth/apple', {
        body: { identityToken: cred.identityToken, nonce: rawNonce },
      }),
    );
    return 'ok';
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return 'cancelled';
    throw e;
  }
}

/** Google: o id_token vem do expo-auth-session (tela de login) e é validado pela API. */
export async function signInWithGoogleIdToken(idToken: string): Promise<void> {
  await saveSession(await api<AuthResponse>('POST', '/auth/google', { body: { idToken } }));
}

export async function signOut(): Promise<void> {
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    await api('POST', '/auth/logout', { body: { refreshToken }, auth: false }).catch(
      () => undefined,
    );
  }
  await clearSession();
}

/** Apaga a conta e todos os dados no servidor. */
export async function deleteAccountOnServer(): Promise<void> {
  await api('DELETE', '/me', { body: { confirm: 'EXCLUIR' } });
}
