import { and, desc, eq, gte, isNull, like, lte, or, sql, type SQL } from 'drizzle-orm';
import { monthRange, type ISODate, type MonthKey, type TransactionForm } from '@app/shared';
import { newId, nowISO } from '@/lib/id';
import type { AppDB } from '../db';
import { accounts, categories, transactions, type TransactionRow } from '../schema';

export interface TransactionFilter {
  month?: MonthKey;
  from?: ISODate;
  to?: ISODate;
  search?: string;
  kind?: 'expense' | 'income' | 'transfer';
  categoryId?: string;
  accountId?: string;
  limit?: number;
  offset?: number;
}

export interface TransactionListItem extends TransactionRow {
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  accountName: string | null;
}

function buildWhere(f: TransactionFilter): SQL | undefined {
  const conds: (SQL | undefined)[] = [isNull(transactions.deletedAt)];
  if (f.month) {
    const r = monthRange(f.month);
    conds.push(gte(transactions.date, r.start), lte(transactions.date, r.end));
  }
  if (f.from) conds.push(gte(transactions.date, f.from));
  if (f.to) conds.push(lte(transactions.date, f.to));
  if (f.kind) conds.push(eq(transactions.kind, f.kind));
  if (f.categoryId) conds.push(eq(transactions.categoryId, f.categoryId));
  if (f.accountId) {
    conds.push(
      or(eq(transactions.accountId, f.accountId), eq(transactions.toAccountId, f.accountId)),
    );
  }
  const q = f.search?.trim();
  if (q) {
    const pattern = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    conds.push(
      or(
        sql`${transactions.description} LIKE ${pattern} ESCAPE '\\' COLLATE NOCASE`,
        like(categories.name, pattern),
        sql`${transactions.notes} LIKE ${pattern} ESCAPE '\\' COLLATE NOCASE`,
      ),
    );
  }
  return and(...conds);
}

export function listTransactions(db: AppDB, f: TransactionFilter = {}): TransactionListItem[] {
  return db
    .select({
      id: transactions.id,
      createdAt: transactions.createdAt,
      updatedAt: transactions.updatedAt,
      deletedAt: transactions.deletedAt,
      dirty: transactions.dirty,
      kind: transactions.kind,
      amountCents: transactions.amountCents,
      description: transactions.description,
      categoryId: transactions.categoryId,
      accountId: transactions.accountId,
      toAccountId: transactions.toAccountId,
      date: transactions.date,
      notes: transactions.notes,
      recurrence: transactions.recurrence,
      recurrenceParentId: transactions.recurrenceParentId,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      accountName: accounts.name,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(buildWhere(f))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(f.limit ?? 500)
    .offset(f.offset ?? 0)
    .all();
}

export function getTransaction(db: AppDB, id: string): TransactionRow | undefined {
  return db.select().from(transactions).where(eq(transactions.id, id)).get();
}

function normalize(form: TransactionForm) {
  return {
    kind: form.kind,
    amountCents: Math.abs(Math.round(form.amountCents)),
    description: form.description.trim(),
    categoryId: form.kind === 'transfer' ? null : form.categoryId,
    accountId: form.accountId,
    toAccountId: form.kind === 'transfer' ? form.toAccountId : null,
    date: form.date,
    notes: form.notes?.trim() || null,
    recurrence: form.recurrence,
  };
}

export function createTransaction(db: AppDB, form: TransactionForm): TransactionRow {
  const now = nowISO();
  const row = {
    id: newId(),
    ...normalize(form),
    recurrenceParentId: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    dirty: true,
  };
  db.insert(transactions).values(row).run();
  return row;
}

export function updateTransaction(db: AppDB, id: string, form: TransactionForm): void {
  db.update(transactions)
    .set({ ...normalize(form), updatedAt: nowISO(), dirty: true })
    .where(eq(transactions.id, id))
    .run();
}

/** Exclusão lógica (tombstone) — necessária para propagar a exclusão no sync. */
export function deleteTransaction(db: AppDB, id: string): void {
  const now = nowISO();
  db.update(transactions)
    .set({ deletedAt: now, updatedAt: now, dirty: true })
    .where(eq(transactions.id, id))
    .run();
}

export interface PeriodSummary {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  count: number;
}

export function periodSummary(db: AppDB, from: ISODate, to: ISODate): PeriodSummary {
  const row = db
    .select({
      income: sql<number>`coalesce(sum(case when ${transactions.kind} = 'income' then ${transactions.amountCents} end), 0)`,
      expense: sql<number>`coalesce(sum(case when ${transactions.kind} = 'expense' then ${transactions.amountCents} end), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(transactions)
    .where(
      and(isNull(transactions.deletedAt), gte(transactions.date, from), lte(transactions.date, to)),
    )
    .get();
  const income = Number(row?.income ?? 0);
  const expense = Number(row?.expense ?? 0);
  return {
    incomeCents: income,
    expenseCents: expense,
    netCents: income - expense,
    count: Number(row?.count ?? 0),
  };
}

export function monthSummary(db: AppDB, month: MonthKey): PeriodSummary {
  const r = monthRange(month);
  return periodSummary(db, r.start, r.end);
}

export interface CategorySpending {
  categoryId: string | null;
  name: string;
  icon: string;
  color: string;
  totalCents: number;
}

export function spendingByCategory(
  db: AppDB,
  month: MonthKey,
  kind: 'expense' | 'income' = 'expense',
) {
  const r = monthRange(month);
  const rows = db
    .select({
      categoryId: transactions.categoryId,
      name: categories.name,
      icon: categories.icon,
      color: categories.color,
      total: sql<number>`sum(${transactions.amountCents})`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        isNull(transactions.deletedAt),
        eq(transactions.kind, kind),
        gte(transactions.date, r.start),
        lte(transactions.date, r.end),
      ),
    )
    .groupBy(transactions.categoryId)
    .orderBy(desc(sql`sum(${transactions.amountCents})`))
    .all();
  return rows.map<CategorySpending>((x) => ({
    categoryId: x.categoryId,
    name: x.name ?? 'Sem categoria',
    icon: x.icon ?? 'circle-ellipsis',
    color: x.color ?? '#A9B1AC',
    totalCents: Number(x.total),
  }));
}

export interface MonthTotals {
  month: MonthKey;
  incomeCents: number;
  expenseCents: number;
}

/** Totais por mês no intervalo [fromMonth, toMonth], preenchendo meses vazios com zero. */
export function monthlyTotals(db: AppDB, fromMonth: MonthKey, toMonth: MonthKey): MonthTotals[] {
  const start = monthRange(fromMonth).start;
  const end = monthRange(toMonth).end;
  const rows = db
    .select({
      month: sql<string>`substr(${transactions.date}, 1, 7)`,
      income: sql<number>`coalesce(sum(case when ${transactions.kind} = 'income' then ${transactions.amountCents} end), 0)`,
      expense: sql<number>`coalesce(sum(case when ${transactions.kind} = 'expense' then ${transactions.amountCents} end), 0)`,
    })
    .from(transactions)
    .where(
      and(
        isNull(transactions.deletedAt),
        gte(transactions.date, start),
        lte(transactions.date, end),
      ),
    )
    .groupBy(sql`substr(${transactions.date}, 1, 7)`)
    .all();
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const out: MonthTotals[] = [];
  let [y, m] = fromMonth.split('-').map(Number) as [number, number];
  for (;;) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const r = byMonth.get(key);
    out.push({
      month: key,
      incomeCents: Number(r?.income ?? 0),
      expenseCents: Number(r?.expense ?? 0),
    });
    if (key === toMonth || out.length > 240) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** Valores de descrições recentes para autocompletar. */
export function recentDescriptions(db: AppDB, limit = 8): string[] {
  return db
    .selectDistinct({ d: transactions.description })
    .from(transactions)
    .where(and(isNull(transactions.deletedAt), sql`${transactions.description} <> ''`))
    .orderBy(desc(transactions.createdAt))
    .limit(limit)
    .all()
    .map((r) => r.d);
}
