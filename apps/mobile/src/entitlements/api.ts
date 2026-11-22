import {
  adConfigSchema,
  appConfigSchema,
  normalizeEntitlements,
  planMatrixSchema,
  type AdConfig,
  type AppConfig,
  type Entitlements,
  type PlanMatrix,
} from '@app/shared';
import { api, getSessionUser, isApiConfigured } from '@/lib/api';

/** Entitlements do usuário logado, resolvidos no servidor. Null quando offline/sem sessão. */
export async function fetchEntitlements(): Promise<Entitlements | null> {
  if (!isApiConfigured() || !getSessionUser()) return null;
  return normalizeEntitlements(await api<unknown>('GET', '/me/entitlements'));
}

export interface RemoteConfig {
  app: AppConfig;
  ads: AdConfig;
  updatedAt: string | null;
}

interface PublicConfig {
  config: { app?: unknown; ads?: unknown; updated_at?: string | null } | null;
  matrix: unknown;
}

let inflight: Promise<PublicConfig> | null = null;
/** Uma chamada traz config remota + matriz (deduplicada entre os dois consumidores). */
function fetchPublicConfig(): Promise<PublicConfig> {
  inflight ??= api<PublicConfig>('GET', '/config').finally(() => {
    setTimeout(() => (inflight = null), 0);
  });
  return inflight;
}

export async function fetchPlanMatrix(): Promise<PlanMatrix | null> {
  if (!isApiConfigured()) return null;
  return planMatrixSchema.parse((await fetchPublicConfig()).matrix);
}

export async function fetchRemoteConfig(): Promise<RemoteConfig | null> {
  if (!isApiConfigured()) return null;
  const raw = (await fetchPublicConfig()).config ?? {};
  return {
    app: appConfigSchema.parse(raw.app ?? {}),
    ads: adConfigSchema.parse(raw.ads ?? {}),
    updatedAt: raw.updated_at ?? null,
  };
}
