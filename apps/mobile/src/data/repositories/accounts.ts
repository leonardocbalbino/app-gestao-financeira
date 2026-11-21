import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { AccountType } from '@app/shared';
import { newId, nowISO } from '@/lib/id';
import type { AppDB } from '../db';
import { accounts, transactions, type AccountRow } from '../schema';

export interface AccountWithBalance extends AccountRow {
  balanceCents: number;
}

/** Saldo = inicial + receitas − despesas − transferências enviadas + transferências recebidas. */
export function listAccounts(
  db: AppDB,
  opts: { includeArchived?: boolean } = {},
): AccountWithBalance[] {
  // Subquery correlacionada com nomes qualificados explicitamente (o Drizzle pode omitir o prefixo).
  const delta = sql<number>`coalesce((
    select sum(case
      when t.kind = 'income' and t.account_id = "accounts"."id" then t.amount_cents
      when t.kind = 'expense' and t.account_id = "accounts"."id" then -t.amount_cents
      when t.kind = 'transfer' and t.account_id = "accounts"."id" then -t.amount_cents
      when t.kind = 'transfer' and t.to_account_id = "accounts"."id" then t.amount_cents
      else 0 end)
    from transactions t
    where t.deleted_at is null and (t.account_id = "accounts"."id" or t.to_account_id = "accounts"."id")
  ), 0)`;
  const rows = db
    .select({ account: accounts, delta })
    .from(accounts)
    .where(
      opts.includeArchived
        ? isNull(accounts.deletedAt)
        : and(isNull(accounts.deletedAt), eq(accounts.archived, false)),
    )
    .orderBy(asc(accounts.sortOrder), asc(accounts.createdAt))
    .all();
  return rows.map((r) => ({
    ...r.account,
    balanceCents: r.account.initialBalanceCents + Number(r.delta),
  }));
}

export function totalBalance(db: AppDB): number {
  return listAccounts(db).reduce((s, a) => s + a.balanceCents, 0);
}

export function countActiveAccounts(db: AppDB): number {
  return (
    db
      .select({ n: sql<number>`count(*)` })
      .from(accounts)
      .where(and(isNull(accounts.deletedAt), eq(accounts.archived, false)))
      .get()?.n ?? 0
  );
}

export interface AccountInput {
  name: string;
  type: AccountType;
  initialBalanceCents: number;
  color: string;
  icon: string;
}

export function createAccount(db: AppDB, input: AccountInput): AccountRow {
  const now = nowISO();
  const sortOrder = countActiveAccounts(db);
  const row: AccountRow = {
    id: newId(),
    ...input,
    name: input.name.trim(),
    archived: false,
    sortOrder,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    dirty: true,
  };
  db.insert(accounts).values(row).run();
  return row;
}

export function updateAccount(
  db: AppDB,
  id: string,
  input: Partial<AccountInput & { archived: boolean }>,
) {
  db.update(accounts)
    .set({ ...input, updatedAt: nowISO(), dirty: true })
    .where(eq(accounts.id, id))
    .run();
}

/** Exclui conta apenas se não houver transações; caso contrário, arquiva. */
export function deleteAccount(db: AppDB, id: string): 'deleted' | 'archived' {
  const used =
    db
      .select({ n: sql<number>`count(*)` })
      .from(transactions)
      .where(
        and(
          isNull(transactions.deletedAt),
          sql`(${transactions.accountId} = ${id} or ${transactions.toAccountId} = ${id})`,
        ),
      )
      .get()?.n ?? 0;
  const now = nowISO();
  if (used > 0) {
    updateAccount(db, id, { archived: true });
    return 'archived';
  }
  db.update(accounts)
    .set({ deletedAt: now, updatedAt: now, dirty: true })
    .where(eq(accounts.id, id))
    .run();
  return 'deleted';
}
