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
import { supabase } from '@/lib/supabase';

/** Entitlements do usuário logado, resolvidos no servidor. Null quando offline/sem sessão. */
export async function fetchEntitlements(): Promise<Entitlements | null> {
  if (!supabase) return null;
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return null;
  const { data, error } = await supabase.rpc('my_entitlements');
  if (error) throw error;
  return normalizeEntitlements(data);
}

export async function fetchPlanMatrix(): Promise<PlanMatrix | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_plan_matrix');
  if (error) throw error;
  return planMatrixSchema.parse(data);
}

export interface RemoteConfig {
  app: AppConfig;
  ads: AdConfig;
  updatedAt: string | null;
}

export async function fetchRemoteConfig(): Promise<RemoteConfig | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_remote_config');
  if (error) throw error;
  const raw = (data ?? {}) as { app?: unknown; ads?: unknown; updated_at?: string | null };
  return {
    app: appConfigSchema.parse(raw.app ?? {}),
    ads: adConfigSchema.parse(raw.ads ?? {}),
    updatedAt: raw.updated_at ?? null,
  };
}
