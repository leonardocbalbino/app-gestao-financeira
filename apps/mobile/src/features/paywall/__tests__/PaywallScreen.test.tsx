import { screen } from '@testing-library/react-native';
import { createTestDb } from '@/test/testDb';
import { renderWithProviders } from '@/test/renderWithProviders';
import { PaywallScreen } from '../PaywallScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

describe('PaywallScreen', () => {
  it('monta a tabela a partir da matriz e contextualiza pela origem', async () => {
    const db = await createTestDb();
    await renderWithProviders(<PaywallScreen source="export.pdf" />, db);
    expect(await screen.findByText('Desbloqueie: Exportar PDF')).toBeTruthy();
    expect(screen.getByText('Relatório em PDF')).toBeTruthy();
    expect(screen.getByText('Sem anúncios')).toBeTruthy();
    // limites: Free mostra número, Pro "Ilimitado"
    expect(screen.getAllByText('Ilimitado').length).toBeGreaterThan(0);
    // sem loja disponível, o botão de assinar fica desabilitado com aviso
    expect(
      screen.getByText('As compras ficam disponíveis no app instalado pela loja.'),
    ).toBeTruthy();
  });
});
