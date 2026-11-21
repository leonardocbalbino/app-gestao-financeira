import { requireAdmin } from '@/lib/auth';
import { roleAtLeast } from '@/lib/roles';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, ReadOnlyNotice } from '@/components/page-header';
import type { DiffRow } from '@/lib/matrix';
import { MatrixEditor, type MatrixFeature, type MatrixPlan } from './matrix-editor';

export const metadata = { title: 'Funcionalidades' };

export default async function MatrixPage() {
  const session = await requireAdmin('viewer');
  const canEdit = roleAtLeast(session.role, 'editor');
  const supabase = await createClient();
  const [plans, features, draft, diff] = await Promise.all([
    supabase.from('plans').select('id, name, is_default, active').order('sort_order'),
    supabase
      .from('features')
      .select('key, type, label, group_name, paywall_visible')
      .order('sort_order'),
    supabase.from('plan_features_draft').select('plan_id, feature_key, value'),
    supabase.rpc('plan_matrix_diff'),
  ]);

  const values: Record<string, unknown> = {};
  for (const r of draft.data ?? []) values[`${r.plan_id}|${r.feature_key}`] = r.value;

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
