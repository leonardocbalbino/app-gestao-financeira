import { describe, expect, it } from 'vitest';
import {
  buildComparisonRows,
  centsFromDigits,
  computeLimitState,
  contrastRatio,
  darkColors,
  fallbackEntitlements,
  formatBRL,
  formatBRLShort,
  formatMonth,
  formatRelativeDay,
  formatShortDate,
  lightColors,
  monthRange,
  addMonths,
  normalizeEntitlements,
  parseBRL,
  transactionFormSchema,
  FEATURE_CATALOG,
} from './index';

describe('formatBRL', () => {
  it('formata com separadores pt-BR', () => {
    expect(formatBRL(123456)).toBe('R$ 1.234,56');
    expect(formatBRL(0)).toBe('R$ 0,00');
    expect(formatBRL(5)).toBe('R$ 0,05');
    expect(formatBRL(100000000)).toBe('R$ 1.000.000,00');
  });
  it('usa menos tipográfico', () => {
    expect(formatBRL(-123456)).toBe('−R$ 1.234,56');
  });
  it('opções', () => {
    expect(formatBRL(1000, { signed: true })).toBe('+R$ 10,00');
    expect(formatBRL(1000, { hideSymbol: true })).toBe('10,00');
    expect(formatBRL(120000, { compactCents: true })).toBe('R$ 1.200');
    expect(formatBRL(Number.NaN)).toBe('R$ 0,00');
  });
  it('formato curto', () => {
    expect(formatBRLShort(120000)).toBe('R$ 1,2 mil');
    expect(formatBRLShort(300000000)).toBe('R$ 3 mi');
    expect(formatBRLShort(4550)).toBe('R$ 46');
  });
});

describe('parseBRL', () => {
  it.each([
    ['1.234,56', 123456],
    ['1234,5', 123450],
    ['1234.56', 123456],
    ['R$ 12', 1200],
    ['1.000', 100000],
    ['−10,00', -1000],
  ])('%s → %d', (input, expected) => {
    expect(parseBRL(input)).toBe(expected);
  });
  it('inválidos', () => {
    expect(parseBRL('')).toBeNull();
    expect(parseBRL('abc')).toBeNull();
    expect(parseBRL('1,234')).toBeNull();
  });
  it('máscara de dígitos', () => {
    expect(centsFromDigits('R$ 1,23')).toBe(123);
    expect(centsFromDigits('')).toBe(0);
  });
});

describe('datas', () => {
  const today = new Date(2026, 10, 21, 10);
  it('formatos curtos', () => {
    expect(formatShortDate('2026-11-21')).toBe('21 nov');
    expect(formatRelativeDay('2026-11-21', today)).toBe('Hoje · 21 nov');
    expect(formatRelativeDay('2026-11-20', today)).toBe('Ontem · 20 nov');
    expect(formatRelativeDay('2026-11-18', today)).toBe('Quarta · 18 nov');
    expect(formatRelativeDay('2026-10-02', today)).toBe('2 out');
    expect(formatRelativeDay('2025-10-02', today)).toBe('2 out 2025');
  });
  it('meses', () => {
    expect(formatMonth('2026-03')).toBe('Março 2026');
    expect(monthRange('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });
});

describe('entitlements', () => {
  it('fallback = defaults do catálogo', () => {
    const e = fallbackEntitlements();
    expect(e.features['export.pdf']).toBe(false);
    expect(e.features['accounts.max']).toBe(2);
    expect(e.features['ads.show']).toBe(true);
    expect(Object.keys(e.features)).toHaveLength(FEATURE_CATALOG.length);
  });
  it('normaliza resposta do servidor e preenche ausentes', () => {
    const e = normalizeEntitlements({
      plan_id: 'pro',
      plan_name: 'Pro',
      source: 'subscription',
      expires_at: null,
      features: {
        'export.pdf': true,
        'accounts.max': null,
        'ads.show': false,
        'unknown.key': true,
      },
      resolved_at: '2026-11-21T00:00:00Z',
    });
    expect(e.features['export.pdf']).toBe(true);
    expect(e.features['accounts.max']).toBeNull();
    expect(e.features['ads.show']).toBe(false);
    expect(e.features['budgets.max']).toBe(3);
  });
  it('estado de limite', () => {
    expect(computeLimitState(3, 1)).toEqual({
      limit: 3,
      used: 1,
      remaining: 2,
      reached: false,
      overBy: 0,
    });
    expect(computeLimitState(3, 5)).toMatchObject({ remaining: 0, reached: true, overBy: 2 });
    expect(computeLimitState(null, 50)).toMatchObject({ remaining: null, reached: false });
  });
  it('tabela comparativa dinâmica', () => {
    const rows = buildComparisonRows({
      plans: [
        { id: 'free', name: 'Free', is_default: true, sort_order: 0, rc_entitlement: null },
        { id: 'pro', name: 'Pro', is_default: false, sort_order: 1, rc_entitlement: 'pro' },
      ],
      values: [{ plan_id: 'pro', feature_key: 'export.pdf', value: true }],
      paywall_keys: ['export.pdf', 'ads.show'],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]?.values).toEqual({ free: false, pro: true });
  });
});

describe('schemas', () => {
  const base = {
    kind: 'expense' as const,
    amountCents: 1000,
    description: 'Mercado',
    categoryId: null,
    accountId: '7d0f6f8e-4b1a-4c2e-9d6b-1f2e3a4b5c6d',
    toAccountId: null,
    date: '2026-11-21',
    notes: null,
    recurrence: 'none' as const,
  };
  it('exige categoria para despesa', () => {
    expect(transactionFormSchema.safeParse(base).success).toBe(false);
    expect(
      transactionFormSchema.safeParse({
        ...base,
        categoryId: '1d0f6f8e-4b1a-4c2e-9d6b-1f2e3a4b5c6d',
      }).success,
    ).toBe(true);
  });
  it('transferência exige contas diferentes', () => {
    const r = transactionFormSchema.safeParse({
      ...base,
      kind: 'transfer',
      toAccountId: base.accountId,
    });
    expect(r.success).toBe(false);
  });
});

describe('tema', () => {
  it('texto principal atende AA em claro e escuro', () => {
    expect(contrastRatio(lightColors.ink, lightColors.bg)).toBeGreaterThan(7);
    expect(contrastRatio(lightColors.inkMuted, lightColors.surface)).toBeGreaterThan(4.5);
    expect(contrastRatio(lightColors.onPrimary, lightColors.primary)).toBeGreaterThan(4.5);
    expect(contrastRatio(darkColors.ink, darkColors.bg)).toBeGreaterThan(7);
    expect(contrastRatio(darkColors.inkMuted, darkColors.surface)).toBeGreaterThan(4.5);
    expect(contrastRatio(darkColors.onPrimary, darkColors.primary)).toBeGreaterThan(4.5);
    expect(contrastRatio(lightColors.danger, lightColors.surface)).toBeGreaterThan(4.5);
    expect(contrastRatio(lightColors.proInk, lightColors.proSoft)).toBeGreaterThan(4.5);
  });
});
