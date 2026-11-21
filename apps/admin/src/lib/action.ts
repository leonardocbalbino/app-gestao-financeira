export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

/** Traduz erros do Postgres/Supabase para mensagens do painel. */
export function friendlyError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/forbidden|42501|row-level security|permission/i.test(msg))
    return 'Sem permissão para esta ação.';
  if (/limit_reached/.test(msg)) return 'Limite do plano atingido.';
  if (/user_not_found/.test(msg)) return 'Usuário não encontrado.';
  if (/cannot_remove_self/.test(msg)) return 'Você não pode remover o próprio acesso.';
  if (/duplicate key/.test(msg)) return 'Já existe um registro com esse identificador.';
  return msg;
}
