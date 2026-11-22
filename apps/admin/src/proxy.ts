import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_ACCESS, COOKIE_REFRESH, env } from '@/lib/env';

/** exp do JWT sem verificar assinatura (só para decidir se renova; a API valida de verdade). */
function expiresSoon(token: string | undefined): boolean {
  if (!token) return true;
  try {
    const payload = JSON.parse(
      atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')),
    ) as { exp?: number };
    return !payload.exp || payload.exp * 1000 < Date.now() + 60_000;
  } catch {
    return true;
  }
}

/**
 * Renova o access token (cookies httpOnly) antes de cada página e redireciona para o login sem
 * sessão. A autorização de verdade (papel de admin) é feita pela API em cada chamada.
 */
export async function proxy(request: NextRequest) {
  const isLogin = request.nextUrl.pathname.startsWith('/login');
  const access = request.cookies.get(COOKIE_ACCESS)?.value;
  const refresh = request.cookies.get(COOKIE_REFRESH)?.value;

  if (!expiresSoon(access)) return NextResponse.next();

  if (refresh) {
    const res = await fetch(`${env.apiUrl}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    }).catch(() => null);
    if (res?.ok) {
      const t = (await res.json()) as {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
      };
      request.cookies.set(COOKIE_ACCESS, t.accessToken);
      const response = NextResponse.next({ request });
      const opts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/',
      };
      response.cookies.set(COOKIE_ACCESS, t.accessToken, { ...opts, maxAge: t.expiresIn });
      response.cookies.set(COOKIE_REFRESH, t.refreshToken, { ...opts, maxAge: 60 * 60 * 24 * 30 });
      return response;
    }
  }

  if (isLogin) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  const redirect = NextResponse.redirect(url);
  redirect.cookies.delete(COOKIE_ACCESS);
  redirect.cookies.delete(COOKIE_REFRESH);
  return redirect;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)'],
};
