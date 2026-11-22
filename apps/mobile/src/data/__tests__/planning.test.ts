/**
 * @jest-environment node
 */
import type { AppDB } from '../db';
import { listAccounts } from '../repositories/accounts';
import { listCategories } from '../repositories/categories';
import { createTransaction, listTransactions } from '../repositories/transactions';
import { countBudgets, deleteBudget, listBudgets, upsertBudget } from '../repositories/budgets';
import { addToGoal, countGoals, createGoal, deleteGoal, listGoals } from '../repositories/goals';
import {
  billStatus,
  createBill,
  listOpenBills,
  listPaidBills,
  payBill,
} from '../repositories/bills';
import { createTestDb } from '@/test/testDb';

let db: AppDB;
let walletId: string;
let foodId: string;

beforeEach(async () => {
  db = await createTestDb();
  walletId = listAccounts(db)[0]!.id;
  foodId = listCategories(db).find((c) => c.slug === 'alimentacao')!.id;
});

const expense = (amountCents: number, date: string) =>
  createTransaction(db, {
    kind: 'expense',
    amountCents,
    description: '',
    categoryId: foodId,
    accountId: walletId,
    toAccountId: null,
    date,
    notes: null,
    recurrence: 'none',
  });

describe('orçamentos', () => {
  it('calcula gasto do mês e razão; vale a partir do mês inicial', () => {
    upsertBudget(db, { categoryId: foodId, limitCents: 100000, startMonth: '2026-11' });
    expense(85000, '2026-11-02');
    expense(5000, '2026-10-02');
    const [b] = listBudgets(db, '2026-11');
    expect(b).toMatchObject({ categoryName: 'Alimentação', spentCents: 85000, ratio: 0.85 });
    expect(listBudgets(db, '2026-10')).toHaveLength(0);
    expect(listBudgets(db, '2026-12')[0]?.spentCents).toBe(0);
  });

  it('um orçamento por categoria (upsert) e exclusão', () => {
    const a = upsertBudget(db, { categoryId: foodId, limitCents: 1000, startMonth: '2026-11' });
    upsertBudget(db, { categoryId: foodId, limitCents: 2000, startMonth: '2026-11' });
    expect(countBudgets(db)).toBe(1);
    expect(listBudgets(db, '2026-11')[0]?.limitCents).toBe(2000);
    deleteBudget(db, a.id);
    expect(countBudgets(db)).toBe(0);
  });
});

describe('metas', () => {
  it('guarda e retira sem ficar negativo', () => {
    const g = createGoal(db, {
      name: 'Viagem',
      targetCents: 500000,
      deadline: null,
      icon: 'target',
      color: '#0B6E4F',
    });
    addToGoal(db, g.id, 120000);
    addToGoal(db, g.id, -20000);
    expect(listGoals(db)[0]?.savedCents).toBe(100000);
    addToGoal(db, g.id, -999999);
    expect(listGoals(db)[0]?.savedCents).toBe(0);
    expect(countGoals(db)).toBe(1);
    deleteGoal(db, g.id);
    expect(countGoals(db)).toBe(0);
  });
});

describe('contas a pagar', () => {
  it('status por vencimento', () => {
    const today = '2026-11-21';
    expect(billStatus({ dueDate: '2026-11-20', paidAt: null }, today)).toBe('overdue');
    expect(billStatus({ dueDate: '2026-11-24', paidAt: null }, today)).toBe('due_soon');
    expect(billStatus({ dueDate: '2026-12-10', paidAt: null }, today)).toBe('upcoming');
    expect(billStatus({ dueDate: '2026-11-10', paidAt: 'x' }, today)).toBe('paid');
  });

  it('pagar recorrente lança despesa e cria a próxima ocorrência', () => {
    const bill = createBill(db, {
      name: 'Aluguel',
      amountCents: 150000,
      dueDate: '2026-01-31',
      categoryId: foodId,
      recurrence: 'monthly',
      remindDaysBefore: 2,
    });
    const res = payBill(db, bill.id, { accountId: walletId, paidDate: '2026-01-30' });
    expect(res?.next?.dueDate).toBe('2026-02-28');
    expect(listOpenBills(db, '2026-02-01')).toEqual([
      expect.objectContaining({ name: 'Aluguel', status: 'upcoming', daysUntilDue: 27 }),
    ]);
    expect(listPaidBills(db)).toHaveLength(1);
    expect(listTransactions(db)[0]).toMatchObject({ description: 'Aluguel', amountCents: 150000 });
    expect(payBill(db, bill.id)).toBeNull();
  });
});

describe('contas a pagar: dia âncora', () => {
  it('mensal no dia 31 volta ao 31 depois de fevereiro', () => {
    const bill = createBill(db, {
      name: 'Cartão',
      amountCents: 10000,
      dueDate: '2026-01-31',
      categoryId: null,
      recurrence: 'monthly',
      remindDaysBefore: 1,
    });
    const feb = payBill(db, bill.id)!.next!;
    expect(feb.dueDate).toBe('2026-02-28');
    const mar = payBill(db, feb.id)!.next!;
    expect(mar.dueDate).toBe('2026-03-31');
  });
});
