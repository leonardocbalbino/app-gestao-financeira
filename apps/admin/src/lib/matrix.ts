import { getFeatureDefinition, type FeatureValue } from '@app/shared';

export type CellValue = FeatureValue;

/**
 * Converte o texto digitado no admin para o valor da feature.
 * limit: "" | "ilimitado" | "∞" → null; número inteiro ≥ 0. boolean/ads: "true"/"false".
 */
export function parseCellInput(
  featureKey: string,
  raw: string,
): { ok: true; value: CellValue } | { ok: false; error: string } {
  const def = getFeatureDefinition(featureKey);
  if (!def) return { ok: false, error: 'Feature desconhecida' };
  const s = raw.trim().toLowerCase();
  if (def.type === 'limit') {
    if (s === '' || s === 'ilimitado' || s === '∞' || s === 'null')
      return { ok: true, value: null };
    if (!/^\d+$/.test(s))
      return { ok: false, error: 'Use um número inteiro ≥ 0 ou deixe vazio para ilimitado' };
    return { ok: true, value: Number(s) };
  }
  if (s === 'true' || s === 'sim' || s === '1') return { ok: true, value: true };
  if (s === 'false' || s === 'não' || s === 'nao' || s === '0') return { ok: true, value: false };
  return { ok: false, error: 'Valor deve ser sim/não' };
}

export function formatCell(featureKey: string, value: CellValue | undefined): string {
  const def = getFeatureDefinition(featureKey);
  if (value === undefined) return '—';
  if (def?.type === 'limit') return value === null ? 'Ilimitado' : String(value);
  if (def?.type === 'ads') return value ? 'Com anúncios' : 'Sem anúncios';
  return value ? 'Sim' : 'Não';
}

export interface DiffRow {
  plan_id: string;
  feature_key: string;
  live: CellValue | undefined;
  draft: CellValue | undefined;
}

/** Texto legível de uma mudança: "Free · Orçamentos: 3 → 5". */
export function describeDiff(d: DiffRow, planName: (id: string) => string): string {
  const label = getFeatureDefinition(d.feature_key)?.label ?? d.feature_key;
  return `${planName(d.plan_id)} · ${label}: ${formatCell(d.feature_key, d.live)} → ${formatCell(d.feature_key, d.draft)}`;
}
