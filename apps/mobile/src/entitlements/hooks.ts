import { useQuery } from '@tanstack/react-query';
import {
  computeLimitState,
  getLimit,
  hasFeature,
  type BooleanFeatureKey,
  type Entitlements,
  type LimitFeatureKey,
  type LimitState,
} from '@app/shared';
import { useDb } from '@/data/DatabaseProvider';
import { useEntitlementsContext } from './EntitlementsProvider';
import { countUsage } from './usage';

export function useEntitlements(): Entitlements {
  return useEntitlementsContext().entitlements;
}

/** true se a feature booleana estiver liberada para o usuário. */
export function useFeature(key: BooleanFeatureKey): boolean {
  return hasFeature(useEntitlements(), key);
}

/** { limit, used, remaining, reached, overBy } — `used` vem do banco local. */
export function useLimit(key: LimitFeatureKey): LimitState {
  const db = useDb();
  const limit = getLimit(useEntitlements(), key);
  const used = useQuery({
    queryKey: ['db', 'usage', key],
    queryFn: () => countUsage(db, key),
  });
  return computeLimitState(limit, used.data ?? 0);
}

/**
 * Itens além do limite ficam somente-leitura (nunca são apagados).
 * Retorna true se o item na posição `index` (ordem de criação) excede o limite.
 */
export function isOverLimit(state: LimitState, index: number): boolean {
  return state.limit !== null && index >= state.limit;
}
