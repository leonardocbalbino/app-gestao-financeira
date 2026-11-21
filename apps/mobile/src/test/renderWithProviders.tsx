import type { ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { DatabaseProvider } from '@/data/DatabaseProvider';
import type { AppDB } from '@/data/db';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

export function renderWithProviders(ui: ReactElement, db: AppDB) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={qc}>
        <DatabaseProvider db={db}>
          <ThemeProvider>{ui}</ThemeProvider>
        </DatabaseProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}
