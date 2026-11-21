import { adConfigSchema, adPlacementSchema, type AdPlacement } from '@app/shared';
import { requireAdmin } from '@/lib/auth';
import { roleAtLeast } from '@/lib/roles';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, ReadOnlyNotice } from '@/components/page-header';
import { ActionForm } from '@/components/action-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveAdConfig } from '../settings-actions';

export const metadata = { title: 'Anúncios' };

const LABEL: Record<AdPlacement, string> = {
  banner_home: 'Banner — Início',
  banner_budgets: 'Banner — Orçamentos',
  banner_reports: 'Banner — Relatórios',
  native_transactions: 'Nativo — lista de Transações',
  interstitial: 'Intersticial (tela cheia)',
};

function Check({
  name,
  label,
  checked,
  disabled,
}: {
  name: string;
  label: string;
  checked: boolean;
  disabled: boolean;
}) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        disabled={disabled}
        className="size-4 accent-[var(--primary)]"
      />
      {label}
    </label>
  );
}

export default async function AdsPage() {
  const session = await requireAdmin('viewer');
  const canEdit = roleAtLeast(session.role, 'editor');
  const supabase = await createClient();
  const { data: row } = await supabase
    .from('ad_config')
    .select('data, updated_at')
    .eq('id', 1)
    .single();
  const cfg = adConfigSchema.parse(row?.data ?? {});
  const placements = adPlacementSchema.options;

  return (
    <>
      <PageHeader
        title="Anúncios"
        description="Valem apenas para quem tem anúncios no plano (ads.show). Em builds de desenvolvimento o app sempre usa IDs de teste."
      />
      {!canEdit ? <ReadOnlyNotice /> : null}
      <ActionForm action={saveAdConfig} className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-[20px]">
          <CardHeader>
            <CardTitle>Posições</CardTitle>
            <CardDescription>Desligue uma posição para removê-la de todos os apps.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <Check
              name="enabled"
              label="Anúncios ligados (chave geral)"
              checked={cfg.enabled}
              disabled={!canEdit}
            />
            <hr className="my-2 border-border" />
            {placements.map((p) => (
              <Check
                key={p}
                name={`placement.${p}`}
                label={LABEL[p]}
                checked={cfg.placements[p] === true}
                disabled={!canEdit}
              />
            ))}
            <div className="grid gap-3 pt-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="native_every_n">Nativo a cada N transações</Label>
                <Input
                  id="native_every_n"
                  name="native_every_n"
                  type="number"
                  min={3}
                  defaultValue={cfg.native_every_n}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="interstitial_min_interval_sec">
                  Intervalo mínimo do intersticial (s)
                </Label>
                <Input
                  id="interstitial_min_interval_sec"
                  name="interstitial_min_interval_sec"
                  type="number"
                  min={60}
                  defaultValue={cfg.interstitial_min_interval_sec}
                  disabled={!canEdit}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[20px]">
          <CardHeader>
            <CardTitle>IDs de bloco (AdMob)</CardTitle>
            <CardDescription>Deixe vazio para não exibir naquela plataforma.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(['ios', 'android'] as const).map((platform) => (
              <fieldset key={platform} className="space-y-2">
                <legend className="text-sm font-semibold">
                  {platform === 'ios' ? 'iOS' : 'Android'}
                </legend>
                {placements.map((p) => (
                  <div key={p} className="grid items-center gap-2 sm:grid-cols-[180px_1fr]">
                    <Label
                      htmlFor={`unit.${platform}.${p}`}
                      className="text-xs text-muted-foreground"
                    >
                      {LABEL[p]}
                    </Label>
                    <Input
                      id={`unit.${platform}.${p}`}
                      name={`unit.${platform}.${p}`}
                      defaultValue={cfg.ad_unit_ids[platform][p] ?? ''}
                      placeholder="ca-app-pub-0000000000000000/0000000000"
                      disabled={!canEdit}
                      className="font-mono text-xs"
                    />
                  </div>
                ))}
              </fieldset>
            ))}
          </CardContent>
        </Card>

        {canEdit ? (
          <div className="xl:col-span-2">
            <Button type="submit">Salvar anúncios</Button>
            {row?.updated_at ? (
              <span className="ml-3 text-xs text-muted-foreground">
                Última alteração: {new Date(row.updated_at).toLocaleString('pt-BR')}
              </span>
            ) : null}
          </div>
        ) : null}
      </ActionForm>
    </>
  );
}
