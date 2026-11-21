import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const metadata = { title: 'Usuários' };

const PAGE = 50;

interface UserRow {
  id: string;
  email: string | null;
  is_anonymous: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  plan_id: string;
  source: string;
  expires_at: string | null;
}

const SOURCE_LABEL: Record<string, string> = {
  subscription: 'Assinatura',
  manual_grant: 'Concessão',
  default: 'Padrão',
};

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdmin('viewer');
  const { q = '', page = '0' } = await searchParams;
  const p = Math.max(0, Number(page) || 0);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_search_users', {
    p_query: q,
    p_limit: PAGE,
    p_offset: p * PAGE,
  });
  const rows = (data ?? []) as UserRow[];

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Busque por e-mail ou id. Abra um usuário para conceder Pro ou ajustar funcionalidades."
        actions={
          <a href={`/users/export?q=${encodeURIComponent(q)}`} className="inline-flex">
            <Button variant="outline">Exportar CSV</Button>
          </a>
        }
      />
      <form className="mb-4 flex max-w-lg gap-2" role="search">
        <Input
          name="q"
          defaultValue={q}
          placeholder="e-mail ou id do usuário"
          aria-label="Buscar usuários"
        />
        <Button type="submit">Buscar</Button>
      </form>
      {error ? <p className="text-destructive">{error.message}</p> : null}
      <div className="rounded-[20px] border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Expira</TableHead>
              <TableHead>Criado</TableHead>
              <TableHead>Último acesso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Link
                      href={`/users/${u.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {u.email ?? (u.is_anonymous ? 'Anônimo' : 'Sem e-mail')}
                    </Link>
                    <span className="block font-mono text-xs text-muted-foreground">
                      {u.id.slice(0, 8)}…
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={u.plan_id === 'free' ? '' : 'bg-pro text-pro-ink'}
                      variant={u.plan_id === 'free' ? 'secondary' : 'default'}
                    >
                      {u.plan_id}
                    </Badge>
                  </TableCell>
                  <TableCell>{SOURCE_LABEL[u.source] ?? u.source}</TableCell>
                  <TableCell className="tabular">{fmt(u.expires_at)}</TableCell>
                  <TableCell className="tabular">{fmt(u.created_at)}</TableCell>
                  <TableCell className="tabular">{fmt(u.last_sign_in_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <nav aria-label="Paginação" className="mt-4 flex gap-2">
        {p > 0 ? (
          <Link href={`/users?q=${encodeURIComponent(q)}&page=${p - 1}`}>
            <Button variant="outline">Anterior</Button>
          </Link>
        ) : null}
        {rows.length === PAGE ? (
          <Link href={`/users?q=${encodeURIComponent(q)}&page=${p + 1}`}>
            <Button variant="outline">Próxima</Button>
          </Link>
        ) : null}
      </nav>
    </>
  );
}
