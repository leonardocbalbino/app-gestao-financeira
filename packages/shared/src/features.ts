/**
 * Catálogo de funcionalidades. Fonte da verdade para chaves, tipos e defaults (fallback Free).
 * O banco (tabela `features`) é semeado a partir deste catálogo; o admin edita a matriz plano×feature.
 * NUNCA use `isPro` no app — consulte sempre uma feature.
 */
export type FeatureType = 'boolean' | 'limit' | 'ads';

/** Limite numérico; `null` = ilimitado. */
export type LimitValue = number | null;
export type FeatureValue = boolean | LimitValue;

export interface FeatureDefinition {
  key: string;
  type: FeatureType;
  label: string;
  description: string;
  group:
    | 'Exportação'
    | 'Lembretes'
    | 'Sincronização'
    | 'Relatórios'
    | 'Organização'
    | 'Limites'
    | 'Anúncios';
  /** Valor quando nada no servidor define (equivale ao plano Free). */
  defaultValue: FeatureValue;
  /** Texto curto para a tabela comparativa do paywall. */
  paywallLabel: string;
}

export const FEATURE_CATALOG = [
  {
    key: 'export.pdf',
    type: 'boolean',
    label: 'Exportar PDF',
    description: 'Gerar relatório mensal em PDF',
    group: 'Exportação',
    defaultValue: false,
    paywallLabel: 'Relatório em PDF',
  },
  {
    key: 'export.csv',
    type: 'boolean',
    label: 'Exportar CSV',
    description: 'Exportar transações em CSV',
    group: 'Exportação',
    defaultValue: false,
    paywallLabel: 'Exportar planilha CSV',
  },
  {
    key: 'bills.reminders',
    type: 'boolean',
    label: 'Lembretes de contas',
    description: 'Notificações antes do vencimento',
    group: 'Lembretes',
    defaultValue: false,
    paywallLabel: 'Lembretes de contas a pagar',
  },
  {
    key: 'sync.cloud',
    type: 'boolean',
    label: 'Sincronização na nuvem',
    description: 'Backup e sincronização entre aparelhos',
    group: 'Sincronização',
    defaultValue: false,
    paywallLabel: 'Backup e sincronização',
  },
  {
    key: 'reports.advanced',
    type: 'boolean',
    label: 'Relatórios avançados',
    description: 'Comparativos, tendências e categorias detalhadas',
    group: 'Relatórios',
    defaultValue: false,
    paywallLabel: 'Relatórios avançados',
  },
  {
    key: 'insights.monthly',
    type: 'boolean',
    label: 'Insights mensais',
    description: 'Resumo inteligente do mês',
    group: 'Relatórios',
    defaultValue: false,
    paywallLabel: 'Insights do mês',
  },
  {
    key: 'transactions.recurring',
    type: 'boolean',
    label: 'Transações recorrentes',
    description: 'Lançamentos automáticos mensais',
    group: 'Organização',
    defaultValue: false,
    paywallLabel: 'Transações recorrentes',
  },
  {
    key: 'categories.custom',
    type: 'boolean',
    label: 'Categorias personalizadas',
    description: 'Criar e editar categorias',
    group: 'Organização',
    defaultValue: false,
    paywallLabel: 'Categorias personalizadas',
  },
  {
    key: 'budgets.alerts',
    type: 'boolean',
    label: 'Alertas de orçamento',
    description: 'Aviso ao atingir 80% e 100%',
    group: 'Lembretes',
    defaultValue: false,
    paywallLabel: 'Alertas de orçamento',
  },
  {
    key: 'accounts.max',
    type: 'limit',
    label: 'Contas',
    description: 'Quantidade de contas/carteiras',
    group: 'Limites',
    defaultValue: 2,
    paywallLabel: 'Contas e carteiras',
  },
  {
    key: 'budgets.max',
    type: 'limit',
    label: 'Orçamentos',
    description: 'Orçamentos por categoria ativos',
    group: 'Limites',
    defaultValue: 3,
    paywallLabel: 'Orçamentos por categoria',
  },
  {
    key: 'goals.max',
    type: 'limit',
    label: 'Metas',
    description: 'Metas de economia ativas',
    group: 'Limites',
    defaultValue: 1,
    paywallLabel: 'Metas de economia',
  },
  {
    key: 'history.months',
    type: 'limit',
    label: 'Histórico',
    description: 'Meses de histórico visíveis nos relatórios',
    group: 'Limites',
    defaultValue: 3,
    paywallLabel: 'Meses de histórico',
  },
  {
    key: 'members.max',
    type: 'limit',
    label: 'Membros',
    description: 'Pessoas na conta compartilhada (família)',
    group: 'Limites',
    defaultValue: 1,
    paywallLabel: 'Pessoas compartilhando',
  },
  {
    key: 'ads.show',
    type: 'ads',
    label: 'Exibir anúncios',
    description: 'Quando verdadeiro, o app exibe anúncios',
    group: 'Anúncios',
    defaultValue: true,
    paywallLabel: 'Sem anúncios',
  },
] as const satisfies readonly FeatureDefinition[];

export type FeatureKey = (typeof FEATURE_CATALOG)[number]['key'];
export type BooleanFeatureKey = Extract<
  (typeof FEATURE_CATALOG)[number],
  { type: 'boolean' | 'ads' }
>['key'];
export type LimitFeatureKey = Extract<(typeof FEATURE_CATALOG)[number], { type: 'limit' }>['key'];

export const FEATURE_KEYS: FeatureKey[] = FEATURE_CATALOG.map((f) => f.key);

const byKey = new Map<string, FeatureDefinition>(FEATURE_CATALOG.map((f) => [f.key, f]));

export function getFeatureDefinition(key: string): FeatureDefinition | undefined {
  return byKey.get(key);
}

export function isFeatureKey(key: string): key is FeatureKey {
  return byKey.has(key);
}

export function isLimitFeature(key: FeatureKey): key is LimitFeatureKey {
  return byKey.get(key)?.type === 'limit';
}

/** Descreve um valor para UI: "Ilimitado", "3", "Sim"/"Não". */
export function describeFeatureValue(key: FeatureKey, value: FeatureValue): string {
  const def = byKey.get(key);
  if (!def) return String(value);
  if (def.type === 'limit') return value === null ? 'Ilimitado' : String(value);
  if (def.type === 'ads') return value ? 'Com anúncios' : 'Sem anúncios';
  return value ? 'Sim' : 'Não';
}
