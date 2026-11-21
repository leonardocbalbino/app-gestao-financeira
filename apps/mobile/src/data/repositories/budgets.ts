import { and, asc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { monthRange, type MonthKey } from '@app/shared';
import { newId, nowISO } from '@/lib/id';
import type { AppDB } from '../db';
import { budgets, categories, transactions, type BudgetRow } from '../schema';

export interface BudgetWithSpending extends BudgetRow {
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  spentCents: number;
  /** spent / limit (pode passar de 1). */
  ratio: number;
}

/** Orçamentos vigentes no mês (start_month <= mês), com o gasto da categoria no mês. */
export function listBudgets(db: AppDB, month: MonthKey): BudgetWithSpending[] {
  const r = monthRange(month);
  const spent = db
    .select({
      categoryId: transactions.categoryId,
      total: sql<number>`sum(${transactions.amountCents})`,
    })
    .from(transactions)
    .where(
      and(
        isNull(transactions.deletedAt),
        eq(transactions.kind, 'expense'),
        gte(transactions.date, r.start),
        lte(transactions.date, r.end),
      ),
    )
    .groupBy(transactions.categoryId)
    .all();
  const spentBy = new Map(spent.map((s) => [s.categoryId, Number(s.total)]));
  return db
    .select({ budget: budgets, cat: categories })
    .from(budgets)
    .innerJoin(categories, eq(budgets.categoryId, categories.id))
    .where(
      and(isNull(budgets.deletedAt), isNull(categories.deletedAt), lte(budgets.startMonth, month)),
    )
    .orderBy(asc(budgets.createdAt))
    .all()
    .map(({ budget, cat }) => {
      const spentCents = spentBy.get(budget.categoryId) ?? 0;
      return {
        ...budget,
        categoryName: cat.name,
        categoryIcon: cat.icon,
        categoryColor: cat.color,
        spentCents,
        ratio: budget.limitCents > 0 ? spentCents / budget.limitCents : 0,
      };
    });
}

export function countBudgets(db: AppDB): number {
  return (
    db
      .select({ n: sql<number>`count(*)` })
      .from(budgets)
      .where(isNull(budgets.deletedAt))
      .get()?.n ?? 0
  );
}

export interface BudgetInput {
  categoryId: string;
  limitCents: number;
  startMonth: MonthKey;
}

/** Um orçamento por categoria: se já existir, atualiza o limite. */
export function upsertBudget(db: AppDB, input: BudgetInput): BudgetRow {
  const now = nowISO();
  const existing = db
    .select()
    .from(budgets)
    .where(and(eq(budgets.categoryId, input.categoryId), isNull(budgets.deletedAt)))
    .get();
  if (existing) {
    db.update(budgets)
      .set({ limitCents: input.limitCents, updatedAt: now, dirty: true })
      .where(eq(budgets.id, existing.id))
      .run();
    return { ...existing, limitCents: input.limitCents, updatedAt: now, dirty: true };
  }
  const row: BudgetRow = {
    id: newId(),
    ...input,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    dirty: true,
  };
  db.insert(budgets).values(row).run();
  return row;
}

export function deleteBudget(db: AppDB, id: string): void {
  const now = nowISO();
  db.update(budgets)
    .set({ deletedAt: now, updatedAt: now, dirty: true })
    .where(eq(budgets.id, id))
    .run();
}
