import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { entitlementsFromPlan } from '@app/shared';
import { supabase } from '@/lib/supabase';
import { billing, setBillingService } from '@/billing';
import { createRevenueCatBilling } from '@/billing/revenueCatBilling';
import { env } from '@/lib/env';
import { useEntitlementsContext } from '@/entitlements';
import { analytics } from '@/lib/analytics';
import { setMonitoringUser } from '@/lib/monitoring';

export interface AuthUser {
  id: string;
  email: string | null;
  isAnonymous: boolean;
  provider: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** false até a sessão inicial ser lida do armazenamento. */
  ready: boolean;
  /** Supabase configurado? Sem ele o app funciona 100% local. */
  online: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, ready: true, online: false });

function toUser(s: Session | null): AuthUser | null {
  if (!s) return null;
  return {
    id: s.user.id,
    email: s.user.email ?? null,
    isAnonymous: !!s.user.is_anonymous,
    provider: (s.user.app_metadata?.provider as string | undefined) ?? null,
  };
}

// RevenueCat só quando há chave para a plataforma (senão fica o noop).
if (env.revenueCatIosKey || env.revenueCatAndroidKey) setBillingService(createRevenueCatBilling());

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [billingReady, setBillingReady] = useState(false);
  const { refresh, apply, matrix } = useEntitlementsContext();

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(toUser(data.session));
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(toUser(session));
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Vincula compras ao usuário do Supabase e recarrega entitlements quando o usuário muda.
  const userId = user?.id ?? null;
  useEffect(() => {
    if (userId) analytics.identify(userId);
    setMonitoringUser(userId);
    void billing()
      .configure(userId)
      .catch(() => undefined)
      .then(() => {
        setBillingReady(billing().isAvailable());
        return refresh();
      });
  }, [userId, refresh]);

  // Compra/renovação na loja: libera o plano na hora (otimista) e confirma no servidor.
  useEffect(() => {
    if (!billingReady) return;
    return billing().onCustomerInfoChange((hasPro) => {
      const pro = matrix.plans.find((p) => p.rc_entitlement === 'pro');
      if (hasPro && pro) apply(entitlementsFromPlan(matrix, pro.id, 'subscription'));
      setTimeout(() => void refresh(), 3_000);
    });
  }, [apply, refresh, matrix, billingReady]);

  const value = useMemo(() => ({ user, ready, online: !!supabase }), [user, ready]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
