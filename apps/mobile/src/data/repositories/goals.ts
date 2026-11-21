import { asc, eq, isNull, sql } from 'drizzle-orm';
import { newId, nowISO } from '@/lib/id';
import type { AppDB } from '../db';
import { goals, type GoalRow } from '../schema';

export function listGoals(db: AppDB): GoalRow[] {
  return db.select().from(goals).where(isNull(goals.deletedAt)).orderBy(asc(goals.createdAt)).all();
}

export function countGoals(db: AppDB): number {
  return (
    db
      .select({ n: sql<number>`count(*)` })
      .from(goals)
      .where(isNull(goals.deletedAt))
      .get()?.n ?? 0
  );
}

export interface GoalInput {
  name: string;
  targetCents: number;
  deadline: string | null;
  icon: string;
  color: string;
}

export function createGoal(db: AppDB, input: GoalInput): GoalRow {
  const now = nowISO();
  const row: GoalRow = {
    id: newId(),
    ...input,
    name: input.name.trim(),
    savedCents: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    dirty: true,
  };
  db.insert(goals).values(row).run();
  return row;
}

/** Guarda (delta > 0) ou retira (delta < 0) dinheiro da meta; nunca fica negativo. */
export function addToGoal(db: AppDB, id: string, deltaCents: number): void {
  db.update(goals)
    .set({
      savedCents: sql`max(0, ${goals.savedCents} + ${Math.round(deltaCents)})`,
      updatedAt: nowISO(),
      dirty: true,
    })
    .where(eq(goals.id, id))
    .run();
}

export function deleteGoal(db: AppDB, id: string): void {
  const now = nowISO();
  db.update(goals)
    .set({ deletedAt: now, updatedAt: now, dirty: true })
    .where(eq(goals.id, id))
    .run();
}
