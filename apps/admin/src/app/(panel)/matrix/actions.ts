'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { friendlyError, type ActionResult } from '@/lib/action';
import { parseCellInput } from '@/lib/matrix';

/** Salva uma célula no RASCUNHO (não afeta o app até publicar). */
export async function saveDraftCell(
  planId: string,
  featureKey: string,
  raw: string,
): Promise<ActionResult> {
  await requireAdmin('editor');
  const parsed = parseCellInput(featureKey, raw);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const supabase = await createClient();
  const { error } = await supabase.from('plan_features_draft').upsert({
    plan_id: planId,
    feature_key: featureKey,
    value: parsed.value,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath('/matrix');
  return { ok: true, message: 'Rascunho atualizado' };
}

export async function setPaywallVisible(
  featureKey: string,
  visible: boolean,
): Promise<ActionResult> {
  await requireAdmin('editor');
  const supabase = await createClient();
  const { error } = await supabase
    .from('features')
    .update({ paywall_visible: visible })
    .eq('key', featureKey);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath('/matrix');
  return { ok: true, message: visible ? 'Exibida no paywall' : 'Oculta do paywall' };
}

export async function publishMatrix(): Promise<ActionResult> {
  await requireAdmin('editor');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('publish_plan_matrix');
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath('/matrix');
  return { ok: true, message: `Publicado: ${data} mudança(s). Os apps recebem em até ~1 min.` };
}

export async function discardDraft(): Promise<ActionResult> {
  await requireAdmin('editor');
  const supabase = await createClient();
  const { error } = await supabase.rpc('discard_plan_matrix_draft');
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath('/matrix');
  return { ok: true, message: 'Rascunho descartado' };
}
