/**
 * @jest-environment node
 */
import { createTestDb } from '@/test/testDb';
import { resetLocalData } from '../reset';
import { listAccounts, createAccount } from '../repositories/accounts';
import { listCategories } from '../repositories/categories';
import { createTransaction, listTransactions } from '../repositories/transactions';

it('resetLocalData apaga tudo e recria os padrões', async () => {
  const db = await createTestDb();
  createAccount(db, {
    name: 'Banco',
    type: 'checking',
    initialBalanceCents: 0,
    color: '#000000',
    icon: 'wallet',
  });
  createTransaction(db, {
    kind: 'expense',
    amountCents: 100,
    description: 'x',
    categoryId: listCategories(db)[0]!.id,
    accountId: listAccounts(db)[0]!.id,
    toAccountId: null,
    date: '2026-11-21',
    notes: null,
    recurrence: 'none',
  });
  resetLocalData(db);
  expect(listTransactions(db)).toHaveLength(0);
  expect(listAccounts(db).map((a) => a.name)).toEqual(['Carteira']);
  expect(listCategories(db)).toHaveLength(10);
});
