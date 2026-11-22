'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  apiFetch,
  apiPublic,
  clearSessionCookies,
  setSessionCookies,
  type Tokens,
} from '@/lib/api';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha muito curta'),
});

export interface LoginState {
  error?: string;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  let tokens: Tokens;
  try {
    tokens = await apiPublic<Tokens>('POST', '/auth/password', parsed.data);
  } catch {
    return { error: 'E-mail ou senha incorretos.' };
  }
  await setSessionCookies(tokens);
  try {
    await apiFetch('GET', '/admin/session');
  } catch {
    await clearSessionCookies();
    return { error: 'Esta conta não tem acesso ao painel.' };
  }
  redirect('/');
}

export async function logout() {
  const { cookies } = await import('next/headers');
  const refreshToken = (await cookies()).get('adm_rt')?.value;
  if (refreshToken)
    await apiPublic('POST', '/auth/logout', { refreshToken }).catch(() => undefined);
  await clearSessionCookies();
  redirect('/login');
}
