import { brand, formatBRL, reminderMessage } from '@app/shared';
import type { Db, Queryable } from '../db.ts';
import { ProviderError, type ChannelProviders, type SendResult } from '../channels/types.ts';
import {
  dueText,
  nextOccurrenceAt,
  planDeliveries,
  type Channel,
  type SchedulableReminder,
} from './schedule.ts';

const MAX_ATTEMPTS = 3;
const BATCH = 50;

interface ReminderRow extends SchedulableReminder {
  id: string;
  user_id: string;
  kind: 'payment' | 'charge';
  title: string;
  amount_cents: number | null;
  status: 'active' | 'paused' | 'done';
  deleted_at: Date | null;
  counterparty_name: string | null;
  counterparty_phone: string | null;
  counterparty_email: string | null;
  note: string | null;
}

interface DeliveryRow {
  id: string;
  reminder_id: string;
  user_id: string;
  occurrence_due_at: Date;
  channel: Channel;
  recipient: 'self' | 'counterparty';
  attempts: number;
}

interface UserRow {
  email: string | null;
  phone: string | null;
  display_name: string | null;
  email_opt_in: boolean;
  sms_opt_in: boolean;
  whatsapp_opt_in: boolean;
}

export interface TickReport {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  advanced: number;
}

class SkipError extends Error {}

/**
 * Worker de lembretes. Seguro para várias instâncias em paralelo (FOR UPDATE SKIP LOCKED).
 * Usa o pool de serviço (BYPASSRLS): todas as decisões de acesso são feitas aqui.
 */
export class ReminderDispatcher {
  constructor(
    private db: Db,
    private providers: ChannelProviders,
    private appName: string = brand.name,
    private clock: () => Date = () => new Date(),
  ) {}

  /** (Re)agenda os envios pendentes da ocorrência atual de um lembrete. */
  async reschedule(reminderId: string, client?: Queryable): Promise<number> {
    const run = async (c: Queryable) => {
      const { rows } = await c.query<ReminderRow>('select * from public.reminders where id = $1', [
        reminderId,
      ]);
      const r = rows[0];
      await c.query(
        "update public.reminder_deliveries set status = 'cancelled' where reminder_id = $1 and status = 'pending'",
        [reminderId],
      );
      if (!r || r.deleted_at || r.status !== 'active') return 0;
      const planned = planDeliveries(r, this.clock());
      for (const p of planned) {
        await c.query(
          `insert into public.reminder_deliveries
             (reminder_id, user_id, occurrence_due_at, scheduled_for, channel, recipient)
           values ($1, $2, $3, $4, $5, $6)
           on conflict (reminder_id, occurrence_due_at, scheduled_for, channel, recipient)
           do update set status = 'pending', attempts = 0, last_error = null
           where public.reminder_deliveries.status in ('cancelled')`,
          [r.id, r.user_id, p.occurrence_due_at, p.scheduled_for, p.channel, p.recipient],
        );
      }
      return planned.length;
    };
    if (client) return run(client);
    const c = await this.db.service.connect();
    try {
      await c.query('begin');
      const n = await run(c);
      await c.query('commit');
      return n;
    } catch (e) {
      await c.query('rollback');
      throw e;
    } finally {
      c.release();
    }
  }

  /** Uma rodada: recupera travados, avança recorrências e envia o que venceu. */
  async tick(): Promise<TickReport> {
    const report: TickReport = { processed: 0, sent: 0, failed: 0, skipped: 0, advanced: 0 };
    await this.db.service.query(
      `update public.reminder_deliveries set status = 'pending'
        where status = 'sending' and created_at < now() - interval '10 minutes'`,
    );
    report.advanced = await this.advanceRecurring();
    await this.ensureScheduled();

    const { rows: batch } = await this.db.service.query<DeliveryRow>(
      `update public.reminder_deliveries d set status = 'sending', attempts = d.attempts + 1
        where d.id in (
          select id from public.reminder_deliveries
           where status = 'pending' and scheduled_for <= $1
           order by scheduled_for limit $2
           for update skip locked)
        returning d.id, d.reminder_id, d.user_id, d.occurrence_due_at, d.channel, d.recipient, d.attempts`,
      [this.clock(), BATCH],
    );

    for (const d of batch) {
      report.processed++;
      const outcome = await this.deliver(d);
      report[outcome]++;
    }
    return report;
  }

  /** Lembretes ativos sem nenhum envio na ocorrência atual (ex.: importados/semeados) são agendados. */
  private async ensureScheduled(): Promise<void> {
    const { rows } = await this.db.service.query<{ id: string }>(
      `select r.id from public.reminders r
        where r.deleted_at is null and r.status = 'active'
          and coalesce(r.next_occurrence_at, r.due_at) > $1
          and not exists (select 1 from public.reminder_deliveries d
                           where d.reminder_id = r.id
                             and d.occurrence_due_at = coalesce(r.next_occurrence_at, r.due_at))
        limit 100`,
      [this.clock()],
    );
    for (const r of rows) await this.reschedule(r.id);
  }

  /** Recorrentes cuja ocorrência passou: calcula a próxima e agenda. */
  private async advanceRecurring(): Promise<number> {
    const now = this.clock();
    const { rows } = await this.db.service.query<ReminderRow>(
      `select * from public.reminders
        where deleted_at is null and status = 'active' and recurrence <> 'none'
          and coalesce(next_occurrence_at, due_at) < $1`,
      [now],
    );
    let n = 0;
    for (const r of rows) {
      let next: Date | null = r.next_occurrence_at ?? r.due_at;
      let guard = 0;
      while (next && next < now && guard++ < 500)
        next = nextOccurrenceAt(next, r.recurrence, r.anchor_day);
      if (!next) continue;
      await this.db.service.query(
        'update public.reminders set next_occurrence_at = $2 where id = $1',
        [r.id, next],
      );
      await this.reschedule(r.id);
      n++;
    }
    return n;
  }

  private async deliver(d: DeliveryRow, noRetry = false): Promise<'sent' | 'failed' | 'skipped'> {
    try {
      const { rows: rr } = await this.db.service.query<ReminderRow>(
        'select * from public.reminders where id = $1',
        [d.reminder_id],
      );
      const r = rr[0];
      if (!r || r.deleted_at || r.status !== 'active') throw new SkipError('lembrete inativo');
      const { rows: ur } = await this.db.service.query<UserRow>(
        'select email, phone, display_name, email_opt_in, sms_opt_in, whatsapp_opt_in from public.users where id = $1',
        [d.user_id],
      );
      const user = ur[0];
      if (!user) throw new SkipError('usuário removido');

      if (d.channel === 'sms' || d.channel === 'whatsapp') {
        const { rows: ent } = await this.db.service.query<{ ok: boolean }>(
          "select coalesce((public.get_entitlements($1) -> 'features' ->> $2)::boolean, false) as ok",
          [d.user_id, `reminders.${d.channel}`],
        );
        if (!ent[0]?.ok) throw new SkipError(`plano não inclui ${d.channel}`);
      }

      const now = this.clock();
      const body = reminderMessage({
        kind: r.kind,
        title: r.title,
        amountText: r.amount_cents ? formatBRL(r.amount_cents) : null,
        dueText: dueText(d.occurrence_due_at, now),
        recipient: d.recipient,
        senderName: user.display_name ?? user.email?.split('@')[0] ?? null,
        appName: this.appName,
      });
      const result = await this.send(d, r, user, body);
      if (result.invalidTokens?.length) await this.invalidateTokens(result.invalidTokens);
      await this.db.service.query(
        `update public.reminder_deliveries
            set status = $2, provider = $3, provider_message_id = $4, sent_at = now(), last_error = null
          where id = $1`,
        [d.id, result.status, result.provider, result.messageId ?? null],
      );
      return 'sent';
    } catch (e) {
      if (e instanceof SkipError) {
        await this.db.service.query(
          "update public.reminder_deliveries set status = 'skipped', last_error = $2 where id = $1",
          [d.id, e.message],
        );
        return 'skipped';
      }
      const pe = e instanceof ProviderError ? e : new ProviderError((e as Error).message);
      if (pe.invalidTokens.length) await this.invalidateTokens(pe.invalidTokens);
      const final = pe.permanent || noRetry || d.attempts >= MAX_ATTEMPTS;
      await this.db.service.query(
        `update public.reminder_deliveries
            set status = $2, last_error = $3,
                scheduled_for = case when $2 = 'pending' then now() + ($4 || ' minutes')::interval else scheduled_for end
          where id = $1`,
        [d.id, final ? 'failed' : 'pending', pe.message.slice(0, 500), String(2 ** d.attempts)],
      );
      return 'failed';
    }
  }

  private async send(
    d: DeliveryRow,
    r: ReminderRow,
    user: UserRow,
    body: string,
  ): Promise<SendResult> {
    const subject =
      d.recipient === 'counterparty'
        ? `Lembrete de cobrança: ${r.title}`
        : `${r.kind === 'payment' ? 'Pagamento' : 'Cobrança'}: ${r.title}`;
    const html = `<div style="font-family:sans-serif;color:#14201B"><h2 style="color:#0B6E4F;margin:0 0 8px">${escapeHtml(
      subject,
    )}</h2><p>${escapeHtml(body)}</p>${r.note && d.recipient === 'self' ? `<p style="color:#5B6661">${escapeHtml(r.note)}</p>` : ''}<p style="color:#8C948F;font-size:12px">Enviado por ${escapeHtml(this.appName)}.</p></div>`;

    if (d.recipient === 'counterparty') {
      if (d.channel === 'email') {
        if (!r.counterparty_email) throw new SkipError('devedor sem e-mail');
        return this.providers.email({ to: r.counterparty_email, subject, text: body, html });
      }
      if (!r.counterparty_phone) throw new SkipError('devedor sem celular');
      return d.channel === 'sms'
        ? this.providers.sms(r.counterparty_phone, body)
        : this.providers.whatsapp(r.counterparty_phone, body, { 1: r.title, 2: body });
    }

    switch (d.channel) {
      case 'push': {
        const { rows } = await this.db.service.query<{ token: string }>(
          'select token from public.push_tokens where user_id = $1 and invalid_at is null',
          [d.user_id],
        );
        if (!rows.length) throw new SkipError('nenhum aparelho com notificações ativas');
        return this.providers.push({
          tokens: rows.map((t) => t.token),
          title: subject,
          body,
          data: { url: '/reminders', reminderId: r.id },
        });
      }
      case 'email':
        if (!user.email || !user.email_opt_in)
          throw new SkipError('sem e-mail ou e-mail desativado');
        return this.providers.email({ to: user.email, subject, text: body, html });
      case 'sms':
        if (!user.phone || !user.sms_opt_in)
          throw new SkipError('sem celular ou SMS não autorizado');
        return this.providers.sms(user.phone, body);
      case 'whatsapp':
        if (!user.phone || !user.whatsapp_opt_in)
          throw new SkipError('sem celular ou WhatsApp não autorizado');
        return this.providers.whatsapp(user.phone, body, { 1: r.title, 2: body });
    }
  }

  private async invalidateTokens(tokens: string[]) {
    await this.db.service.query(
      'update public.push_tokens set invalid_at = now() where token = any($1)',
      [tokens],
    );
  }

  /** Envio imediato de teste (só para o próprio usuário), sem esperar o agendamento. */
  async sendTest(
    reminderId: string,
    userId: string,
    channel: Channel,
  ): Promise<'sent' | 'failed' | 'skipped'> {
    const { rows } = await this.db.service.query<DeliveryRow>(
      `insert into public.reminder_deliveries
         (reminder_id, user_id, occurrence_due_at, scheduled_for, channel, recipient, status, attempts)
       select id, user_id, coalesce(next_occurrence_at, due_at), now(), $3, 'self', 'sending', $4
         from public.reminders where id = $1 and user_id = $2 and deleted_at is null
       returning id, reminder_id, user_id, occurrence_due_at, channel, recipient, attempts`,
      [reminderId, userId, channel, 1],
    );
    const d = rows[0];
    if (!d) return 'skipped';
    return this.deliver(d, true);
  }
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
