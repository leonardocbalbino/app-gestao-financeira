import { NextResponse, type NextRequest } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { toCsv } from '@/lib/csv';

/** Exporta a busca de usuários em CSV (até 5.000 linhas por exportação). */
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return new NextResponse('Não autorizado', { status: 401 });
  const q = req.nextUrl.searchParams.get('q') ?? '';
  const rows: unknown[][] = [];
  for (let offset = 0; offset < 5000; offset += 500) {
    let data: {
      id: string;
      email: string | null;
      is_anonymous: boolean;
      plan_id: string;
      source: string;
      expires_at: string | null;
      created_at: string;
      last_sign_in_at: string | null;
    }[];
    try {
      data = await apiFetch(
        'GET',
        `/admin/users?q=${encodeURIComponent(q)}&limit=500&offset=${offset}`,
      );
    } catch (e) {
      return new NextResponse((e as Error).message, { status: 500 });
    }
    for (const u of data ?? []) {
      rows.push([
        u.id,
        u.email,
        u.is_anonymous ? 'sim' : 'não',
        u.plan_id,
        u.source,
        u.expires_at,
        u.created_at,
        u.last_sign_in_at,
      ]);
    }
    if ((data ?? []).length < 500) break;
  }
  const csv = toCsv(
    ['id', 'email', 'anonimo', 'plano', 'origem', 'expira_em', 'criado_em', 'ultimo_acesso'],
    rows,
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="usuarios-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
