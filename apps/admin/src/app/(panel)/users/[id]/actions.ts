'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { friendlyError, type ActionResult } from '@/lib/action';
import { parseCellInput } from '@/lib/matrix';

const uuid = z.string().uuid();

async function run(
  userId: string,
  fn: () => Promise<unknown>,
  message: string,
): Promise<ActionResult> {
  try {
    await fn();
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
  revalidatePath(`/users/${userId}`);
  return { ok: true, message };
}

export async function grantPlan(fd: FormData): Promise<ActionResult> {
  await requireAdmin('editor');
  const userId = uuid.safeParse(fd.get('user_id'));
  if (!userId.success) return { ok: false, error: 'Usuário inválido' };
  const days = Number(fd.get('days')) || 0;
  const reason = String(fd.get('reason') ?? '').trim();
  if (!reason) return { ok: false, error: 'Informe o motivo (fica na auditoria)' };
  return run(
    userId.data,
    () =>
      apiFetch('POST', `/admin/users/${userId.data}/grants`, {
        planId: String(fd.get('plan_id') ?? 'pro'),
        days,
        reason,
      }),
    days > 0 ? `Concedido por ${days} dias` : 'Concedido sem prazo',
  );
}

export async function revokeGrant(fd: FormData): Promise<ActionResult> {
  await requireAdmin('editor');
  const id = uuid.safeParse(fd.get('grant_id'));
  if (!id.success) return { ok: false, error: 'Concessão inválida' };
  return run(
    String(fd.get('user_id')),
    () => apiFetch('POST', `/admin/grants/${id.data}/revoke`),
    'Concessão revogada',
  );
}

export async function setOverride(fd: FormData): Promise<ActionResult> {
  await requireAdmin('editor');
  const userId = uuid.safeParse(fd.get('user_id'));
  if (!userId.success) return { ok: false, error: 'Usuário inválido' };
  const key = String(fd.get('feature_key') ?? '');
  const parsed = parseCellInput(key, String(fd.get('value') ?? ''));
  if (!parsed.ok) return { ok: false, error: parsed.error };
  return run(
    userId.data,
    () =>
      apiFetch('PUT', `/admin/users/${userId.data}/overrides/${encodeURIComponent(key)}`, {
        value: parsed.value,
        days: Number(fd.get('days')) || 0,
        reason: String(fd.get('reason') ?? ''),
      }),
    'Override salvo',
  );
}

export async function removeOverride(fd: FormData): Promise<ActionResult> {
  await requireAdmin('editor');
  const userId = uuid.safeParse(fd.get('user_id'));
  if (!userId.success) return { ok: false, error: 'Usuário inválido' };
  const key = String(fd.get('feature_key'));
  return run(
    userId.data,
    () => apiFetch('DELETE', `/admin/users/${userId.data}/overrides/${encodeURIComponent(key)}`),
    'Override removido',
  );
}
