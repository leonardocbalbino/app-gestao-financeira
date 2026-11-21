import { requireAdmin } from '@/lib/auth';
import { roleAtLeast } from '@/lib/roles';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, ReadOnlyNotice } from '@/components/page-header';
import { ActionForm } from '@/components/action-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createPlan, savePlan } from './actions';

export const metadata = { title: 'Planos' };

interface Plan {
  id: string;
  name: string;
  description: string;
  is_default: boolean;
  sort_order: number;
  rc_entitlement: string | null;
  active: boolean;
}

function PlanFields({ plan, disabled }: { plan?: Plan; disabled: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={`id-${plan?.id ?? 'new'}`}>ID</Label>
        <Input
          id={`id-${plan?.id ?? 'new'}`}
          name="id"
          defaultValue={plan?.id}
          readOnly={!!plan}
          disabled={disabled}
          required
          placeholder="familia"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`name-${plan?.id ?? 'new'}`}>Nome</Label>
        <Input
          id={`name-${plan?.id ?? 'new'}`}
          name="name"
          defaultValue={plan?.name}
          disabled={disabled}
          required
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`desc-${plan?.id ?? 'new'}`}>Descrição</Label>
        <Input
          id={`desc-${plan?.id ?? 'new'}`}
          name="description"
          defaultValue={plan?.description}
          disabled={disabled}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`rc-${plan?.id ?? 'new'}`}>Entitlement do RevenueCat</Label>
        <Input
          id={`rc-${plan?.id ?? 'new'}`}
          name="rc_entitlement"
          defaultValue={plan?.rc_entitlement ?? ''}
          disabled={disabled || plan?.is_default}
          placeholder="pro"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`sort-${plan?.id ?? 'new'}`}>Ordem</Label>
        <Input
          id={`sort-${plan?.id ?? 'new'}`}
          name="sort_order"
          type="number"
          defaultValue={plan?.sort_order ?? 10}
          disabled={disabled}
        />
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={plan?.active ?? true}
          disabled={disabled || plan?.is_default}
          className="size-4 accent-[var(--primary)]"
        />
        Ativo (aparece no paywall)
      </label>
    </div>
  );
}

export default async function PlansPage() {
  const session = await requireAdmin('viewer');
  const canEdit = roleAtLeast(session.role, 'editor');
  const supabase = await createClient();
  const { data: plans } = await supabase.from('plans').select('*').order('sort_order');

  return (
    <>
      <PageHeader
        title="Planos"
        description="O plano padrão vale para todos sem assinatura. Planos pagos se ligam a um entitlement do RevenueCat."
      />
      {!canEdit ? <ReadOnlyNotice /> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {(plans as Plan[] | null)?.map((p) => (
          <Card key={p.id} className="rounded-[20px]">
            <CardHeader className="flex flex-row items-center gap-2">
              <CardTitle>{p.name}</CardTitle>
              {p.is_default ? <Badge variant="secondary">Padrão</Badge> : null}
              {!p.active ? <Badge variant="outline">Inativo</Badge> : null}
              {p.rc_entitlement ? (
                <Badge className="bg-pro text-pro-ink">RC: {p.rc_entitlement}</Badge>
              ) : null}
            </CardHeader>
            <CardContent>
              <ActionForm action={savePlan} className="space-y-4">
                <PlanFields plan={p} disabled={!canEdit} />
                {canEdit ? <Button type="submit">Salvar</Button> : null}
              </ActionForm>
            </CardContent>
          </Card>
        ))}
      </div>

      {canEdit ? (
        <Card className="mt-6 rounded-[20px]">
          <CardHeader>
            <CardTitle>Novo plano</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={createPlan} className="space-y-4">
              <PlanFields disabled={false} />
              <Button type="submit">Criar plano</Button>
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
