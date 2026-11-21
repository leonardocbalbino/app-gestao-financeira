import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SignupsChart } from '@/components/signups-chart';

export const metadata = { title: 'Dashboard' };

interface Stats {
  users_total: number;
  users_anonymous: number;
  users_new_7d: number;
  subscriptions_active: number;
  subscriptions_cancelled: number;
  subscriptions_billing_issue: number;
  grants_active: number;
  overrides_total: number;
  sync_users: number;
  by_store: Record<string, number>;
  signups_by_day: { day: string; count: number }[];
}

const nf = new Intl.NumberFormat('pt-BR');

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card className="rounded-[20px]">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="tabular text-3xl font-extrabold tracking-tight">{nf.format(value)}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  await requireAdmin('viewer');
  const supabase = await createClient();
  const [{ data: stats, error }, { data: audit }] = await Promise.all([
    supabase.rpc('admin_stats'),
    supabase
      .from('admin_audit_log')
      .select('id, action, entity, entity_id, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
  ]);
  if (error || !stats) {
    return (
      <p className="text-destructive">Não foi possível carregar os indicadores: {error?.message}</p>
    );
  }
  const s = stats as Stats;
  const conversion = s.users_total
    ? ((s.subscriptions_active / s.users_total) * 100).toFixed(1)
    : '0';

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visão geral de usuários, assinaturas e mudanças recentes."
      />
      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Usuários"
          value={s.users_total}
          hint={`${nf.format(s.users_new_7d)} novos em 7 dias`}
        />
        <Stat
          label="Assinantes Pro ativos"
          value={s.subscriptions_active}
          hint={`${conversion.replace('.', ',')}% dos usuários`}
        />
        <Stat
          label="Cancelados (ainda válidos)"
          value={s.subscriptions_cancelled}
          hint={`${nf.format(s.subscriptions_billing_issue)} com problema de cobrança`}
        />
        <Stat
          label="Concessões manuais ativas"
          value={s.grants_active}
          hint={`${nf.format(s.overrides_total)} overrides por usuário`}
        />
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="rounded-[20px] lg:col-span-2">
          <CardHeader>
            <CardTitle>Novos usuários (30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <SignupsChart data={s.signups_by_day} />
          </CardContent>
        </Card>
        <Card className="rounded-[20px]">
          <CardHeader>
            <CardTitle>Assinaturas por loja</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(s.by_store).length === 0 ? (
                  <tr>
                    <td className="text-muted-foreground">Nenhuma assinatura ativa ainda.</td>
                  </tr>
                ) : (
                  Object.entries(s.by_store).map(([store, n]) => (
                    <tr key={store} className="border-b border-border last:border-0">
                      <td className="py-2">{store}</td>
                      <td className="tabular py-2 text-right font-semibold">{nf.format(n)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <p className="mt-4 text-xs text-muted-foreground">
              {nf.format(s.sync_users)} usuários com backup na nuvem ·{' '}
              {nf.format(s.users_anonymous)} anônimos
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 rounded-[20px]">
        <CardHeader>
          <CardTitle>Mudanças recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border text-sm">
            {(audit ?? []).map((a) => (
              <li key={a.id} className="flex justify-between gap-4 py-2">
                <span>
                  <span className="font-semibold">{a.action}</span> · {a.entity}
                  {a.entity_id ? (
                    <span className="text-muted-foreground"> · {a.entity_id}</span>
                  ) : null}
                </span>
                <time className="tabular shrink-0 text-muted-foreground" dateTime={a.created_at}>
                  {new Date(a.created_at).toLocaleString('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </time>
              </li>
            ))}
          </ul>
          <Link href="/audit" className="mt-3 inline-block text-sm font-semibold text-primary">
            Ver auditoria completa
          </Link>
        </CardContent>
      </Card>
    </>
  );
}
