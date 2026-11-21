/**
 * @jest-environment node
 */
import type { TransactionForm } from '@app/shared';
import type { AppDB } from '../db';
import { getUserVersion, migrate, MIGRATIONS } from '../migrations';
import { seedDefaults } from '../seed';
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  monthSummary,
  monthlyTotals,
  spendingByCategory,
  updateTransaction,
} from '../repositories/transactions';
import {
  countActiveAccounts,
  createAccount,
  deleteAccount,
  listAccounts,
  totalBalance,
} from '../repositories/accounts';
import {
  countCustomCategories,
  createCategory,
  deleteCategory,
  listCategories,
} from '../repositories/categories';
import { createTestDb } from '@/test/testDb';

let db: AppDB;
let walletId: string;
let foodId: string;
let incomeCatId: string;

function tx(partial: Partial<TransactionForm>): TransactionForm {
  return {
    kind: 'expense',
    amountCents: 1000,
    description: '',
    categoryId: foodId,
    accountId: walletId,
    toAccountId: null,
    date: '2026-11-10',
    notes: null,
    recurrence: 'none',
    ...partial,
  };
}

beforeEach(async () => {
  db = await createTestDb();
  walletId = listAccounts(db)[0]!.id;
  const cats = listCategories(db);
  foodId = cats.find((c) => c.slug === 'alimentacao')!.id;
  incomeCatId = cats.find((c) => c.slug === 'receita')!.id;
});

describe('migrations e seed', () => {
  it('aplica todas as migrations e é idempotente', () => {
    expect(getUserVersion(db)).toBe(MIGRATIONS.length);
    expect(migrate(db)).toBe(MIGRATIONS.length);
  });

  it('semeia 10 categorias padrão e uma conta, sem duplicar', () => {
    seedDefaults(db);
    expect(listCategories(db)).toHaveLength(10);
    expect(listCategories(db, 'income').map((c) => c.name)).toEqual(['Receita']);
    expect(countActiveAccounts(db)).toBe(1);
  });
});

describe('transações', () => {
  it('cria, lista em ordem de data e junta categoria/conta', () => {
    createTransaction(db, tx({ description: 'Mercado', date: '2026-11-05' }));
    createTransaction(db, tx({ description: 'Padaria', date: '2026-11-20', amountCents: 850 }));
    const items = listTransactions(db, { month: '2026-11' });
    expect(items.map((i) => i.description)).toEqual(['Padaria', 'Mercado']);
    expect(items[0]?.categoryName).toBe('Alimentação');
    expect(items[0]?.accountName).toBe('Carteira');
  });

  it('filtra por mês, tipo e busca (case-insensitive, inclui categoria)', () => {
    createTransaction(db, tx({ description: 'Mercado Extra', date: '2026-11-05' }));
    createTransaction(
      db,
      tx({ description: 'Salário', kind: 'income', categoryId: incomeCatId, amountCents: 500000 }),
    );
    createTransaction(db, tx({ description: 'Mercado', date: '2026-10-30' }));
    expect(listTransactions(db, { month: '2026-11' })).toHaveLength(2);
    expect(listTransactions(db, { kind: 'income' })).toHaveLength(1);
    expect(listTransactions(db, { search: 'mercado' })).toHaveLength(2);
    expect(listTransactions(db, { search: 'aliment' })).toHaveLength(2);
    expect(listTransactions(db, { search: '100%' })).toHaveLength(0);
  });

  it('edita e exclui (tombstone)', () => {
    const t = createTransaction(db, tx({ description: 'Café' }));
    updateTransaction(db, t.id, tx({ description: 'Café da manhã', amountCents: 1500 }));
    expect(listTransactions(db)[0]).toMatchObject({
      description: 'Café da manhã',
      amountCents: 1500,
    });
    deleteTransaction(db, t.id);
    expect(listTransactions(db)).toHaveLength(0);
  });

  it('resumo mensal ignora transferências e excluídas', () => {
    const second = createAccount(db, {
      name: 'Banco',
      type: 'checking',
      initialBalanceCents: 0,
      color: '#000000',
      icon: 'wallet',
    });
    createTransaction(db, tx({ kind: 'income', categoryId: incomeCatId, amountCents: 500000 }));
    createTransaction(db, tx({ amountCents: 12345 }));
    createTransaction(
      db,
      tx({ kind: 'transfer', categoryId: null, toAccountId: second.id, amountCents: 1000 }),
    );
    const gone = createTransaction(db, tx({ amountCents: 99999 }));
    deleteTransaction(db, gone.id);
    expect(monthSummary(db, '2026-11')).toEqual({
      incomeCents: 500000,
      expenseCents: 12345,
      netCents: 487655,
      count: 3,
    });
  });

  it('gastos por categoria e totais mensais com meses vazios', () => {
    createTransaction(db, tx({ amountCents: 3000 }));
    createTransaction(db, tx({ amountCents: 2000 }));
    createTransaction(db, tx({ amountCents: 4000, date: '2026-09-01' }));
    const byCat = spendingByCategory(db, '2026-11');
    expect(byCat).toEqual([expect.objectContaining({ name: 'Alimentação', totalCents: 5000 })]);
    expect(monthlyTotals(db, '2026-09', '2026-11')).toEqual([
      { month: '2026-09', incomeCents: 0, expenseCents: 4000 },
      { month: '2026-10', incomeCents: 0, expenseCents: 0 },
      { month: '2026-11', incomeCents: 0, expenseCents: 5000 },
    ]);
  });
});

describe('contas', () => {
  it('calcula saldo com receitas, despesas e transferências', () => {
    const bank = createAccount(db, {
      name: 'Banco',
      type: 'checking',
      initialBalanceCents: 100000,
      color: '#000000',
      icon: 'wallet',
    });
    createTransaction(
      db,
      tx({ kind: 'income', categoryId: incomeCatId, amountCents: 20000, accountId: bank.id }),
    );
    createTransaction(db, tx({ amountCents: 5000, accountId: bank.id }));
    createTransaction(
      db,
      tx({
        kind: 'transfer',
        categoryId: null,
        accountId: bank.id,
        toAccountId: walletId,
        amountCents: 3000,
      }),
    );
    const balances = Object.fromEntries(listAccounts(db).map((a) => [a.name, a.balanceCents]));
    expect(balances).toEqual({ Carteira: 3000, Banco: 112000 });
    expect(totalBalance(db)).toBe(115000);
  });

  it('arquiva conta com transações em vez de excluir', () => {
    createTransaction(db, tx({}));
    expect(deleteAccount(db, walletId)).toBe('archived');
    expect(listAccounts(db)).toHaveLength(0);
    expect(listAccounts(db, { includeArchived: true })).toHaveLength(1);
  });
});

describe('categorias', () => {
  it('cria personalizada e, ao excluir, move transações para Outros', () => {
    const pet = createCategory(db, {
      name: 'Pet',
      kind: 'expense',
      icon: 'heart-pulse',
      color: '#C2410C',
    });
    expect(countCustomCategories(db)).toBe(1);
    createTransaction(db, tx({ categoryId: pet.id }));
    deleteCategory(db, pet.id);
    expect(listTransactions(db)[0]?.categoryName).toBe('Outros');
    expect(countCustomCategories(db)).toBe(0);
  });
});
