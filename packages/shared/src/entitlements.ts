import { z } from 'zod';
import {
  FEATURE_CATALOG,
  type BooleanFeatureKey,
  type FeatureKey,
  type FeatureValue,
  type LimitFeatureKey,
  type LimitValue,
} from './features';

export type EntitlementSource = 'default' | 'subscription' | 'manual_grant' | 'fallback';

export interface Entitlements {
  planId: string;
  planName: string;
  source: EntitlementSource;
  /** ISO timestamp; null = não expira. */
  expiresAt: string | null;
  features: Record<FeatureKey, FeatureValue>;
  /** Momento em que o servidor resolveu (para cache/TTL). */
  resolvedAt: string;
}

export const entitlementsResponseSchema = z.object({
  plan_id: z.string(),
  plan_name: z.string(),
  source: z.enum(['default', 'subscription', 'manual_grant', 'fallback']),
  expires_at: z.string().nullable(),
  features: z.record(z.string(), z.union([z.boolean(), z.number(), z.null()])),
  resolved_at: z.string(),
});
export type EntitlementsResponse = z.infer<typeof entitlementsResponseSchema>;

/** Entitlements de fallback (Free embutido) — usados offline sem cache. */
export function fallbackEntitlements(now: Date = new Date()): Entitlements {
  const features = Object.fromEntries(
    FEATURE_CATALOG.map((f) => [f.key, f.defaultValue]),
  ) as Record<FeatureKey, FeatureValue>;
  return {
    planId: 'free',
    planName: 'Free',
    source: 'fallback',
    expiresAt: null,
    features,
    resolvedAt: now.toISOString(),
  };
}

/** Normaliza resposta do servidor, preenchendo chaves ausentes com o default do catálogo. */
export function normalizeEntitlements(raw: unknown): Entitlements {
  const parsed = entitlementsResponseSchema.parse(raw);
  const base = fallbackEntitlements();
  const features = { ...base.features };
  for (const def of FEATURE_CATALOG) {
    const v = parsed.features[def.key];
    if (v === undefined) continue;
    if (def.type === 'limit') {
      features[def.key] = typeof v === 'number' ? Math.max(0, Math.floor(v)) : null;
    } else {
      features[def.key] = Boolean(v);
    }
  }
  return {
    planId: parsed.plan_id,
    planName: parsed.plan_name,
    source: parsed.source,
    expiresAt: parsed.expires_at,
    features,
    resolvedAt: parsed.resolved_at,
  };
}

export function hasFeature(e: Entitlements, key: BooleanFeatureKey): boolean {
  return e.features[key] === true;
}

export function getLimit(e: Entitlements, key: LimitFeatureKey): LimitValue {
  const v = e.features[key];
  return typeof v === 'number' ? v : null;
}

export interface LimitState {
  limit: LimitValue;
  used: number;
  /** null quando ilimitado. */
  remaining: number | null;
  reached: boolean;
  /** Itens além do limite (ficam somente-leitura, nunca são apagados). */
  overBy: number;
}

export function computeLimitState(limit: LimitValue, used: number): LimitState {
  if (limit === null) return { limit, used, remaining: null, reached: false, overBy: 0 };
  const remaining = Math.max(0, limit - used);
  return { limit, used, remaining, reached: used >= limit, overBy: Math.max(0, used - limit) };
}

/** Um plano "remove anúncios" quando ads.show = false. */
export function showsAds(e: Entitlements): boolean {
  return e.features['ads.show'] !== false;
}

/** Linha da tabela comparativa do paywall, gerada a partir da matriz do servidor. */
export interface PlanComparisonRow {
  key: FeatureKey;
  label: string;
  values: Record<string, FeatureValue>;
}

export const planMatrixSchema = z.object({
  plans: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      is_default: z.boolean(),
      sort_order: z.number(),
      rc_entitlement: z.string().nullable(),
    }),
  ),
  values: z.array(
    z.object({
      plan_id: z.string(),
      feature_key: z.string(),
      value: z.union([z.boolean(), z.number(), z.null()]),
    }),
  ),
  paywall_keys: z.array(z.string()).optional(),
});
export type PlanMatrix = z.infer<typeof planMatrixSchema>;

export function buildComparisonRows(matrix: PlanMatrix): PlanComparisonRow[] {
  const keys = (matrix.paywall_keys ?? FEATURE_CATALOG.map((f) => f.key)).filter((k) =>
    FEATURE_CATALOG.some((f) => f.key === k),
  ) as FeatureKey[];
  return keys.map((key) => {
    const def = FEATURE_CATALOG.find((f) => f.key === key)!;
    const values: Record<string, FeatureValue> = {};
    for (const plan of matrix.plans) {
      const cell = matrix.values.find((v) => v.plan_id === plan.id && v.feature_key === key);
      values[plan.id] = cell ? cell.value : def.defaultValue;
    }
    return { key, label: def.paywallLabel, values };
  });
}

/**
 * Matriz de fallback (primeiro uso offline). Espelha o seed: Free = defaults do catálogo,
 * Pro = booleanos liberados, sem anúncios, limites ilimitados (membros: 5).
 */
export function fallbackPlanMatrix(): PlanMatrix {
  return {
    plans: [
      { id: 'free', name: 'Free', is_default: true, sort_order: 0, rc_entitlement: null },
      { id: 'pro', name: 'Pro', is_default: false, sort_order: 1, rc_entitlement: 'pro' },
    ],
    values: FEATURE_CATALOG.flatMap((f) => [
      { plan_id: 'free', feature_key: f.key, value: f.defaultValue },
      {
        plan_id: 'pro',
        feature_key: f.key,
        value:
          f.type === 'boolean'
            ? true
            : f.type === 'ads'
              ? false
              : f.key === 'members.max'
                ? 5
                : null,
      },
    ]),
    paywall_keys: FEATURE_CATALOG.map((f) => f.key),
  };
}

/** Usa o cache apenas se ainda não expirou; caso contrário, cai para o Free embutido. */
export function resolveCachedEntitlements(
  cached: Entitlements | undefined | null,
  now: Date = new Date(),
): Entitlements {
  if (cached && (!cached.expiresAt || new Date(cached.expiresAt).getTime() > now.getTime())) {
    return cached;
  }
  return fallbackEntitlements(now);
}
