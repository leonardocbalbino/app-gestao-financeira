import { describe, expect, it } from 'vitest';
import { nextOccurrence } from './dates';
import { normalizeBrPhone, reminderInputSchema, reminderMessage } from './reminders';

describe('recorrência com dia âncora', () => {
  it('31 jan → 28 fev → 31 mar (sem desvio)', () => {
    const feb = nextOccurrence('2026-01-31', 'monthly', 31);
    expect(feb).toBe('2026-02-28');
    expect(nextOccurrence(feb!, 'monthly', 31)).toBe('2026-03-31');
    expect(nextOccurrence('2028-02-29', 'yearly', 29)).toBe('2029-02-28');
    expect(nextOccurrence('2026-11-21', 'weekly')).toBe('2026-11-28');
    expect(nextOccurrence('2026-11-21', 'none')).toBeNull();
  });
});

describe('telefone', () => {
  it('normaliza formatos brasileiros', () => {
    expect(normalizeBrPhone('(11) 99999-8888')).toBe('+5511999998888');
    expect(normalizeBrPhone('+55 11 3333-4444')).toBe('+551133334444');
    expect(normalizeBrPhone('5511999998888')).toBe('+5511999998888');
    expect(normalizeBrPhone('123')).toBeNull();
  });
});

describe('reminderInputSchema', () => {
  const base = {
    kind: 'charge' as const,
    title: 'Aluguel do quarto',
    amountCents: 80000,
    dueAt: '2026-12-05T12:00:00.000Z',
    recurrence: 'monthly' as const,
    offsetsMin: [1440],
    channels: ['push' as const],
    counterpartyName: 'João',
    counterpartyPhone: null,
    counterpartyEmail: null,
    notifyCounterparty: false,
    counterpartyChannels: [] as ('email' | 'sms' | 'whatsapp')[],
    note: null,
  };

  it('aceita lembrete simples', () => {
    expect(reminderInputSchema.safeParse(base).success).toBe(true);
  });

  it('exige contato do devedor conforme o canal', () => {
    expect(
      reminderInputSchema.safeParse({
        ...base,
        notifyCounterparty: true,
        counterpartyChannels: ['whatsapp'],
      }).success,
    ).toBe(false);
    expect(
      reminderInputSchema.safeParse({
        ...base,
        notifyCounterparty: true,
        counterpartyChannels: ['whatsapp'],
        counterpartyPhone: '+5511999998888',
      }).success,
    ).toBe(true);
  });

  it('pagamento não avisa terceiros', () => {
    expect(
      reminderInputSchema.safeParse({
        ...base,
        kind: 'payment',
        notifyCounterparty: true,
        counterpartyChannels: ['email'],
        counterpartyEmail: 'a@b.com',
      }).success,
    ).toBe(false);
  });
});

describe('reminderMessage', () => {
  it('para o próprio usuário e para o devedor', () => {
    expect(
      reminderMessage({
        kind: 'payment',
        title: 'Luz',
        amountText: 'R$ 120,00',
        dueText: 'amanhã',
        recipient: 'self',
        appName: 'App',
      }),
    ).toBe('Lembrete: pagar "Luz" de R$ 120,00 — vence amanhã.');
    expect(
      reminderMessage({
        kind: 'charge',
        title: 'Aluguel',
        amountText: null,
        dueText: 'em 5 dez',
        recipient: 'counterparty',
        senderName: 'Ana',
        appName: 'App',
      }),
    ).toBe('Ana lembra: "Aluguel" vence em 5 dez. (enviado pelo App)');
  });
});
