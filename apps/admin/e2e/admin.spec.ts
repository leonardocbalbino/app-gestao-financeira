import { expect, test, type Page } from '@playwright/test';
import { ADMIN, CUSTOMER } from './fixtures';

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test('rotas exigem login', async ({ page }) => {
  await page.goto('/matrix');
  await expect(page).toHaveURL(/\/login/);
});

test('cliente comum não entra no painel', async ({ page }) => {
  await login(page, CUSTOMER.email, CUSTOMER.password);
  await expect(page.getByText('Esta conta não tem acesso ao painel.')).toBeVisible();
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
});

test('owner: dashboard, matriz com diff e publicação, concessão de Pro', async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Assinantes Pro ativos')).toBeVisible();

  // Matriz: muda limite de orçamentos do Free para 4 → aparece no diff → publica
  await page.getByRole('link', { name: 'Funcionalidades' }).click();
  const cell = page.getByLabel('Orçamentos no plano Free (vazio = ilimitado)');
  await cell.fill('4');
  await cell.blur();
  await expect(page.getByText('Free · Orçamentos: 3 → 4')).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Publicar' }).click();
  await expect(page.getByText(/Publicado: 1 mudança/)).toBeVisible();
  await expect(page.getByText('O rascunho é igual ao que está publicado.')).toBeVisible();

  // Volta ao valor original para não afetar outros testes
  await cell.fill('3');
  await cell.blur();
  await expect(page.getByText('Free · Orçamentos: 4 → 3')).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Publicar' }).click();
  await expect(page.getByText('O rascunho é igual ao que está publicado.')).toBeVisible();

  // Usuários: busca o cliente e concede Pro por 7 dias
  await page.getByRole('link', { name: 'Usuários' }).click();
  await page.getByLabel('Buscar usuários').fill(CUSTOMER.email);
  await page.getByRole('button', { name: 'Buscar' }).click();
  await page.getByRole('link', { name: CUSTOMER.email }).click();
  await page.getByLabel('Duração (dias, 0 = sem prazo)').fill('7');
  await page.getByLabel('Motivo').first().fill('Teste E2E');
  await page.getByRole('button', { name: 'Conceder plano' }).click();
  await expect(page.getByText('Concedido por 7 dias')).toBeVisible();
  await expect(page.getByText('via manual_grant')).toBeVisible();

  // Auditoria registra a concessão
  await page.getByRole('link', { name: 'Auditoria' }).click();
  await expect(page.getByRole('cell', { name: /manual_grants/ }).first()).toBeVisible();
});

test('lembretes e envios: status dos canais e teste de e-mail', async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.getByRole('link', { name: 'Lembretes e envios' }).click();
  await expect(page.getByRole('heading', { name: 'Lembretes e envios' })).toBeVisible();
  await expect(page.getByText('WhatsApp', { exact: true }).first()).toBeVisible();
  await page.getByLabel('Destino').fill('teste-canal@exemplo.dev');
  await page.getByRole('button', { name: 'Enviar teste' }).click();
  await expect(page.getByText('Enviado via smtp')).toBeVisible();
});
