'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { friendlyError, type ActionResult } from '@/lib/action';
import { parseCellInput } from '@/lib/matrix';

const uuid = z.string().uuid();

export async function grantPlan(fd: FormData): Promise<ActionResult> {
  await requireAdmin('editor');
  const userId = uuid.safeParse(fd.get('user_id'));
  if (!userId.success) return { ok: false, error: 'Usuário inválido' };
  const days = Number(fd.get('days'));
  const planId = String(fd.get('plan_id') ?? 'pro');
  const reason = String(fd.get('reason') ?? '').trim();
  if (!reason) return { ok: false, error: 'Informe o motivo (fica na auditoria)' };
  const expires = days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null;
  const supabase = await createClient();
  const { error } = await supabase
    .from('manual_grants')
    .insert({ user_id: userId.data, plan_id: planId, expires_at: expires, reason });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/users/${userId.data}`);
  return { ok: true, message: days > 0 ? `Concedido por ${days} dias` : 'Concedido sem prazo' };
}

export async function revokeGrant(fd: FormData): Promise<ActionResult> {
  await requireAdmin('editor');
  const id = uuid.safeParse(fd.get('grant_id'));
  if (!id.success) return { ok: false, error: 'Concessão inválida' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('manual_grants')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id.data);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/users/${fd.get('user_id')}`);
  return { ok: true, message: 'Concessão revogada' };
}

export async function setOverride(fd: FormData): Promise<ActionResult> {
  await requireAdmin('editor');
  const userId = uuid.safeParse(fd.get('user_id'));
  if (!userId.success) return { ok: false, error: 'Usuário inválido' };
  const key = String(fd.get('feature_key') ?? '');
  const parsed = parseCellInput(key, String(fd.get('value') ?? ''));
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const days = Number(fd.get('days'));
  const supabase = await createClient();
  const { error } = await supabase.from('user_plan_overrides').upsert({
    user_id: userId.data,
    feature_key: key,
    value: parsed.value,
    reason: String(fd.get('reason') ?? ''),
    expires_at: days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/users/${userId.data}`);
  return { ok: true, message: 'Override salvo' };
}

export async function removeOverride(fd: FormData): Promise<ActionResult> {
  await requireAdmin('editor');
  const userId = uuid.safeParse(fd.get('user_id'));
  if (!userId.success) return { ok: false, error: 'Usuário inválido' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('user_plan_overrides')
    .delete()
    .eq('user_id', userId.data)
    .eq('feature_key', String(fd.get('feature_key')));
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/users/${userId.data}`);
  return { ok: true, message: 'Override removido' };
}
