import type { TransactionListItem } from '@/data/repositories/transactions';

export type DayRow =
  | { type: 'header'; key: string; date: string; totalCents: number }
  | { type: 'tx'; key: string; item: TransactionListItem; last: boolean };

/** Agrupa por dia, com total líquido do dia no cabeçalho. */
export function groupByDay(items: TransactionListItem[]): DayRow[] {
  const rows: DayRow[] = [];
  let i = 0;
  while (i < items.length) {
    const date = items[i]!.date;
    const day: TransactionListItem[] = [];
    while (i < items.length && items[i]!.date === date) day.push(items[i++]!);
    const total = day.reduce(
      (s, x) =>
        s + (x.kind === 'income' ? x.amountCents : x.kind === 'expense' ? -x.amountCents : 0),
      0,
    );
    rows.push({ type: 'header', key: `h-${date}`, date, totalCents: total });
    day.forEach((item, idx) =>
      rows.push({ type: 'tx', key: item.id, item, last: idx === day.length - 1 }),
    );
  }
  return rows;
}
