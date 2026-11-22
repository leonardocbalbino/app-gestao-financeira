import { requireAdmin } from '@/lib/auth';
import { roleAtLeast } from '@/lib/roles';
import { apiFetch } from '@/lib/api';
import { PageHeader, ReadOnlyNotice } from '@/components/page-header';
import type { DiffRow } from '@/lib/matrix';
import { MatrixEditor, type MatrixFeature, type MatrixPlan } from './matrix-editor';

export const metadata = { title: 'Funcionalidades' };

export default async function MatrixPage() {
  const session = await requireAdmin('viewer');
  const canEdit = roleAtLeast(session.role, 'editor');
  const m = await apiFetch<{
    plans: MatrixPlan[];
    features: MatrixFeature[];
    draft: { plan_id: string; feature_key: string; value: unknown }[];
    diff: DiffRow[];
  }>('GET', '/admin/matrix');
  const plans = { data: m.plans };
  const features = { data: m.features };
  const diff = { data: m.diff };

  const values: Record<string, unknown> = {};
  for (const r of m.draft) values[`${r.plan_id}|${r.feature_key}`] = r.value;

  return (
    <>
      <PageHeader
        title="Matriz de funcionalidades"
        description="Edite o rascunho, confira as mudanças e publique. Diminuir limites nunca apaga dados: o excedente fica somente leitura no app."
      />
      {!canEdit ? <ReadOnlyNotice /> : null}
      <MatrixEditor
        plans={(plans.data ?? []) as MatrixPlan[]}
        features={(features.data ?? []) as MatrixFeature[]}
        values={values}
        diff={(diff.data ?? []) as DiffRow[]}
        canEdit={canEdit}
      />
    </>
  );
}
