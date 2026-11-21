import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MonthKey, TransactionForm } from '@app/shared';
import { useDb } from './DatabaseProvider';
import * as accountsRepo from './repositories/accounts';
import * as categoriesRepo from './repositories/categories';
import * as txRepo from './repositories/transactions';

/** Todas as queries locais ficam sob a raiz ['db'] — qualquer escrita invalida a árvore. */
export const dbKeys = {
  all: ['db'] as const,
  transactions: (f: txRepo.TransactionFilter) => ['db', 'transactions', f] as const,
  transaction: (id: string) => ['db', 'transaction', id] as const,
  monthSummary: (m: MonthKey) => ['db', 'monthSummary', m] as const,
  byCategory: (m: MonthKey, kind: 'expense' | 'income') => ['db', 'byCategory', m, kind] as const,
  monthly: (from: MonthKey, to: MonthKey) => ['db', 'monthly', from, to] as const,
  accounts: (archived: boolean) => ['db', 'accounts', archived] as const,
  categories: (kind?: 'expense' | 'income') => ['db', 'categories', kind ?? 'all'] as const,
  recentDescriptions: ['db', 'recentDescriptions'] as const,
};

export function useTransactions(filter: txRepo.TransactionFilter) {
  const db = useDb();
  return useQuery({
    queryKey: dbKeys.transactions(filter),
    queryFn: () => txRepo.listTransactions(db, filter),
  });
}

export function useTransaction(id: string | undefined) {
  const db = useDb();
  return useQuery({
    queryKey: dbKeys.transaction(id ?? ''),
    queryFn: () => txRepo.getTransaction(db, id ?? '') ?? null,
    enabled: !!id,
  });
}

export function useMonthSummary(month: MonthKey) {
  const db = useDb();
  return useQuery({
    queryKey: dbKeys.monthSummary(month),
    queryFn: () => txRepo.monthSummary(db, month),
  });
}

export function useSpendingByCategory(month: MonthKey, kind: 'expense' | 'income' = 'expense') {
  const db = useDb();
  return useQuery({
    queryKey: dbKeys.byCategory(month, kind),
    queryFn: () => txRepo.spendingByCategory(db, month, kind),
  });
}

export function useMonthlyTotals(from: MonthKey, to: MonthKey) {
  const db = useDb();
  return useQuery({
    queryKey: dbKeys.monthly(from, to),
    queryFn: () => txRepo.monthlyTotals(db, from, to),
  });
}

export function useAccounts(includeArchived = false) {
  const db = useDb();
  return useQuery({
    queryKey: dbKeys.accounts(includeArchived),
    queryFn: () => accountsRepo.listAccounts(db, { includeArchived }),
  });
}

export function useCategories(kind?: 'expense' | 'income') {
  const db = useDb();
  return useQuery({
    queryKey: dbKeys.categories(kind),
    queryFn: () => categoriesRepo.listCategories(db, kind),
  });
}

export function useRecentDescriptions() {
  const db = useDb();
  return useQuery({
    queryKey: dbKeys.recentDescriptions,
    queryFn: () => txRepo.recentDescriptions(db),
  });
}

/** Mutação local genérica: executa no SQLite e invalida todas as queries do banco. */
function useLocalMutation<TArgs, TResult>(
  fn: (db: ReturnType<typeof useDb>, args: TArgs) => TResult,
) {
  const db = useDb();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: TArgs) => fn(db, args),
    onSuccess: () => qc.invalidateQueries({ queryKey: dbKeys.all }),
  });
}

export const useCreateTransaction = () =>
  useLocalMutation((db, form: TransactionForm) => txRepo.createTransaction(db, form));
export const useUpdateTransaction = () =>
  useLocalMutation((db, a: { id: string; form: TransactionForm }) =>
    txRepo.updateTransaction(db, a.id, a.form),
  );
export const useDeleteTransaction = () =>
  useLocalMutation((db, id: string) => txRepo.deleteTransaction(db, id));

export const useCreateAccount = () =>
  useLocalMutation((db, input: accountsRepo.AccountInput) => accountsRepo.createAccount(db, input));
export const useUpdateAccount = () =>
  useLocalMutation(
    (db, a: { id: string; input: Partial<accountsRepo.AccountInput & { archived: boolean }> }) =>
      accountsRepo.updateAccount(db, a.id, a.input),
  );
export const useDeleteAccount = () =>
  useLocalMutation((db, id: string) => accountsRepo.deleteAccount(db, id));

export const useCreateCategory = () =>
  useLocalMutation((db, input: categoriesRepo.CategoryInput) =>
    categoriesRepo.createCategory(db, input),
  );
export const useUpdateCategory = () =>
  useLocalMutation((db, a: { id: string; input: Partial<categoriesRepo.CategoryInput> }) =>
    categoriesRepo.updateCategory(db, a.id, a.input),
  );
export const useDeleteCategory = () =>
  useLocalMutation((db, id: string) => categoriesRepo.deleteCategory(db, id));
