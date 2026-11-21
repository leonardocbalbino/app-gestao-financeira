import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { createTestDb } from '@/test/testDb';
import { renderWithProviders } from '@/test/renderWithProviders';
import { listTransactions } from '@/data/repositories/transactions';
import type { AppDB } from '@/data/db';
import { TransactionFormScreen } from '../TransactionFormScreen';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ router: { back: () => mockBack(), push: jest.fn() } }));

let db: AppDB;
beforeEach(async () => {
  db = await createTestDb();
  mockBack.mockClear();
});

describe('TransactionFormScreen', () => {
  it('valida valor e categoria antes de salvar', async () => {
    await renderWithProviders(<TransactionFormScreen />, db);
    await fireEvent.press(await screen.findByTestId('tx-save'));
    expect(await screen.findByText('Informe um valor maior que zero')).toBeTruthy();
    expect(listTransactions(db)).toHaveLength(0);
  });

  it('cria uma despesa com valor digitado pela direita', async () => {
    await renderWithProviders(<TransactionFormScreen />, db);
    await fireEvent.changeText(await screen.findByTestId('amount-input'), '4590');
    expect(screen.getByText('R$ 45,90')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('tx-description'), 'Mercado');
    await fireEvent.press(await screen.findByTestId('cat-alimentacao'));
    await fireEvent.press(screen.getByTestId('tx-save'));

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    const [tx] = listTransactions(db);
    expect(tx).toMatchObject({ kind: 'expense', amountCents: 4590, description: 'Mercado' });
    expect(tx?.categoryName).toBe('Alimentação');
  });
});
