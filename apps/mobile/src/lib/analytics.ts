import PostHog from 'posthog-react-native';
import { env } from './env';

/**
 * Eventos de produto. REGRAS DE PRIVACIDADE: nunca envie valores monetários, descrições,
 * nomes de categorias/contas, e-mail ou qualquer texto digitado pelo usuário.
 */
export type AnalyticsEvent =
  | 'app_open'
  | 'onboarding_completed'
  | 'login_completed'
  | 'paywall_viewed'
  | 'purchase_started'
  | 'purchase_completed'
  | 'purchase_restored'
  | 'transaction_created'
  | 'budget_saved'
  | 'goal_created'
  | 'bill_created'
  | 'reminder_created'
  | 'export_pdf'
  | 'export_csv'
  | 'limit_reached'
  | 'feature_locked_tapped';

export type AnalyticsProps = Record<string, string | number | boolean | null>;

export interface AnalyticsProvider {
  identify(userId: string): void;
  track(event: AnalyticsEvent, props?: AnalyticsProps): void;
  reset(): void;
}

const noop: AnalyticsProvider = {
  identify: () => undefined,
  track: () => undefined,
  reset: () => undefined,
};

/** Propriedades proibidas são descartadas mesmo que alguém as passe por engano. */
const FORBIDDEN = /amount|cents|valor|description|descricao|email|name|nome|note/i;

export function sanitize(props: AnalyticsProps = {}): AnalyticsProps {
  return Object.fromEntries(Object.entries(props).filter(([k]) => !FORBIDDEN.test(k)));
}

function createPostHog(): AnalyticsProvider {
  if (!env.posthogKey) return noop;
  const ph = new PostHog(env.posthogKey, {
    host: env.posthogHost,
    captureAppLifecycleEvents: true,
  });
  return {
    identify: (id) => ph.identify(id),
    track: (event, props) => ph.capture(event, props ?? {}),
    reset: () => ph.reset(),
  };
}

let provider: AnalyticsProvider | null = null;
const get = () => (provider ??= createPostHog());

export const analytics = {
  /** Identifica pelo id do Supabase (UUID), nunca por e-mail. */
  identify: (userId: string) => get().identify(userId),
  track: (event: AnalyticsEvent, props?: AnalyticsProps) => get().track(event, sanitize(props)),
  reset: () => get().reset(),
  /** Para testes. */
  setProvider: (p: AnalyticsProvider) => {
    provider = p;
  },
};
