/**
 * @jest-environment node
 */
import type { AppDB } from '../db';
import { listAccounts } from '../repositories/accounts';
import { listCategories } from '../repositories/categories';
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
} from '../repositories/transactions';
import { materializeRecurring } from '../repositories/recurring';
import { createTestDb } from '@/test/testDb';

let db: AppDB;
beforeEach(async () => {
  db = await createTestDb();
});

const make = (date: string, recurrence: 'monthly' | 'weekly' | 'none') =>
  createTransaction(db, {
    kind: 'expense',
    amountCents: 3990,
    description: 'Streaming',
    categoryId: listCategories(db)[0]!.id,
    accountId: listAccounts(db)[0]!.id,
    toAccountId: null,
    date,
    notes: null,
    recurrence,
  });

describe('materializeRecurring', () => {
  it('gera ocorrências mensais até hoje e é idempotente', () => {
    make('2026-08-31', 'monthly');
    expect(materializeRecurring(db, '2026-11-21')).toBe(2); // 30 set, 31 out (30 nov ainda não)
    expect(listTransactions(db).map((t) => t.date)).toEqual([
      '2026-10-31',
      '2026-09-30',
      '2026-08-31',
    ]);
    expect(materializeRecurring(db, '2026-11-21')).toBe(0);
    expect(materializeRecurring(db, '2026-11-30')).toBe(1);
  });

  it('ignora não recorrentes e modelos excluídos', () => {
    make('2026-01-01', 'none');
    const tpl = make('2026-11-01', 'weekly');
    deleteTransaction(db, tpl.id);
    expect(materializeRecurring(db, '2026-11-21')).toBe(0);
  });
});
