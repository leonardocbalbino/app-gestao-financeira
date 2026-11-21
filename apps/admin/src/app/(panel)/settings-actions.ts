'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
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
  const supabase = await createClient();
  const { error } = await supabase.from('ad_config').update({ data }).eq('id', 1);
  if (error) return { ok: false, error: friendlyError(error) };
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
  const supabase = await createClient();
  const { error } = await supabase.from('app_config').update({ data }).eq('id', 1);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath('/config');
  return { ok: true, message: 'Configuração publicada.' };
}
