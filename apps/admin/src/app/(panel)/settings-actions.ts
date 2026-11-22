'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { friendlyError, type ActionResult } from '@/lib/action';
import { parseAdConfigForm, parseAppConfigForm } from '@/lib/forms';

export async function saveAdConfig(fd: FormData): Promise<ActionResult> {
  await requireAdmin('editor');
  let data;
  try {
    data = parseAdConfigForm(fd);
  } catch {
    return { ok: false, error: 'Valores inválidos: nativo a cada ≥ 3 itens e intervalo ≥ 60 s.' };
  }
  try {
    await apiFetch('PUT', '/admin/ad-config', data);
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
  revalidatePath('/ads');
  return { ok: true, message: 'Anúncios atualizados. Os apps recebem em até ~1 min.' };
}

export async function saveAppConfig(fd: FormData): Promise<ActionResult> {
  await requireAdmin('editor');
  let data;
  try {
    data = parseAppConfigForm(fd);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  try {
    await apiFetch('PUT', '/admin/app-config', data);
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
  revalidatePath('/config');
  return { ok: true, message: 'Configuração publicada.' };
}
