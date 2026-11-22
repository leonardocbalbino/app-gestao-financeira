import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { entitlementsFromPlan } from '@app/shared';
import { api, isApiConfigured, onSessionChange, restoreSession, type SessionUser } from '@/lib/api';
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
  /** API configurada? Sem ela o app funciona 100% local. */
  online: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, ready: true, online: false });

interface MeResponse {
  email: string | null;
  is_anonymous: boolean;
  has_apple: boolean;
  has_google: boolean;
}

const toUser = (s: SessionUser | null): AuthUser | null =>
  s ? { id: s.id, email: null, isAnonymous: s.isAnonymous, provider: null } : null;

// RevenueCat só quando há chave para a plataforma (senão fica o noop).
if (env.revenueCatIosKey || env.revenueCatAndroidKey) setBillingService(createRevenueCatBilling());

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(!isApiConfigured());
  const [billingReady, setBillingReady] = useState(false);
  const { refresh, apply, matrix } = useEntitlementsContext();

  useEffect(() => {
    if (!isApiConfigured()) return;
    let mounted = true;
    const off = onSessionChange((s) => mounted && setUser(toUser(s)));
    void restoreSession().then(() => mounted && setReady(true));
    return () => {
      mounted = false;
      off();
    };
  }, []);

  // Detalhes do perfil (e-mail e provedores) para a tela de Configurações.
  const sessionId = user?.id ?? null;
  const sessionAnon = user?.isAnonymous ?? true;
  useEffect(() => {
    if (!sessionId) return;
    let alive = true;
    api<MeResponse>('GET', '/me')
      .then((me) => {
        if (!alive) return;
        const provider = me.has_apple
          ? 'Apple'
          : me.has_google
            ? 'Google'
            : me.email
              ? 'e-mail'
              : null;
        setUser((u) =>
          u && u.id === sessionId
            ? { ...u, email: me.email, isAnonymous: me.is_anonymous, provider }
            : u,
        );
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [sessionId, sessionAnon]);

  // Vincula compras ao usuário da API e recarrega entitlements quando o usuário muda.
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

  const value = useMemo(() => ({ user, ready, online: isApiConfigured() }), [user, ready]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
