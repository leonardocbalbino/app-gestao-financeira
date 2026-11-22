import { Hono } from 'hono';
import { z } from 'zod';
import { reminderChannelSchema, reminderInputSchema, type ReminderInput } from '@app/shared';
import { asUser, type Queryable } from '../db.ts';
import { ApiError, requireUser, type AppEnv, type Deps } from '../context.ts';
import { localDay, nextOccurrenceAt } from '../reminders/schedule.ts';

interface Row {
  id: string;
  kind: 'payment' | 'charge';
  title: string;
  amount_cents: number | null;
  due_at: Date;
  recurrence: ReminderInput['recurrence'];
  offsets_min: number[];
  channels: ReminderInput['channels'];
  counterparty_name: string | null;
  counterparty_phone: string | null;
  counterparty_email: string | null;
  notify_counterparty: boolean;
  counterparty_channels: ReminderInput['counterpartyChannels'];
  note: string | null;
  status: 'active' | 'paused' | 'done';
  next_occurrence_at: Date | null;
  anchor_day: number | null;
  created_at: Date;
  next_delivery_at?: Date | null;
}

const toDto = (r: Row) => ({
  id: r.id,
  kind: r.kind,
  title: r.title,
  amountCents: r.amount_cents,
  dueAt: r.due_at.toISOString(),
  recurrence: r.recurrence,
  offsetsMin: r.offsets_min,
  channels: r.channels,
  counterpartyName: r.counterparty_name,
  counterpartyPhone: r.counterparty_phone,
  counterpartyEmail: r.counterparty_email,
  notifyCounterparty: r.notify_counterparty,
  counterpartyChannels: r.counterparty_channels,
  note: r.note,
  status: r.status,
  nextOccurrenceAt: (r.next_occurrence_at ?? r.due_at).toISOString(),
  nextDeliveryAt: r.next_delivery_at ? r.next_delivery_at.toISOString() : null,
  createdAt: r.created_at.toISOString(),
});

const SELECT = `select r.*, (select min(scheduled_for) from public.reminder_deliveries d
                 where d.reminder_id = r.id and d.status = 'pending') as next_delivery_at
                from public.reminders r`;

function values(v: ReminderInput) {
  const due = new Date(v.dueAt);
  return [
    v.kind,
    v.title,
    v.amountCents,
    due,
    v.recurrence,
    v.offsetsMin,
    v.channels,
    v.counterpartyName,
    v.counterpartyPhone,
    v.counterpartyEmail?.toLowerCase() ?? null,
    v.notifyCounterparty,
    v.notifyCounterparty ? v.counterpartyChannels : [],
    v.note,
    localDay(due),
  ];
}

export function reminderRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  const parse = async (c: { req: { json: () => Promise<unknown> } }) => {
    const body = reminderInputSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ApiError(422, 'invalid_reminder', body.error.issues[0]?.message);
    return body.data;
  };

  const getOne = async (q: Queryable, id: string) => {
    const { rows } = await q.query<Row>(`${SELECT} where r.id = $1 and r.deleted_at is null`, [id]);
    if (!rows[0]) throw new ApiError(404, 'not_found');
    return rows[0];
  };

  r.get('/', async (c) => {
    const uid = requireUser(c.get('userId'));
    const rows = await asUser(
      d.db.api,
      uid,
      async (q) =>
        (
          await q.query<Row>(
            `${SELECT} where r.deleted_at is null order by r.status = 'done', coalesce(r.next_occurrence_at, r.due_at)`,
          )
        ).rows,
    );
    return c.json(rows.map(toDto));
  });

  r.post('/', async (c) => {
    const uid = requireUser(c.get('userId'));
    const v = await parse(c);
    const row = await asUser(d.db.api, uid, async (q) => {
      const { rows } = await q.query<{ id: string }>(
        `insert into public.reminders
           (kind, title, amount_cents, due_at, recurrence, offsets_min, channels, counterparty_name,
            counterparty_phone, counterparty_email, notify_counterparty, counterparty_channels, note,
            anchor_day, next_occurrence_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$4) returning id`,
        values(v),
      );
      return rows[0]!;
    });
    await d.dispatcher.reschedule(row.id);
    const out = await asUser(d.db.api, uid, (q) => getOne(q, row.id));
    return c.json(toDto(out), 201);
  });

  r.put('/:id', async (c) => {
    const uid = requireUser(c.get('userId'));
    const id = c.req.param('id');
    const v = await parse(c);
    await asUser(d.db.api, uid, async (q) => {
      await getOne(q, id);
      await q.query(
        `update public.reminders set kind=$2, title=$3, amount_cents=$4, due_at=$5, recurrence=$6, offsets_min=$7,
            channels=$8, counterparty_name=$9, counterparty_phone=$10, counterparty_email=$11,
            notify_counterparty=$12, counterparty_channels=$13, note=$14, anchor_day=$15,
            next_occurrence_at=$5, status = case when status = 'done' then 'active' else status end,
            completed_at = null
          where id = $1`,
        [id, ...values(v)],
      );
    });
    await d.dispatcher.reschedule(id);
    return c.json(toDto(await asUser(d.db.api, uid, (q) => getOne(q, id))));
  });

  r.post('/:id/status', async (c) => {
    const uid = requireUser(c.get('userId'));
    const id = c.req.param('id');
    const body = z
      .object({ status: z.enum(['active', 'paused']) })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ApiError(422, 'invalid_status');
    await asUser(d.db.api, uid, async (q) => {
      await getOne(q, id);
      await q.query('update public.reminders set status = $2 where id = $1', [
        id,
        body.data.status,
      ]);
    });
    await d.dispatcher.reschedule(id);
    return c.json(toDto(await asUser(d.db.api, uid, (q) => getOne(q, id))));
  });

  /**
   * Pago/recebido. Recorrente: avança para a próxima ocorrência e reagenda.
   * Único: conclui e cancela os envios pendentes.
   */
  r.post('/:id/done', async (c) => {
    const uid = requireUser(c.get('userId'));
    const id = c.req.param('id');
    await asUser(d.db.api, uid, async (q) => {
      const cur = await getOne(q, id);
      const occurrence = cur.next_occurrence_at ?? cur.due_at;
      const next = nextOccurrenceAt(occurrence, cur.recurrence, cur.anchor_day);
      if (next) {
        await q.query('update public.reminders set next_occurrence_at = $2 where id = $1', [
          id,
          next,
        ]);
      } else {
        await q.query(
          "update public.reminders set status = 'done', completed_at = now() where id = $1",
          [id],
        );
      }
    });
    await d.dispatcher.reschedule(id);
    return c.json(toDto(await asUser(d.db.api, uid, (q) => getOne(q, id))));
  });

  r.delete('/:id', async (c) => {
    const uid = requireUser(c.get('userId'));
    const id = c.req.param('id');
    await asUser(d.db.api, uid, async (q) => {
      await getOne(q, id);
      await q.query('update public.reminders set deleted_at = now() where id = $1', [id]);
    });
    await d.dispatcher.reschedule(id);
    return c.json({ ok: true });
  });

  r.get('/:id/deliveries', async (c) => {
    const uid = requireUser(c.get('userId'));
    const id = c.req.param('id');
    const rows = await asUser(d.db.api, uid, async (q) => {
      await getOne(q, id);
      const res = await q.query(
        `select id, channel, recipient, status, scheduled_for, sent_at, last_error
           from public.reminder_deliveries where reminder_id = $1 and status <> 'cancelled'
          order by scheduled_for desc limit 50`,
        [id],
      );
      return res.rows;
    });
    return c.json(rows);
  });

  /** Envia agora, só para o próprio usuário, para testar o canal. */
  r.post('/:id/test', async (c) => {
    const uid = requireUser(c.get('userId'));
    const id = c.req.param('id');
    const body = z
      .object({ channel: reminderChannelSchema })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ApiError(422, 'invalid_channel');
    const recent = await d.db.service.query<{ n: number }>(
      `select count(*)::int as n from public.reminder_deliveries
        where user_id = $1 and created_at > now() - interval '1 hour' and scheduled_for >= created_at - interval '1 second'
          and status in ('sent','simulated','failed','skipped') and attempts >= 3`,
      [uid],
    );
    if ((recent.rows[0]?.n ?? 0) >= 10)
      throw new ApiError(429, 'rate_limited', 'Muitos testes na última hora.');
    await asUser(d.db.api, uid, (q) => getOne(q, id));
    const outcome = await d.dispatcher.sendTest(id, uid, body.data.channel);
    const { rows } = await d.db.service.query(
      `select status, last_error, provider from public.reminder_deliveries
        where reminder_id = $1 and channel = $2 order by created_at desc limit 1`,
      [id, body.data.channel],
    );
    return c.json({ outcome, ...rows[0] });
  });

  return r;
}
