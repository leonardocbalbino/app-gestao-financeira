import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useDb } from '@/data/DatabaseProvider';
import { dbKeys } from '@/data/hooks';
import { materializeRecurring } from '@/data/repositories/recurring';
import { useFeature } from '@/entitlements';
import { ensureAnonymousSession } from '@/auth/authService';
import { usePrefs } from '@/state/prefs';

/** Efeitos globais do app (sem UI): recorrências agora; sync/ads/auth nas próximas fases. */
export function AppEffects() {
  const db = useDb();
  const qc = useQueryClient();
  const recurring = useFeature('transactions.recurring');
  const onboardingDone = usePrefs((s) => s.onboardingDone);

  // Garante uma sessão (anônima) para vincular compras e entitlements; offline não bloqueia.
  useEffect(() => {
    if (onboardingDone) void ensureAnonymousSession().catch(() => undefined);
  }, [onboardingDone]);

  useEffect(() => {
    if (!recurring) return;
    const run = () => {
      if (materializeRecurring(db) > 0) void qc.invalidateQueries({ queryKey: dbKeys.all });
    };
    run();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
    return () => sub.remove();
  }, [db, qc, recurring]);

  return null;
}
