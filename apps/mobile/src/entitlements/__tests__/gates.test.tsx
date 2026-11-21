import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { createTestDb } from '@/test/testDb';
import { proEntitlements, renderWithProviders } from '@/test/renderWithProviders';
import type { AppDB } from '@/data/db';
import { upsertBudget } from '@/data/repositories/budgets';
import { listCategories } from '@/data/repositories/categories';
import { FeatureGate, LimitedAddButton } from '../gates';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (a: unknown) => mockPush(a), back: jest.fn() },
}));

let db: AppDB;
beforeEach(async () => {
  db = await createTestDb();
  mockPush.mockClear();
});

describe('FeatureGate', () => {
  it('Free vê o cartão de upgrade e abre o paywall com a origem', async () => {
    await renderWithProviders(
      <FeatureGate feature="export.pdf">
        <Text>Exportar</Text>
      </FeatureGate>,
      db,
    );
    expect(screen.queryByText('Exportar')).toBeNull();
    await fireEvent.press(screen.getByTestId('upgrade-cta-export.pdf'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/paywall',
      params: { source: 'export.pdf' },
    });
  });

  it('Pro vê o conteúdo', async () => {
    await renderWithProviders(
      <FeatureGate feature="export.pdf">
        <Text>Exportar</Text>
      </FeatureGate>,
      db,
      { entitlements: proEntitlements() },
    );
    expect(screen.getByText('Exportar')).toBeTruthy();
  });
});

describe('LimitedAddButton', () => {
  const fill = (n: number) => {
    const cats = listCategories(db, 'expense');
    for (let i = 0; i < n; i++) {
      upsertBudget(db, { categoryId: cats[i]!.id, limitCents: 1000, startMonth: '2026-11' });
    }
  };

  it('libera abaixo do limite', async () => {
    fill(2);
    const onPress = jest.fn();
    await renderWithProviders(
      <LimitedAddButton feature="budgets.max" label="Adicionar" onPress={onPress} testID="add" />,
      db,
    );
    await fireEvent.press(await screen.findByTestId('add'));
    expect(onPress).toHaveBeenCalled();
  });

  it('no limite (Free = 3) vira CTA do paywall', async () => {
    fill(3);
    const onPress = jest.fn();
    await renderWithProviders(
      <LimitedAddButton feature="budgets.max" label="Adicionar" onPress={onPress} testID="add" />,
      db,
    );
    await fireEvent.press(await screen.findByTestId('add-locked'));
    expect(onPress).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/paywall',
      params: { source: 'budgets.max' },
    });
    expect(screen.getByText('Você usa 3 de 3 no seu plano.')).toBeTruthy();
  });

  it('Pro é ilimitado', async () => {
    fill(5);
    await renderWithProviders(
      <LimitedAddButton feature="budgets.max" label="Adicionar" onPress={jest.fn()} testID="add" />,
      db,
      { entitlements: proEntitlements() },
    );
    expect(await screen.findByTestId('add')).toBeTruthy();
  });
});
