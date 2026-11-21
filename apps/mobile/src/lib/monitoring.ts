import * as Sentry from '@sentry/react-native';
import { env } from './env';

let started = false;

/** Inicia o Sentry somente se houver DSN. Sem PII, sem replays, amostragem baixa de performance. */
export function initMonitoring(): void {
  if (started || !env.sentryDsn) return;
  started = true;
  Sentry.init({
    dsn: env.sentryDsn,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    environment: __DEV__ ? 'development' : 'production',
    beforeBreadcrumb: (b) => (b.category === 'console' ? null : b),
  });
}

export function setMonitoringUser(id: string | null): void {
  if (!started) return;
  Sentry.setUser(id ? { id } : null);
}

export function captureError(e: unknown, context?: Record<string, string>): void {
  if (!started) return;
  Sentry.captureException(e, context ? { tags: context } : undefined);
}
