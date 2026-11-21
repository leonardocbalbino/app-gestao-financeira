import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { newId, nowISO } from '@/lib/id';
import type { AppDB } from '../db';
import { categories, transactions, type CategoryRow } from '../schema';

export function listCategories(db: AppDB, kind?: 'expense' | 'income'): CategoryRow[] {
  return db
    .select()
    .from(categories)
    .where(
      kind
        ? and(isNull(categories.deletedAt), eq(categories.kind, kind))
        : isNull(categories.deletedAt),
    )
    .orderBy(asc(categories.sortOrder), asc(categories.name))
    .all();
}

export function countCustomCategories(db: AppDB): number {
  return (
    db
      .select({ n: sql<number>`count(*)` })
      .from(categories)
      .where(and(isNull(categories.deletedAt), eq(categories.isDefault, false)))
      .get()?.n ?? 0
  );
}

export interface CategoryInput {
  name: string;
  kind: 'expense' | 'income';
  icon: string;
  color: string;
}

export function createCategory(db: AppDB, input: CategoryInput): CategoryRow {
  const now = nowISO();
  const max =
    db
      .select({ m: sql<number>`coalesce(max(${categories.sortOrder}), 0)` })
      .from(categories)
      .get()?.m ?? 0;
  const row: CategoryRow = {
    id: newId(),
    slug: null,
    ...input,
    name: input.name.trim(),
    isDefault: false,
    sortOrder: max + 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    dirty: true,
  };
  db.insert(categories).values(row).run();
  return row;
}

export function updateCategory(db: AppDB, id: string, input: Partial<CategoryInput>): void {
  db.update(categories)
    .set({ ...input, updatedAt: nowISO(), dirty: true })
    .where(eq(categories.id, id))
    .run();
}

/** Exclui a categoria; transações passam para "Outros" (ou ficam sem categoria). */
export function deleteCategory(db: AppDB, id: string): void {
  const now = nowISO();
  const fallback = db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.slug, 'outros'), isNull(categories.deletedAt)))
    .get();
  db.transaction((tx) => {
    tx.update(transactions)
      .set({
        categoryId: fallback && fallback.id !== id ? fallback.id : null,
        updatedAt: now,
        dirty: true,
      })
      .where(eq(transactions.categoryId, id))
      .run();
    tx.update(categories)
      .set({ deletedAt: now, updatedAt: now, dirty: true })
      .where(eq(categories.id, id))
      .run();
  });
}
