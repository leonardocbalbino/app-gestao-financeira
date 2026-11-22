import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { dueText, nextOccurrenceAt, planDeliveries } from '../src/reminders/schedule.ts';
import { setupApp } from './helpers.ts';

const t = setupApp();
afterAll(() => t.close());
beforeEach(async () => {
  t.clock.now = new Date();
  for (const k of ['email', 'push', 'sms', 'whatsapp'] as const) t.sent[k].length = 0;
  // Isola os testes: envios agendados por testes anteriores não entram na contagem.
  await t.db.service.query(
    "update public.reminder_deliveries set status = 'cancelled' where status = 'pending'",
  );
  await t.db.service.query("update public.reminders set status = 'paused' where status = 'active'");
});

const H = 3600_000;
const reminderEmails = () => t.sent.email.filter((m) => !m.subject.includes('código de acesso'));
const iso = (d: Date) => d.toISOString();

function body(over: Record<string, unknown> = {}) {
  return {
    kind: 'payment',
    title: 'Conta de luz',
    amountCents: 12000,
    dueAt: iso(new Date(Date.now() + 48 * H)),
    recurrence: 'none',
    offsetsMin: [1440],
    channels: ['push', 'email'],
    counterpartyName: null,
    counterpartyPhone: null,
    counterpartyEmail: null,
    notifyCounterparty: false,
    counterpartyChannels: [],
    note: null,
    ...over,
  };
}

async function pro(email: string, phone = '+5511988887777') {
  const s = await t.loginEmail(email);
  await t.db.service.query(
    "insert into public.manual_grants (user_id, plan_id, reason) values ($1, 'pro', 'teste')",
    [s.user.id],
  );
  await t.call('PATCH', '/v1/me', {
    token: s.accessToken,
    body: { phone, smsOptIn: true, whatsappOptIn: true },
  });
  return s;
}

describe('agendamento (puro)', () => {
  it('antecedências viram envios; atrasadas colapsam em um envio imediato', () => {
    const now = new Date('2026-11-21T12:00:00Z');
    const base = {
      due_at: new Date('2026-11-23T12:00:00Z'),
      next_occurrence_at: null,
      anchor_day: 23,
      recurrence: 'none' as const,
      offsets_min: [1440, 0],
      channels: ['push' as const, 'sms' as const],
      notify_counterparty: false,
      counterparty_channels: [],
    };
    const p = planDeliveries(base, now);
    expect(p).toHaveLength(4);
    expect(p[0]!.scheduled_for.toISOString()).toBe('2026-11-22T12:00:00.000Z');
    const late = planDeliveries(
      { ...base, due_at: new Date('2026-11-21T14:00:00Z'), offsets_min: [1440, 600] },
      now,
    );
    expect(late.map((x) => x.scheduled_for.toISOString())).toEqual([iso(now), iso(now)]);
    expect(planDeliveries({ ...base, due_at: new Date('2026-11-20T12:00:00Z') }, now)).toHaveLength(
      0,
    );
  });

  it('recorrência mensal mantém horário local e dia 31', () => {
    // 31 jan 09:00 BRT = 12:00Z
    const feb = nextOccurrenceAt(new Date('2026-01-31T12:00:00Z'), 'monthly', 31)!;
    expect(feb.toISOString()).toBe('2026-02-28T12:00:00.000Z');
    expect(nextOccurrenceAt(feb, 'monthly', 31)!.toISOString()).toBe('2026-03-31T12:00:00.000Z');
  });

  it('texto do vencimento no fuso de Brasília', () => {
    const now = new Date('2026-11-21T15:00:00Z'); // 12:00 BRT
    expect(dueText(new Date('2026-11-21T20:30:00Z'), now)).toBe('hoje às 17:30');
    expect(dueText(new Date('2026-11-22T12:00:00Z'), now)).toBe('amanhã às 09:00');
    expect(dueText(new Date('2026-12-05T12:00:00Z'), now)).toBe('5 dez às 09:00');
  });
});

describe('lembretes via API + worker', () => {
  it('Free: push+e-mail ok; SMS/WhatsApp exigem Pro; limite de 3', async () => {
    const s = await t.loginEmail('free@lembretes.dev');
    const sms = await t.call<{ error: string }>('POST', '/v1/reminders', {
      token: s.accessToken,
      body: body({ channels: ['sms'] }),
    });
    expect(sms.status).toBe(409);
    expect(sms.body.error).toBe('feature_required:reminders.sms');
    for (let i = 0; i < 3; i++) {
      expect(
        (
          await t.call('POST', '/v1/reminders', {
            token: s.accessToken,
            body: body({ title: `R${i}` }),
          })
        ).status,
      ).toBe(201);
    }
    const fourth = await t.call<{ error: string }>('POST', '/v1/reminders', {
      token: s.accessToken,
      body: body(),
    });
    expect(fourth.body.error).toBe('limit_reached:reminders.max');
  });

  it('envia no horário: e-mail entregue, push ignorado sem aparelho, depois com aparelho', async () => {
    const s = await t.loginEmail('envio@lembretes.dev');
    const created = await t.call<{ id: string; nextDeliveryAt: string }>('POST', '/v1/reminders', {
      token: s.accessToken,
      body: body(),
    });
    expect(created.status).toBe(201);
    // Antes do horário: nada
    expect((await t.deps.dispatcher.tick()).processed).toBe(0);

    t.clock.now = new Date(new Date(created.body.nextDeliveryAt).getTime() + 1000);
    const r = await t.deps.dispatcher.tick();
    expect(r).toMatchObject({ processed: 2, sent: 1, skipped: 1 });
    expect(reminderEmails()[0]).toMatchObject({
      to: 'envio@lembretes.dev',
      subject: 'Pagamento: Conta de luz',
    });
    expect(reminderEmails()[0]!.text).toContain('R$ 120,00');

    const hist = await t.call<{ channel: string; status: string; last_error: string | null }[]>(
      'GET',
      `/v1/reminders/${created.body.id}/deliveries`,
      { token: s.accessToken },
    );
    expect(hist.body.find((h) => h.channel === 'push')).toMatchObject({ status: 'skipped' });

    await t.call('POST', '/v1/me/push-tokens', {
      token: s.accessToken,
      body: { token: 'ExponentPushToken[abc123]', platform: 'android' },
    });
    const test = await t.call<{ outcome: string; status: string }>(
      'POST',
      `/v1/reminders/${created.body.id}/test`,
      {
        token: s.accessToken,
        body: { channel: 'push' },
      },
    );
    expect(test.body).toMatchObject({ outcome: 'sent', status: 'sent' });
    expect(t.sent.push[0]).toMatchObject({
      tokens: ['ExponentPushToken[abc123]'],
      title: 'Pagamento: Conta de luz',
    });
  });

  it('Pro: cobrança avisa o devedor por WhatsApp e e-mail e o usuário por SMS', async () => {
    const s = await pro('pro@lembretes.dev');
    const created = await t.call<{ id: string }>('POST', '/v1/reminders', {
      token: s.accessToken,
      body: body({
        kind: 'charge',
        title: 'Aluguel do quarto',
        amountCents: 80000,
        dueAt: iso(new Date(Date.now() + 2 * H)), // antecedência de 1 dia já passou → envio imediato
        channels: ['sms'],
        counterpartyName: 'João',
        counterpartyPhone: '+5521977776666',
        counterpartyEmail: 'joao@exemplo.dev',
        notifyCounterparty: true,
        counterpartyChannels: ['whatsapp', 'email'],
      }),
    });
    expect(created.status).toBe(201);
    const r = await t.deps.dispatcher.tick();
    expect(r.sent).toBe(3);
    expect(t.sent.sms[0]).toMatchObject({ to: '+5511988887777' });
    expect(t.sent.sms[0]!.body).toContain('Lembrete: receber "Aluguel do quarto" de R$ 800,00');
    expect(t.sent.whatsapp[0]).toMatchObject({ to: '+5521977776666' });
    expect(t.sent.whatsapp[0]!.body).toContain('pro lembra: "Aluguel do quarto"');
    expect(reminderEmails()[0]).toMatchObject({
      to: 'joao@exemplo.dev',
      subject: 'Lembrete de cobrança: Aluguel do quarto',
    });
  });

  it('rebaixado para Free: SMS pendente é ignorado na hora do envio', async () => {
    const s = await pro('rebaixado@lembretes.dev');
    await t.call('POST', '/v1/reminders', {
      token: s.accessToken,
      body: body({ channels: ['sms'], dueAt: iso(new Date(Date.now() + 2 * H)) }),
    });
    await t.db.service.query(
      'update public.manual_grants set revoked_at = now() where user_id = $1',
      [s.user.id],
    );
    const r = await t.deps.dispatcher.tick();
    expect(r).toMatchObject({ skipped: 1, sent: 0 });
    expect(t.sent.sms).toHaveLength(0);
  });

  it('falha temporária tenta de novo com backoff; definitiva para', async () => {
    const s = await t.loginEmail('falha@lembretes.dev');
    const orig = t.deps.providers.email;
    let calls = 0;
    t.deps.providers.email = async () => {
      calls++;
      throw new Error('smtp fora do ar');
    };
    try {
      await t.call('POST', '/v1/reminders', {
        token: s.accessToken,
        body: body({ channels: ['email'], dueAt: iso(new Date(Date.now() + 2 * H)) }),
      });
      expect((await t.deps.dispatcher.tick()).failed).toBe(1);
      expect((await t.deps.dispatcher.tick()).processed).toBe(0); // aguardando backoff
      t.clock.now = new Date(Date.now() + 10 * 60_000);
      await t.deps.dispatcher.tick();
      t.clock.now = new Date(Date.now() + 30 * 60_000);
      await t.deps.dispatcher.tick();
      expect(calls).toBe(3);
      const { rows } = await t.db.service.query(
        "select status, attempts from public.reminder_deliveries where user_id = $1 and channel = 'email'",
        [s.user.id],
      );
      expect(rows[0]).toMatchObject({ status: 'failed', attempts: 3 });
    } finally {
      t.deps.providers.email = orig;
    }
  });

  it('pago: recorrente avança para o próximo mês; único é concluído e cancela pendentes', async () => {
    const s = await t.loginEmail('pago@lembretes.dev');
    const due = new Date(Date.now() + 5 * 24 * H);
    const rec = await t.call<{ id: string; nextOccurrenceAt: string }>('POST', '/v1/reminders', {
      token: s.accessToken,
      body: body({ recurrence: 'monthly', dueAt: iso(due) }),
    });
    const done = await t.call<{ nextOccurrenceAt: string; status: string }>(
      'POST',
      `/v1/reminders/${rec.body.id}/done`,
      {
        token: s.accessToken,
      },
    );
    expect(done.body.status).toBe('active');
    expect(new Date(done.body.nextOccurrenceAt).getTime()).toBeGreaterThan(
      due.getTime() + 27 * 24 * H,
    );

    const once = await t.call<{ id: string }>('POST', '/v1/reminders', {
      token: s.accessToken,
      body: body(),
    });
    const fin = await t.call<{ status: string }>('POST', `/v1/reminders/${once.body.id}/done`, {
      token: s.accessToken,
    });
    expect(fin.body.status).toBe('done');
    const { rows } = await t.db.service.query(
      "select count(*)::int as n from public.reminder_deliveries where reminder_id = $1 and status = 'pending'",
      [once.body.id],
    );
    expect(rows[0].n).toBe(0);
  });

  it('recorrência avança sozinha depois que o vencimento passa', async () => {
    const s = await t.loginEmail('auto@lembretes.dev');
    const due = new Date(Date.now() + 2 * H);
    const r = await t.call<{ id: string }>('POST', '/v1/reminders', {
      token: s.accessToken,
      body: body({ recurrence: 'weekly', dueAt: iso(due), channels: ['email'] }),
    });
    t.clock.now = new Date(due.getTime() + H);
    const rep = await t.deps.dispatcher.tick();
    expect(rep.advanced).toBe(1);
    const list = await t.call<{ id: string; nextOccurrenceAt: string }[]>('GET', '/v1/reminders', {
      token: s.accessToken,
    });
    const item = list.body.find((x) => x.id === r.body.id)!;
    expect(new Date(item.nextOccurrenceAt).getTime()).toBe(due.getTime() + 7 * 24 * H);
  });

  it('lembretes são privados', async () => {
    const a = await t.loginEmail('a@privado.dev');
    const b = await t.loginEmail('b@privado.dev');
    const r = await t.call<{ id: string }>('POST', '/v1/reminders', {
      token: a.accessToken,
      body: body(),
    });
    expect(
      (await t.call('GET', `/v1/reminders/${r.body.id}/deliveries`, { token: b.accessToken }))
        .status,
    ).toBe(404);
    expect(
      (await t.call('DELETE', `/v1/reminders/${r.body.id}`, { token: b.accessToken })).status,
    ).toBe(404);
  });
});
