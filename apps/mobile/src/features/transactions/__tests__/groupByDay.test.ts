import type { TransactionListItem } from '@/data/repositories/transactions';
import { groupByDay } from '../groupByDay';

const item = (
  id: string,
  date: string,
  kind: 'expense' | 'income' | 'transfer',
  amountCents: number,
) => ({ id, date, kind, amountCents }) as TransactionListItem;

describe('groupByDay', () => {
  it('agrupa em ordem e soma o líquido do dia (ignora transferências)', () => {
    const rows = groupByDay([
      item('a', '2026-11-21', 'expense', 1000),
      item('b', '2026-11-21', 'income', 5000),
      item('c', '2026-11-21', 'transfer', 9999),
      item('d', '2026-11-20', 'expense', 300),
    ]);
    expect(rows.map((r) => r.type)).toEqual(['header', 'tx', 'tx', 'tx', 'header', 'tx']);
    expect(rows[0]).toMatchObject({ date: '2026-11-21', totalCents: 4000 });
    expect(rows[4]).toMatchObject({ date: '2026-11-20', totalCents: -300 });
    expect(rows[3]).toMatchObject({ last: true });
  });

  it('lista vazia', () => {
    expect(groupByDay([])).toEqual([]);
  });
});
