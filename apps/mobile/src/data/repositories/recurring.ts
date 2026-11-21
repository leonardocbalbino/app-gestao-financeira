import { and, eq, isNull, ne, or, sql } from 'drizzle-orm';
import { addDays, addMonthsToDate, toISODate, type Recurrence } from '@app/shared';
import { newId, nowISO } from '@/lib/id';
import type { AppDB } from '../db';
import { transactions } from '../schema';

/** k-ésima ocorrência ancorada na data do modelo (31 jan → 28 fev → 31 mar). */
export function occurrenceAt(start: string, recurrence: Recurrence, k: number): string | null {
  switch (recurrence) {
    case 'weekly':
      return addDays(start, 7 * k);
    case 'monthly':
      return addMonthsToDate(start, k);
    case 'yearly':
      return addMonthsToDate(start, 12 * k);
    default:
      return null;
  }
}

/** Limite de ocorrências geradas por modelo em uma execução (evita explosão após meses offline). */
const MAX_PER_RUN = 24;

/**
 * Gera as ocorrências vencidas das transações recorrentes (modelos = recurrence != 'none' e sem pai).
 * Idempotente: parte sempre da última ocorrência existente. Retorna quantas foram criadas.
 */
export function materializeRecurring(db: AppDB, today: string = toISODate(new Date())): number {
  const templates = db
    .select()
    .from(transactions)
    .where(
      and(
        isNull(transactions.deletedAt),
        isNull(transactions.recurrenceParentId),
        ne(transactions.recurrence, 'none'),
      ),
    )
    .all();
  let created = 0;
  for (const tpl of templates) {
    const last =
      db
        .select({ d: sql<string>`max(${transactions.date})` })
        .from(transactions)
        .where(or(eq(transactions.id, tpl.id), eq(transactions.recurrenceParentId, tpl.id)))
        .get()?.d ?? tpl.date;
    let k = 1;
    let next = occurrenceAt(tpl.date, tpl.recurrence, k);
    while (next && next <= last && k < 10_000) next = occurrenceAt(tpl.date, tpl.recurrence, ++k);
    let n = 0;
    while (next && next <= today && n < MAX_PER_RUN) {
      const now = nowISO();
      db.insert(transactions)
        .values({
          ...tpl,
          id: newId(),
          date: next,
          recurrence: 'none',
          recurrenceParentId: tpl.id,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          dirty: true,
        })
        .run();
      created++;
      n++;
      next = occurrenceAt(tpl.date, tpl.recurrence, ++k);
    }
  }
  return created;
}
