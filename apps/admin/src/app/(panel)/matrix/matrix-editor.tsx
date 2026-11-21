'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { ActionResult } from '@/lib/action';
import { describeDiff, type DiffRow } from '@/lib/matrix';
import { discardDraft, publishMatrix, saveDraftCell, setPaywallVisible } from './actions';

export interface MatrixPlan {
  id: string;
  name: string;
  is_default: boolean;
  active: boolean;
}
export interface MatrixFeature {
  key: string;
  type: 'boolean' | 'limit' | 'ads';
  label: string;
  group_name: string;
  paywall_visible: boolean;
}

interface Props {
  plans: MatrixPlan[];
  features: MatrixFeature[];
  values: Record<string, unknown>;
  diff: DiffRow[];
  canEdit: boolean;
}

export function MatrixEditor({ plans, features, values, diff, canEdit }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const changed = new Set(diff.map((d) => `${d.plan_id}|${d.feature_key}`));
  const planName = (id: string) => plans.find((p) => p.id === id)?.name ?? id;

  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) toast.success(res.message ?? 'Salvo');
      else toast.error(res.error);
      router.refresh();
    });

  const groups = [...new Set(features.map((f) => f.group_name))];

  return (
    <div className="grid gap-6 2xl:grid-cols-[1fr_360px]">
      <div
        className="overflow-x-auto rounded-[20px] border border-border bg-card"
        aria-busy={pending}
      >
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              <th scope="col" className="px-4 py-3 font-semibold">
                Funcionalidade
              </th>
              {plans.map((p) => (
                <th key={p.id} scope="col" className="px-4 py-3 text-center font-semibold">
                  {p.name}
                  {!p.active ? (
                    <span className="block text-xs font-normal text-muted-foreground">inativo</span>
                  ) : null}
                </th>
              ))}
              <th scope="col" className="px-4 py-3 text-center font-semibold">
                No paywall
              </th>
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g}>
              <tr>
                <th
                  colSpan={plans.length + 2}
                  scope="colgroup"
                  className="bg-muted/30 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {g}
                </th>
              </tr>
              {features
                .filter((f) => f.group_name === g)
                .map((f) => (
                  <tr key={f.key} className="border-b border-border last:border-0">
                    <th scope="row" className="px-4 py-2 text-left font-normal">
                      <span className="font-medium">{f.label}</span>
                      <code className="ml-2 text-xs text-muted-foreground">{f.key}</code>
                    </th>
                    {plans.map((p) => {
                      const k = `${p.id}|${f.key}`;
                      const v = values[k];
                      const isChanged = changed.has(k);
                      return (
                        <td
                          key={p.id}
                          className={`px-4 py-2 text-center ${isChanged ? 'bg-pro-soft' : ''}`}
                        >
                          {f.type === 'limit' ? (
                            <Input
                              aria-label={`${f.label} no plano ${p.name} (vazio = ilimitado)`}
                              defaultValue={v === null || v === undefined ? '' : String(v)}
                              placeholder="∞"
                              inputMode="numeric"
                              disabled={!canEdit}
                              className="tabular mx-auto h-9 w-24 text-center"
                              onBlur={(e) => {
                                const raw = e.currentTarget.value;
                                const cur = v === null || v === undefined ? '' : String(v);
                                if (raw.trim() !== cur) run(() => saveDraftCell(p.id, f.key, raw));
                              }}
                            />
                          ) : (
                            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2">
                              <input
                                type="checkbox"
                                className="size-4 accent-[var(--primary)]"
                                checked={v === true}
                                disabled={!canEdit || pending}
                                onChange={(e) =>
                                  run(() =>
                                    saveDraftCell(p.id, f.key, String(e.currentTarget.checked)),
                                  )
                                }
                              />
                              <span className="sr-only">
                                {f.label} no plano {p.name}
                              </span>
                              {f.type === 'ads' ? (
                                <span className="text-xs text-muted-foreground">
                                  {v ? 'exibe' : 'sem'}
                                </span>
                              ) : null}
                            </label>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        aria-label={`Mostrar ${f.label} na tabela do paywall`}
                        className="size-4 accent-[var(--primary)]"
                        checked={f.paywall_visible}
                        disabled={!canEdit || pending}
                        onChange={(e) =>
                          run(() => setPaywallVisible(f.key, e.currentTarget.checked))
                        }
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          ))}
        </table>
      </div>

      <Card className="h-fit rounded-[20px]">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Mudanças não publicadas</CardTitle>
          <Badge variant={diff.length ? 'default' : 'secondary'}>{diff.length}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {diff.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              O rascunho é igual ao que está publicado.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {diff.map((d) => (
                <li
                  key={`${d.plan_id}|${d.feature_key}`}
                  className="rounded-[12px] bg-pro-soft px-3 py-2"
                >
                  {describeDiff(d, planName)}
                </li>
              ))}
            </ul>
          )}
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!diff.length || pending}
                onClick={() => {
                  if (window.confirm(`Publicar ${diff.length} mudança(s) para todos os usuários?`))
                    run(publishMatrix);
                }}
              >
                Publicar
              </Button>
              <Button
                variant="outline"
                disabled={!diff.length || pending}
                onClick={() => {
                  if (window.confirm('Descartar todas as mudanças do rascunho?')) run(discardDraft);
                }}
              >
                Descartar
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
