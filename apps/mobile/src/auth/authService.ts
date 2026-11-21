import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export class AuthUnavailableError extends Error {
  constructor() {
    super('Login indisponível: configure o Supabase (EXPO_PUBLIC_SUPABASE_URL/ANON_KEY).');
  }
}

function client() {
  if (!supabase) throw new AuthUnavailableError();
  return supabase;
}

async function isAnonymousSession(): Promise<boolean> {
  const { data } = await client().auth.getSession();
  return !!data.session?.user.is_anonymous;
}

/** Primeiro uso: sessão anônima (permite RevenueCat/entitlements sem cadastro). */
export async function ensureAnonymousSession(): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (data.session) return;
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}

export type EmailFlow = 'link_anonymous' | 'sign_in';

/**
 * Envia código por e-mail. Se a sessão atual é anônima, tenta vincular o e-mail ao mesmo
 * usuário (mantém dados e assinatura). Se o e-mail já tem conta, faz login normal.
 */
export async function sendEmailCode(email: string): Promise<EmailFlow> {
  const sb = client();
  if (await isAnonymousSession()) {
    const { error } = await sb.auth.updateUser({ email });
    if (!error) return 'link_anonymous';
    if (!/already|exists|registered/i.test(error.message)) throw error;
  }
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
  return 'sign_in';
}

export async function verifyEmailCode(email: string, token: string, flow: EmailFlow) {
  const { error } = await client().auth.verifyOtp({
    email,
    token,
    type: flow === 'link_anonymous' ? 'email_change' : 'email',
  });
  if (error) throw error;
}

/** Sign in with Apple nativo (iOS) com nonce SHA-256. */
export async function signInWithApple(): Promise<'ok' | 'cancelled'> {
  const sb = client();
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
    if (!cred.identityToken) throw new Error('Apple não retornou o token.');
    const creds = { provider: 'apple' as const, token: cred.identityToken, nonce: rawNonce };
    if (await isAnonymousSession()) {
      const linked = await sb.auth.linkIdentity(creds);
      if (!linked.error) return 'ok';
    }
    const { error } = await sb.auth.signInWithIdToken(creds);
    if (error) throw error;
    return 'ok';
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return 'cancelled';
    throw e;
  }
}

/** Google via OAuth (PKCE) no navegador do sistema. */
export async function signInWithGoogle(): Promise<'ok' | 'cancelled'> {
  const sb = client();
  const redirectTo = Linking.createURL('auth-callback');
  const options = { redirectTo, skipBrowserRedirect: true };
  const anon = await isAnonymousSession();
  let res = anon
    ? await sb.auth.linkIdentity({ provider: 'google', options })
    : await sb.auth.signInWithOAuth({ provider: 'google', options });
  if (res.error && anon) res = await sb.auth.signInWithOAuth({ provider: 'google', options });
  if (res.error || !res.data.url) throw res.error ?? new Error('URL de login ausente.');

  const result = await WebBrowser.openAuthSessionAsync(res.data.url, redirectTo);
  if (result.type !== 'success') return 'cancelled';
  const url = new URL(result.url);
  const code = url.searchParams.get('code');
  const errDesc = url.searchParams.get('error_description');
  if (errDesc) throw new Error(errDesc);
  if (!code) throw new Error('Código de autorização ausente.');
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) throw error;
  return 'ok';
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

/** Chama a Edge Function delete-account (apaga usuário e dados no servidor). */
export async function deleteAccountOnServer(): Promise<void> {
  const { error } = await client().functions.invoke('delete-account', {
    body: { confirm: 'EXCLUIR' },
  });
  if (error) throw error;
}
