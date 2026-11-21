import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const metadata = { title: 'Auditoria' };

const ENTITIES = [
  'plans',
  'features',
  'plan_features',
  'plan_matrix',
  'user_plan_overrides',
  'manual_grants',
  'app_config',
  'ad_config',
  'admins',
];
const PAGE = 50;

/** Campos que mudaram entre before/after (para leitura rápida). */
function changedKeys(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
) {
  if (!before || !after) return [];
  return Object.keys(after).filter(
    (k) =>
      !['updated_at', 'server_updated_at'].includes(k) &&
      JSON.stringify(before[k]) !== JSON.stringify(after[k]),
  );
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; page?: string }>;
}) {
  await requireAdmin('viewer');
  const { entity = '', page = '0' } = await searchParams;
  const p = Math.max(0, Number(page) || 0);
  const supabase = await createClient();
  let q = supabase
    .from('admin_audit_log')
    .select('id, actor_id, action, entity, entity_id, before, after, created_at')
    .order('created_at', { ascending: false })
    .range(p * PAGE, p * PAGE + PAGE - 1);
  if (ENTITIES.includes(entity)) q = q.eq('entity', entity);
  const [{ data: rows }, { data: admins }] = await Promise.all([
    q,
    supabase.rpc('admin_list_admins'),
  ]);
  const who = new Map<string, string>(
    (admins ?? []).map((a: { user_id: string; email: string }) => [a.user_id, a.email]),
  );

  return (
    <>
      <PageHeader
        title="Auditoria"
        description="Toda alteração administrativa é registrada automaticamente."
      />
      <form className="mb-4 flex gap-2">
        <label htmlFor="entity" className="sr-only">
          Filtrar por entidade
        </label>
        <select
          id="entity"
          name="entity"
          defaultValue={entity}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="">Todas as entidades</option>
          {ENTITIES.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>
      <div className="rounded-[20px] border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Quem</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Entidade</TableHead>
              <TableHead>Mudanças</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rows ?? []).map((r) => {
              const keys = changedKeys(r.before, r.after);
              return (
                <TableRow key={r.id}>
                  <TableCell className="tabular whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'medium',
                    })}
                  </TableCell>
                  <TableCell>
                    {r.actor_id ? (who.get(r.actor_id) ?? r.actor_id.slice(0, 8)) : 'sistema'}
                  </TableCell>
                  <TableCell className="font-semibold">{r.action}</TableCell>
                  <TableCell>
                    {r.entity}
                    {r.entity_id ? (
                      <span className="block font-mono text-xs text-muted-foreground">
                        {r.entity_id}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-md">
                    <details>
                      <summary className="cursor-pointer text-sm">
                        {keys.length
                          ? keys.join(', ')
                          : r.action === 'insert'
                            ? 'criado'
                            : r.action === 'delete'
                              ? 'removido'
                              : 'detalhes'}
                      </summary>
                      <pre className="mt-2 max-h-64 overflow-auto rounded-[12px] bg-muted p-2 text-xs">
                        {JSON.stringify({ antes: r.before, depois: r.after }, null, 2)}
                      </pre>
                    </details>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <nav aria-label="Paginação" className="mt-4 flex gap-2">
        {p > 0 ? (
          <Link href={`/audit?entity=${entity}&page=${p - 1}`}>
            <Button variant="outline">Anterior</Button>
          </Link>
        ) : null}
        {(rows ?? []).length === PAGE ? (
          <Link href={`/audit?entity=${entity}&page=${p + 1}`}>
            <Button variant="outline">Próxima</Button>
          </Link>
        ) : null}
      </nav>
    </>
  );
}
