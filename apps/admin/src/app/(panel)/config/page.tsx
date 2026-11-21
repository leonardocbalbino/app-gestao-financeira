import { appConfigSchema } from '@app/shared';
import { requireAdmin } from '@/lib/auth';
import { roleAtLeast } from '@/lib/roles';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, ReadOnlyNotice } from '@/components/page-header';
import { ActionForm } from '@/components/action-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { saveAppConfig } from '../settings-actions';

export const metadata = { title: 'Config remota' };

export default async function ConfigPage() {
  const session = await requireAdmin('viewer');
  const canEdit = roleAtLeast(session.role, 'editor');
  const supabase = await createClient();
  const { data: row } = await supabase
    .from('app_config')
    .select('data, updated_at')
    .eq('id', 1)
    .single();
  const cfg = appConfigSchema.parse(row?.data ?? {});

  return (
    <>
      <PageHeader
        title="Configuração remota"
        description="Chega aos apps em até ~1 minuto, sem nova versão na loja."
      />
      {!canEdit ? <ReadOnlyNotice /> : null}
      <Card className="max-w-2xl rounded-[20px]">
        <CardContent>
          <ActionForm
            action={saveAppConfig}
            className="space-y-5"
            confirm="Publicar a configuração para todos os apps?"
          >
            <div className="space-y-1.5">
              <Label htmlFor="min_app_version">Versão mínima do app</Label>
              <Input
                id="min_app_version"
                name="min_app_version"
                defaultValue={cfg.min_app_version}
                disabled={!canEdit}
                className="max-w-40 font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Versões abaixo desta veem um aviso de atualização obrigatória.
              </p>
            </div>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="maintenance_mode"
                defaultChecked={cfg.maintenance_mode}
                disabled={!canEdit}
                className="size-4 accent-[var(--primary)]"
              />
              Modo manutenção (sincronização e compras pausadas; uso local continua)
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="maintenance_message">Mensagem de manutenção</Label>
              <Input
                id="maintenance_message"
                name="maintenance_message"
                defaultValue={cfg.maintenance_message}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paywall_default_plan">Plano pré-selecionado no paywall</Label>
              <select
                id="paywall_default_plan"
                name="paywall_default_plan"
                defaultValue={cfg.paywall_default_plan}
                disabled={!canEdit}
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="annual">Anual</option>
                <option value="monthly">Mensal</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="feature_flags">Feature flags (JSON)</Label>
              <Textarea
                id="feature_flags"
                name="feature_flags"
                rows={6}
                defaultValue={JSON.stringify(cfg.feature_flags, null, 2)}
                disabled={!canEdit}
                className="font-mono text-xs"
              />
            </div>
            {canEdit ? <Button type="submit">Publicar configuração</Button> : null}
          </ActionForm>
        </CardContent>
      </Card>
    </>
  );
}
