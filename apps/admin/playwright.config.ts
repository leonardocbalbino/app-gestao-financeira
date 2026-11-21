import { defineConfig, devices } from '@playwright/test';

/**
 * E2E do painel contra o Supabase LOCAL (npx supabase start).
 * Requer .env.local com NEXT_PUBLIC_SUPABASE_URL/ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no ambiente
 * (usada só pelo setup para criar usuários de teste).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://127.0.0.1:3001',
    trace: 'retain-on-failure',
    locale: 'pt-BR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm start',
    url: 'http://127.0.0.1:3001/login',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
