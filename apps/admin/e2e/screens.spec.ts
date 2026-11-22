import { test } from '@playwright/test';
import { ADMIN } from './fixtures';

test.skip(!process.env.SCREENSHOT_DIR, 'apenas sob demanda');

test('capturas', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(ADMIN.email);
  await page.getByLabel('Senha').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
  await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/dashboard.png`, fullPage: true });
  await page.goto('/matrix');
  await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/matrix.png`, fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/deliveries');
  await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/deliveries.png`, fullPage: true });
  await page.goto('/users');
  await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/users-dark.png` });
});
