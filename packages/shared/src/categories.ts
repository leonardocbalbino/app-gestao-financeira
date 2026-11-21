/** Categorias padrão semeadas no primeiro uso (local) e no seed do Supabase. */
export interface DefaultCategory {
  /** Slug estável usado para deduplicar entre aparelhos no sync. */
  slug: string;
  name: string;
  kind: 'expense' | 'income';
  /** Nome de ícone lucide. */
  icon: string;
  color: string;
}

export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { slug: 'alimentacao', name: 'Alimentação', kind: 'expense', icon: 'utensils', color: '#0B6E4F' },
  { slug: 'moradia', name: 'Moradia', kind: 'expense', icon: 'house', color: '#08513A' },
  { slug: 'transporte', name: 'Transporte', kind: 'expense', icon: 'car', color: '#6FB89A' },
  { slug: 'lazer', name: 'Lazer', kind: 'expense', icon: 'party-popper', color: '#F3C49B' },
  { slug: 'saude', name: 'Saúde', kind: 'expense', icon: 'heart-pulse', color: '#C2410C' },
  { slug: 'educacao', name: 'Educação', kind: 'expense', icon: 'graduation-cap', color: '#5B6661' },
  { slug: 'assinaturas', name: 'Assinaturas', kind: 'expense', icon: 'repeat', color: '#E8B64C' },
  { slug: 'compras', name: 'Compras', kind: 'expense', icon: 'shopping-bag', color: '#8C948F' },
  { slug: 'receita', name: 'Receita', kind: 'income', icon: 'wallet', color: '#0B6E4F' },
  { slug: 'outros', name: 'Outros', kind: 'expense', icon: 'circle-ellipsis', color: '#A9B1AC' },
] as const;
