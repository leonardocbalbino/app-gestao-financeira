import { sql } from 'drizzle-orm';
import type { AppDB } from './db';

const META = `
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  dirty INTEGER NOT NULL DEFAULT 1`;

/**
 * Migrations locais versionadas por PRAGMA user_version. Nunca edite uma migration publicada:
 * adicione uma nova ao fim do array.
 */
export const MIGRATIONS: string[][] = [
  // v1
  [
    `CREATE TABLE accounts (${META},
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      initial_balance_cents INTEGER NOT NULL DEFAULT 0,
      color TEXT NOT NULL,
      icon TEXT NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0)`,
    `CREATE TABLE categories (${META},
      slug TEXT,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0)`,
    `CREATE TABLE transactions (${META},
      kind TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category_id TEXT,
      account_id TEXT NOT NULL,
      to_account_id TEXT,
      date TEXT NOT NULL,
      notes TEXT,
      recurrence TEXT NOT NULL DEFAULT 'none',
      recurrence_parent_id TEXT)`,
    `CREATE INDEX transactions_date_idx ON transactions (date)`,
    `CREATE INDEX transactions_category_idx ON transactions (category_id)`,
    `CREATE TABLE budgets (${META},
      category_id TEXT NOT NULL,
      limit_cents INTEGER NOT NULL,
      start_month TEXT NOT NULL)`,
    `CREATE TABLE goals (${META},
      name TEXT NOT NULL,
      target_cents INTEGER NOT NULL,
      saved_cents INTEGER NOT NULL DEFAULT 0,
      deadline TEXT,
      icon TEXT NOT NULL,
      color TEXT NOT NULL)`,
    `CREATE TABLE bills (${META},
      name TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      due_date TEXT NOT NULL,
      category_id TEXT,
      recurrence TEXT NOT NULL DEFAULT 'none',
      paid_at TEXT,
      remind_days_before INTEGER NOT NULL DEFAULT 1,
      notification_id TEXT)`,
  ],
  // v2: dia âncora das contas recorrentes (31 → 28 fev → 31 mar)
  [`ALTER TABLE bills ADD COLUMN anchor_day INTEGER`],
];

export function getUserVersion(db: AppDB): number {
  const row = db.get<{ user_version: number }>(sql`PRAGMA user_version`);
  return row?.user_version ?? 0;
}

/** Aplica migrations pendentes em transação. Retorna a versão final. */
export function migrate(db: AppDB): number {
  const current = getUserVersion(db);
  for (let v = current; v < MIGRATIONS.length; v++) {
    const statements = MIGRATIONS[v] ?? [];
    db.transaction((tx) => {
      for (const stmt of statements) tx.run(sql.raw(stmt));
    });
    db.run(sql.raw(`PRAGMA user_version = ${v + 1}`));
  }
  return MIGRATIONS.length;
}
