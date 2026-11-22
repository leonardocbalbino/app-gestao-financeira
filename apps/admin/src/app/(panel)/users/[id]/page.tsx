import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FEATURE_CATALOG } from '@app/shared';
import { requireAdmin } from '@/lib/auth';
import { roleAtLeast } from '@/lib/roles';
import { apiFetch } from '@/lib/api';
import { formatCell } from '@/lib/matrix';
import { PageHeader } from '@/components/page-header';
import { ActionForm } from '@/components/action-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { grantPlan, removeOverride, revokeGrant, setOverride } from './actions';

export const metadata = { title: 'Usuário' };

interface Detail {
  user: {
    id: string;
    email: string | null;
    is_anonymous: boolean;
    created_at: string;
    last_sign_in_at: string | null;
    providers: string[] | null;
  } | null;
  entitlements: {
    plan_id: string;
    plan_name: string;
    source: string;
    expires_at: string | null;
    features: Record<string, unknown>;
  };
  subscription: {
    status: string;
    store: string | null;
    product_id: string | null;
    expires_at: string | null;
  } | null;
  grants: {
    id: string;
    plan_id: string;
    starts_at: string;
    expires_at: string | null;
    reason: string;
    revoked_at: string | null;
  }[];
  overrides: { feature_key: string; value: unknown; reason: string; expires_at: string | null }[];
  usage: Record<string, number>;
}

const dt = (d: string | null) =>
  d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin('viewer');
  const canEdit = roleAtLeast(session.role, 'editor');
  const { id } = await params;
  let d: Detail;
  let allPlans: { id: string; name: string; is_default: boolean }[];
  try {
    [d, allPlans] = await Promise.all([
      apiFetch<Detail>('GET', `/admin/users/${encodeURIComponent(id)}`),
      apiFetch<{ id: string; name: string; is_default: boolean }[]>('GET', '/admin/plans'),
    ]);
  } catch (e) {
    if ((e as { status?: number }).status === 404) notFound();
    return <p className="text-destructive">{(e as Error).message}</p>;
  }
  const plans = allPlans.filter((p) => !p.is_default);
  if (!d?.user) notFound();
  const e = d.entitlements;

  return (
    <>
      <Link href="/users" className="text-sm text-primary">
        ← Usuários
      </Link>
      <PageHeader
        title={d.user.email ?? (d.user.is_anonymous ? 'Usuário anônimo' : 'Usuário')}
        description={`${d.user.id} · criado ${dt(d.user.created_at)} · último acesso ${dt(d.user.last_sign_in_at)}`}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="rounded-[20px]">
          <CardHeader>
            <CardTitle>Plano efetivo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <Badge
                className={e.plan_id === 'free' ? '' : 'bg-pro text-pro-ink'}
                variant={e.plan_id === 'free' ? 'secondary' : 'default'}
              >
                {e.plan_name}
              </Badge>{' '}
              via {e.source}
              {e.expires_at ? ` · até ${dt(e.expires_at)}` : ''}
            </p>
            <p className="text-muted-foreground">
              Assinatura:{' '}
              {d.subscription
                ? `${d.subscription.status} · ${d.subscription.product_id ?? ''} · ${d.subscription.store ?? ''} · expira ${dt(d.subscription.expires_at)}`
                : 'nenhuma'}
            </p>
            <p className="text-muted-foreground">
              Uso na nuvem: {d.usage.accounts} contas · {d.usage.transactions} transações ·{' '}
              {d.usage.budgets} orçamentos · {d.usage.goals} metas
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-[20px] xl:col-span-2">
          <CardHeader>
            <CardTitle>Funcionalidades resolvidas</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {FEATURE_CATALOG.map((f) => {
                const overridden = d.overrides.some((o) => o.feature_key === f.key);
                return (
                  <li
                    key={f.key}
                    className="flex justify-between gap-2 border-b border-border py-1.5"
                  >
                    <span>
                      {f.label}
                      {overridden ? (
                        <Badge variant="outline" className="ml-2">
                          override
                        </Badge>
                      ) : null}
                    </span>
                    <span className="tabular font-medium">
                      {formatCell(f.key, e.features[f.key] as never)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card className="rounded-[20px]">
          <CardHeader>
            <CardTitle>Concessões manuais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              {d.grants.length === 0 ? <li className="text-muted-foreground">Nenhuma.</li> : null}
              {d.grants.map((g) => (
                <li key={g.id} className="rounded-[12px] border border-border p-3">
                  <p className="font-medium">
                    {g.plan_id} · {g.expires_at ? `até ${dt(g.expires_at)}` : 'sem prazo'}
                    {g.revoked_at ? (
                      <Badge variant="destructive" className="ml-2">
                        revogada
                      </Badge>
                    ) : null}
                  </p>
                  <p className="text-muted-foreground">{g.reason}</p>
                  {canEdit && !g.revoked_at ? (
                    <ActionForm
                      action={revokeGrant}
                      confirm="Revogar esta concessão?"
                      className="mt-2"
                    >
                      <input type="hidden" name="grant_id" value={g.id} />
                      <input type="hidden" name="user_id" value={d.user!.id} />
                      <Button type="submit" variant="destructive" size="sm">
                        Revogar
                      </Button>
                    </ActionForm>
                  ) : null}
                </li>
              ))}
            </ul>
            {canEdit ? (
              <ActionForm action={grantPlan} className="space-y-3 border-t border-border pt-4">
                <input type="hidden" name="user_id" value={d.user.id} />
                <div className="space-y-1.5">
                  <Label htmlFor="plan_id">Plano</Label>
                  <select
                    id="plan_id"
                    name="plan_id"
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    {(plans ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="days">Duração (dias, 0 = sem prazo)</Label>
                  <Input id="days" name="days" type="number" min={0} defaultValue={30} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reason">Motivo</Label>
                  <Input
                    id="reason"
                    name="reason"
                    placeholder="Ex.: compensação por falha"
                    required
                  />
                </div>
                <Button type="submit" className="bg-pro text-pro-ink hover:bg-pro/80">
                  Conceder plano
                </Button>
              </ActionForm>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-[20px] xl:col-span-2">
          <CardHeader>
            <CardTitle>Overrides deste usuário</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              {d.overrides.length === 0 ? <li className="text-muted-foreground">Nenhum.</li> : null}
              {d.overrides.map((o) => (
                <li
                  key={o.feature_key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-border p-3"
                >
                  <span>
                    <code>{o.feature_key}</code> ={' '}
                    <strong>{formatCell(o.feature_key, o.value as never)}</strong>
                    {o.expires_at ? ` · até ${dt(o.expires_at)}` : ''}{' '}
                    {o.reason ? <span className="text-muted-foreground">· {o.reason}</span> : null}
                  </span>
                  {canEdit ? (
                    <ActionForm action={removeOverride} confirm="Remover override?">
                      <input type="hidden" name="user_id" value={d.user!.id} />
                      <input type="hidden" name="feature_key" value={o.feature_key} />
                      <Button type="submit" variant="outline" size="sm">
                        Remover
                      </Button>
                    </ActionForm>
                  ) : null}
                </li>
              ))}
            </ul>
            {canEdit ? (
              <ActionForm
                action={setOverride}
                className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2"
              >
                <input type="hidden" name="user_id" value={d.user.id} />
                <div className="space-y-1.5">
                  <Label htmlFor="feature_key">Funcionalidade</Label>
                  <select
                    id="feature_key"
                    name="feature_key"
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    {FEATURE_CATALOG.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label} ({f.type === 'limit' ? 'número ou vazio' : 'sim/não'})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="value">Valor</Label>
                  <Input id="value" name="value" placeholder="sim · não · 10 · vazio = ilimitado" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ov-days">Expira em (dias, 0 = nunca)</Label>
                  <Input id="ov-days" name="days" type="number" min={0} defaultValue={0} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ov-reason">Motivo</Label>
                  <Input id="ov-reason" name="reason" />
                </div>
                <div>
                  <Button type="submit">Salvar override</Button>
                </div>
              </ActionForm>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
