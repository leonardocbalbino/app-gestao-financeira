import { and, asc, eq, isNotNull, isNull, desc } from 'drizzle-orm';
import { daysBetween, nextOccurrence, toISODate, type Recurrence } from '@app/shared';
import { newId, nowISO } from '@/lib/id';
import type { AppDB } from '../db';
import { bills, type BillRow } from '../schema';
import { createTransaction } from './transactions';

export type BillStatus = 'overdue' | 'due_soon' | 'upcoming' | 'paid';

export interface BillWithStatus extends BillRow {
  status: BillStatus;
  /** Dias até o vencimento (negativo = atrasada). */
  daysUntilDue: number;
}

export function billStatus(bill: Pick<BillRow, 'dueDate' | 'paidAt'>, today: string): BillStatus {
  if (bill.paidAt) return 'paid';
  const d = daysBetween(today, bill.dueDate);
  if (d < 0) return 'overdue';
  if (d <= 3) return 'due_soon';
  return 'upcoming';
}

/** Contas em aberto ordenadas por vencimento (atrasadas primeiro). */
export function listOpenBills(db: AppDB, today = toISODate(new Date())): BillWithStatus[] {
  return db
    .select()
    .from(bills)
    .where(and(isNull(bills.deletedAt), isNull(bills.paidAt)))
    .orderBy(asc(bills.dueDate))
    .all()
    .map((b) => ({
      ...b,
      status: billStatus(b, today),
      daysUntilDue: daysBetween(today, b.dueDate),
    }));
}

export function listPaidBills(db: AppDB, limit = 20): BillRow[] {
  return db
    .select()
    .from(bills)
    .where(and(isNull(bills.deletedAt), isNotNull(bills.paidAt)))
    .orderBy(desc(bills.paidAt))
    .limit(limit)
    .all();
}

export function getBill(db: AppDB, id: string): BillRow | undefined {
  return db.select().from(bills).where(eq(bills.id, id)).get();
}

export interface BillInput {
  name: string;
  amountCents: number;
  dueDate: string;
  categoryId: string | null;
  recurrence: Recurrence;
  remindDaysBefore: number;
}

export function createBill(db: AppDB, input: BillInput): BillRow {
  const now = nowISO();
  const row: BillRow = {
    id: newId(),
    ...input,
    name: input.name.trim(),
    paidAt: null,
    notificationId: null,
    anchorDay: Number(input.dueDate.slice(8, 10)),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    dirty: true,
  };
  db.insert(bills).values(row).run();
  return row;
}

export function setBillNotification(db: AppDB, id: string, notificationId: string | null): void {
  // Id de notificação é só local: não marca dirty.
  db.update(bills).set({ notificationId }).where(eq(bills.id, id)).run();
}

export interface PayResult {
  paid: BillRow;
  next: BillRow | null;
}

/**
 * Marca como paga. Opcionalmente lança a despesa na conta informada.
 * Se recorrente, cria a próxima ocorrência.
 */
export function payBill(
  db: AppDB,
  id: string,
  opts: { accountId?: string; paidDate?: string } = {},
): PayResult | null {
  const bill = getBill(db, id);
  if (!bill || bill.paidAt) return null;
  const now = nowISO();
  const paidDate = opts.paidDate ?? toISODate(new Date());
  let next: BillRow | null = null;
  db.transaction((tx) => {
    tx.update(bills)
      .set({ paidAt: now, updatedAt: now, dirty: true })
      .where(eq(bills.id, id))
      .run();
    if (opts.accountId) {
      createTransaction(tx as unknown as AppDB, {
        kind: 'expense',
        amountCents: bill.amountCents,
        description: bill.name,
        categoryId: bill.categoryId,
        accountId: opts.accountId,
        toAccountId: null,
        date: paidDate,
        notes: null,
        recurrence: 'none',
      });
    }
    const nextDue = nextOccurrence(
      bill.dueDate,
      bill.recurrence,
      bill.anchorDay ?? Number(bill.dueDate.slice(8, 10)),
    );
    if (nextDue) {
      next = {
        ...bill,
        id: newId(),
        dueDate: nextDue,
        paidAt: null,
        notificationId: null,
        createdAt: now,
        updatedAt: now,
        dirty: true,
      };
      tx.insert(bills).values(next).run();
    }
  });
  return { paid: { ...bill, paidAt: now }, next };
}

export function deleteBill(db: AppDB, id: string): void {
  const now = nowISO();
  db.update(bills)
    .set({ deletedAt: now, updatedAt: now, dirty: true })
    .where(eq(bills.id, id))
    .run();
}
