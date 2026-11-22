'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
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
  try {
    await apiFetch('PUT', '/admin/matrix/draft', { planId, featureKey, value: parsed.value });
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
  revalidatePath('/matrix');
  return { ok: true, message: 'Rascunho atualizado' };
}

export async function setPaywallVisible(
  featureKey: string,
  visible: boolean,
): Promise<ActionResult> {
  await requireAdmin('editor');
  try {
    await apiFetch('PUT', `/admin/features/${encodeURIComponent(featureKey)}/paywall`, { visible });
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
  revalidatePath('/matrix');
  return { ok: true, message: visible ? 'Exibida no paywall' : 'Oculta do paywall' };
}

export async function publishMatrix(): Promise<ActionResult> {
  await requireAdmin('editor');
  try {
    const r = await apiFetch<{ changed: number }>('POST', '/admin/matrix/publish');
    revalidatePath('/matrix');
    return {
      ok: true,
      message: `Publicado: ${r.changed} mudança(s). Os apps recebem em até ~1 min.`,
    };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function discardDraft(): Promise<ActionResult> {
  await requireAdmin('editor');
  try {
    await apiFetch('POST', '/admin/matrix/discard');
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
  revalidatePath('/matrix');
  return { ok: true, message: 'Rascunho descartado' };
}
