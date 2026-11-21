import { create } from 'zustand';
import { monthKey, type MonthKey } from '@app/shared';

export type KindFilter = 'all' | 'expense' | 'income' | 'transfer';

interface UIState {
  /** Mês selecionado nas telas de Transações/Orçamentos/Relatórios. */
  month: MonthKey;
  kindFilter: KindFilter;
  categoryFilter: string | null;
  search: string;
  setMonth: (m: MonthKey) => void;
  setKindFilter: (k: KindFilter) => void;
  setCategoryFilter: (id: string | null) => void;
  setSearch: (s: string) => void;
  resetFilters: () => void;
}

export const useUI = create<UIState>((set) => ({
  month: monthKey(new Date()),
  kindFilter: 'all',
  categoryFilter: null,
  search: '',
  setMonth: (month) => set({ month }),
  setKindFilter: (kindFilter) => set({ kindFilter }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
  setSearch: (search) => set({ search }),
  resetFilters: () => set({ kindFilter: 'all', categoryFilter: null, search: '' }),
}));
