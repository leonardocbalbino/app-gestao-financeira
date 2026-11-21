import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida');
const uuid = z.string().uuid();
const cents = z.number().int('Valor deve ser em centavos');

export const transactionKindSchema = z.enum(['expense', 'income', 'transfer']);
export type TransactionKind = z.infer<typeof transactionKindSchema>;

export const accountTypeSchema = z.enum([
  'checking',
  'savings',
  'credit_card',
  'cash',
  'investment',
  'other',
]);
export type AccountType = z.infer<typeof accountTypeSchema>;

/** Colunas comuns a todas as entidades sincronizáveis. */
export const syncMetaSchema = z.object({
  id: uuid,
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});

export const accountSchema = syncMetaSchema.extend({
  name: z.string().trim().min(1, 'Informe o nome').max(40),
  type: accountTypeSchema,
  initialBalanceCents: cents,
  color: z.string(),
  icon: z.string(),
  archived: z.boolean(),
});
export type Account = z.infer<typeof accountSchema>;

export const categorySchema = syncMetaSchema.extend({
  name: z.string().trim().min(1, 'Informe o nome').max(30),
  kind: z.enum(['expense', 'income']),
  icon: z.string(),
  color: z.string(),
  isDefault: z.boolean(),
  sortOrder: z.number().int(),
});
export type Category = z.infer<typeof categorySchema>;

export const recurrenceSchema = z.enum(['none', 'weekly', 'monthly', 'yearly']);
export type Recurrence = z.infer<typeof recurrenceSchema>;

export const transactionSchema = syncMetaSchema.extend({
  kind: transactionKindSchema,
  amountCents: cents.positive('Informe um valor maior que zero'),
  description: z.string().trim().max(80),
  categoryId: uuid.nullable(),
  accountId: uuid,
  toAccountId: uuid.nullable(),
  date: isoDate,
  notes: z.string().max(500).nullable(),
  recurrence: recurrenceSchema,
  recurrenceParentId: uuid.nullable(),
});
export type Transaction = z.infer<typeof transactionSchema>;

/** Formulário de nova transação (antes de virar entidade). */
export const transactionFormSchema = z
  .object({
    kind: transactionKindSchema,
    amountCents: cents.positive('Informe um valor maior que zero'),
    description: z.string().trim().max(80),
    categoryId: uuid.nullable(),
    accountId: uuid,
    toAccountId: uuid.nullable(),
    date: isoDate,
    notes: z.string().max(500).nullable(),
    recurrence: recurrenceSchema,
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'transfer') {
      if (!v.toAccountId)
        ctx.addIssue({
          code: 'custom',
          path: ['toAccountId'],
          message: 'Escolha a conta de destino',
        });
      else if (v.toAccountId === v.accountId)
        ctx.addIssue({
          code: 'custom',
          path: ['toAccountId'],
          message: 'Contas devem ser diferentes',
        });
    } else if (!v.categoryId) {
      ctx.addIssue({ code: 'custom', path: ['categoryId'], message: 'Escolha uma categoria' });
    }
  });
export type TransactionForm = z.infer<typeof transactionFormSchema>;

export const budgetSchema = syncMetaSchema.extend({
  categoryId: uuid,
  /** Limite mensal em centavos. */
  limitCents: cents.positive('Informe um limite'),
  /** Mês de início "YYYY-MM"; orçamento vale para meses seguintes até ser excluído. */
  startMonth: z.string().regex(/^\d{4}-\d{2}$/),
});
export type Budget = z.infer<typeof budgetSchema>;

export const goalSchema = syncMetaSchema.extend({
  name: z.string().trim().min(1, 'Informe o nome').max(40),
  targetCents: cents.positive('Informe o objetivo'),
  savedCents: cents.nonnegative(),
  deadline: isoDate.nullable(),
  icon: z.string(),
  color: z.string(),
});
export type Goal = z.infer<typeof goalSchema>;

export const billSchema = syncMetaSchema.extend({
  name: z.string().trim().min(1, 'Informe o nome').max(40),
  amountCents: cents.positive('Informe o valor'),
  dueDate: isoDate,
  categoryId: uuid.nullable(),
  recurrence: recurrenceSchema,
  paidAt: z.string().nullable(),
  remindDaysBefore: z.number().int().min(0).max(30),
});
export type Bill = z.infer<typeof billSchema>;

export const appConfigSchema = z.object({
  min_app_version: z.string().default('0.0.0'),
  maintenance_mode: z.boolean().default(false),
  maintenance_message: z.string().default(''),
  paywall_default_plan: z.enum(['monthly', 'annual']).default('annual'),
  feature_flags: z.record(z.string(), z.boolean()).default({}),
});
export type AppConfig = z.infer<typeof appConfigSchema>;

export const adPlacementSchema = z.enum([
  'banner_home',
  'banner_budgets',
  'banner_reports',
  'native_transactions',
  'interstitial',
]);
export type AdPlacement = z.infer<typeof adPlacementSchema>;

export const adConfigSchema = z.object({
  enabled: z.boolean().default(true),
  placements: z.record(adPlacementSchema, z.boolean()).default({
    banner_home: true,
    banner_budgets: true,
    banner_reports: true,
    native_transactions: true,
    interstitial: false,
  }),
  native_every_n: z.number().int().min(3).default(8),
  interstitial_min_interval_sec: z.number().int().min(60).default(300),
  ad_unit_ids: z
    .object({
      ios: z.record(z.string(), z.string()).default({}),
      android: z.record(z.string(), z.string()).default({}),
    })
    .default({ ios: {}, android: {} }),
});
export type AdConfig = z.infer<typeof adConfigSchema>;
