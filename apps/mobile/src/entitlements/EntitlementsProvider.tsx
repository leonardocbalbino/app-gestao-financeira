import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { focusManager, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adConfigSchema,
  appConfigSchema,
  fallbackPlanMatrix,
  resolveCachedEntitlements,
  type Entitlements,
  type PlanMatrix,
} from '@app/shared';
import { getJSON, PrefKeys, setJSON } from '@/lib/storage';
import { fetchEntitlements, fetchPlanMatrix, fetchRemoteConfig, type RemoteConfig } from './api';

/** Mudanças feitas no admin chegam ao app em até ~1 min (polling) ou na volta ao app (foco). */
export const REFRESH_INTERVAL_MS = 60_000;

export const entitlementKeys = {
  entitlements: ['entitlements'] as const,
  matrix: ['planMatrix'] as const,
  config: ['remoteConfig'] as const,
};

interface ContextValue {
  entitlements: Entitlements;
  matrix: PlanMatrix;
  config: RemoteConfig;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
  /** Aplica entitlements imediatamente (ex.: após compra no RevenueCat). */
  apply: (e: Entitlements) => void;
}

const defaultConfig = (): RemoteConfig => ({
  app: appConfigSchema.parse({}),
  ads: adConfigSchema.parse({}),
  updatedAt: null,
});

const EntitlementsContext = createContext<ContextValue | null>(null);

// TanStack Query considera "foco" = app em primeiro plano.
focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener('change', (s) => handleFocus(s === 'active'));
  return () => sub.remove();
});

interface Props {
  children: ReactNode;
  /** Injeção para testes/storybook: fixa entitlements sem rede. */
  initial?: Entitlements;
}

export function EntitlementsProvider({ children, initial }: Props) {
  const qc = useQueryClient();

  const ent = useQuery({
    queryKey: entitlementKeys.entitlements,
    queryFn: async () => {
      const fresh = await fetchEntitlements();
      if (fresh) {
        setJSON(PrefKeys.entitlementsCache, fresh);
        return fresh;
      }
      return resolveCachedEntitlements(getJSON<Entitlements>(PrefKeys.entitlementsCache));
    },
    initialData: () =>
      initial ?? resolveCachedEntitlements(getJSON<Entitlements>(PrefKeys.entitlementsCache)),
    initialDataUpdatedAt: 0,
    enabled: !initial,
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const matrix = useQuery({
    queryKey: entitlementKeys.matrix,
    queryFn: async () => {
      const m = await fetchPlanMatrix().catch(() => null);
      if (m) setJSON('cache.planMatrix', m);
      return m ?? getJSON<PlanMatrix>('cache.planMatrix') ?? fallbackPlanMatrix();
    },
    initialData: () => getJSON<PlanMatrix>('cache.planMatrix') ?? fallbackPlanMatrix(),
    initialDataUpdatedAt: 0,
    enabled: !initial,
    staleTime: REFRESH_INTERVAL_MS,
  });

  const config = useQuery({
    queryKey: entitlementKeys.config,
    queryFn: async () => {
      const c = await fetchRemoteConfig().catch(() => null);
      if (c) setJSON(PrefKeys.configCache, c);
      return c ?? getJSON<RemoteConfig>(PrefKeys.configCache) ?? defaultConfig();
    },
    initialData: () => getJSON<RemoteConfig>(PrefKeys.configCache) ?? defaultConfig(),
    initialDataUpdatedAt: 0,
    enabled: !initial,
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });

  // Se a matriz publicada mudou (updated_at da config), refaz entitlements e matriz.
  const configUpdatedAt = config.data.updatedAt;
  useEffect(() => {
    if (!configUpdatedAt || initial) return;
    void qc.invalidateQueries({ queryKey: entitlementKeys.entitlements });
    void qc.invalidateQueries({ queryKey: entitlementKeys.matrix });
  }, [configUpdatedAt, qc, initial]);

  const refresh = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: entitlementKeys.entitlements }),
      qc.invalidateQueries({ queryKey: entitlementKeys.matrix }),
      qc.invalidateQueries({ queryKey: entitlementKeys.config }),
    ]);
  }, [qc]);

  const apply = useCallback(
    (e: Entitlements) => {
      setJSON(PrefKeys.entitlementsCache, e);
      qc.setQueryData(entitlementKeys.entitlements, e);
    },
    [qc],
  );

  const value = useMemo<ContextValue>(
    () => ({
      entitlements: ent.data,
      matrix: matrix.data,
      config: config.data,
      isRefreshing: ent.isFetching,
      refresh,
      apply,
    }),
    [ent.data, ent.isFetching, matrix.data, config.data, refresh, apply],
  );

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
}

export function useEntitlementsContext(): ContextValue {
  const ctx = useContext(EntitlementsContext);
  if (!ctx) throw new Error('Use dentro de <EntitlementsProvider>');
  return ctx;
}
