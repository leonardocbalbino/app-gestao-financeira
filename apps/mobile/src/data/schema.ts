import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

/**
 * Banco local (fonte da verdade no aparelho). Dinheiro em centavos (INTEGER).
 * Toda tabela sincronizável tem: updated_at, deleted_at (tombstone) e dirty (pendente de push).
 */
const syncColumns = {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  dirty: integer('dirty', { mode: 'boolean' }).notNull().default(true),
};

export const accounts = sqliteTable('accounts', {
  ...syncColumns,
  name: text('name').notNull(),
  type: text('type', {
    enum: ['checking', 'savings', 'credit_card', 'cash', 'investment', 'other'],
  }).notNull(),
  initialBalanceCents: integer('initial_balance_cents').notNull().default(0),
  color: text('color').notNull(),
  icon: text('icon').notNull(),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const categories = sqliteTable('categories', {
  ...syncColumns,
  slug: text('slug'),
  name: text('name').notNull(),
  kind: text('kind', { enum: ['expense', 'income'] }).notNull(),
  icon: text('icon').notNull(),
  color: text('color').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const transactions = sqliteTable(
  'transactions',
  {
    ...syncColumns,
    kind: text('kind', { enum: ['expense', 'income', 'transfer'] }).notNull(),
    amountCents: integer('amount_cents').notNull(),
    description: text('description').notNull().default(''),
    categoryId: text('category_id'),
    accountId: text('account_id').notNull(),
    toAccountId: text('to_account_id'),
    date: text('date').notNull(),
    notes: text('notes'),
    recurrence: text('recurrence', { enum: ['none', 'weekly', 'monthly', 'yearly'] })
      .notNull()
      .default('none'),
    recurrenceParentId: text('recurrence_parent_id'),
  },
  (t) => [
    index('transactions_date_idx').on(t.date),
    index('transactions_category_idx').on(t.categoryId),
  ],
);

export const budgets = sqliteTable('budgets', {
  ...syncColumns,
  categoryId: text('category_id').notNull(),
  limitCents: integer('limit_cents').notNull(),
  startMonth: text('start_month').notNull(),
});

export const goals = sqliteTable('goals', {
  ...syncColumns,
  name: text('name').notNull(),
  targetCents: integer('target_cents').notNull(),
  savedCents: integer('saved_cents').notNull().default(0),
  deadline: text('deadline'),
  icon: text('icon').notNull(),
  color: text('color').notNull(),
});

export const bills = sqliteTable('bills', {
  ...syncColumns,
  name: text('name').notNull(),
  amountCents: integer('amount_cents').notNull(),
  dueDate: text('due_date').notNull(),
  categoryId: text('category_id'),
  recurrence: text('recurrence', { enum: ['none', 'weekly', 'monthly', 'yearly'] })
    .notNull()
    .default('none'),
  paidAt: text('paid_at'),
  remindDaysBefore: integer('remind_days_before').notNull().default(1),
  notificationId: text('notification_id'),
  anchorDay: integer('anchor_day'),
});

export const schema = { accounts, categories, transactions, budgets, goals, bills };
export type Schema = typeof schema;

export type AccountRow = typeof accounts.$inferSelect;
export type CategoryRow = typeof categories.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;
export type BudgetRow = typeof budgets.$inferSelect;
export type GoalRow = typeof goals.$inferSelect;
export type BillRow = typeof bills.$inferSelect;

/** Nomes das tabelas sincronizáveis (ordem respeita dependências). */
export const SYNC_TABLES = [
  'accounts',
  'categories',
  'transactions',
  'budgets',
  'goals',
  'bills',
] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];
