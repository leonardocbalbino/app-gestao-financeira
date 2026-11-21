'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { friendlyError, type ActionResult } from '@/lib/action';

const planSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/, 'ID: letras minúsculas, números e _'),
  name: z.string().trim().min(1, 'Informe o nome').max(40),
  description: z.string().trim().max(200),
  rc_entitlement: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v)),
  sort_order: z.coerce.number().int(),
  active: z.boolean(),
});

function read(fd: FormData) {
  return planSchema.safeParse({
    id: fd.get('id'),
    name: fd.get('name'),
    description: fd.get('description') ?? '',
    rc_entitlement: fd.get('rc_entitlement') ?? '',
    sort_order: fd.get('sort_order') ?? 0,
    active: fd.get('active') === 'on',
  });
}

export async function savePlan(fd: FormData): Promise<ActionResult> {
  await requireAdmin('editor');
  const parsed = read(fd);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const supabase = await createClient();
  const { id, ...rest } = parsed.data;
  const { error } = await supabase.from('plans').update(rest).eq('id', id);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath('/plans');
  return { ok: true, message: 'Plano atualizado' };
}

export async function createPlan(fd: FormData): Promise<ActionResult> {
  await requireAdmin('editor');
  const parsed = read(fd);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const supabase = await createClient();
  const { error } = await supabase.from('plans').insert({ ...parsed.data, is_default: false });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath('/plans');
  revalidatePath('/matrix');
  return { ok: true, message: 'Plano criado — configure as funcionalidades na matriz' };
}
