import { defineConfig, devices } from '@playwright/test';

/**
 * E2E do painel contra a API + Postgres locais.
 * Requer a API rodando (API_URL, padrão http://127.0.0.1:56080) e o Postgres do docker compose
 * (o setup cria os usuários de teste direto no banco local).
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
