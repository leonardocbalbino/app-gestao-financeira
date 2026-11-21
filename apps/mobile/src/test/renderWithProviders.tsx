import type { ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { DatabaseProvider } from '@/data/DatabaseProvider';
import type { AppDB } from '@/data/db';
import { EntitlementsProvider } from '@/entitlements';
import { fallbackEntitlements, type Entitlements } from '@app/shared';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

export function renderWithProviders(
  ui: ReactElement,
  db: AppDB,
  opts: { entitlements?: Entitlements } = {},
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={qc}>
        <DatabaseProvider db={db}>
          <EntitlementsProvider initial={opts.entitlements ?? fallbackEntitlements()}>
            <ThemeProvider>{ui}</ThemeProvider>
          </EntitlementsProvider>
        </DatabaseProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

/** Entitlements Pro para testes (todos os booleanos liberados, sem limites, sem anúncios). */
export function proEntitlements(): Entitlements {
  const base = fallbackEntitlements();
  const features = { ...base.features };
  for (const k of Object.keys(features) as (keyof typeof features)[]) {
    const v = features[k];
    features[k] = k === 'ads.show' ? false : typeof v === 'boolean' ? true : null;
  }
  return { ...base, planId: 'pro', planName: 'Pro', source: 'subscription', features };
}
