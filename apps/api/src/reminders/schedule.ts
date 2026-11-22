import { formatRelativeDay, nextOccurrence, toISODate } from '@app/shared';

/** Fuso de referência (Brasil, sem horário de verão desde 2019): UTC−3. */
export const TZ_OFFSET_MIN = Number(process.env.APP_TZ_OFFSET_MIN ?? -180);

export type Channel = 'push' | 'email' | 'sms' | 'whatsapp';

export interface SchedulableReminder {
  due_at: Date;
  next_occurrence_at: Date | null;
  anchor_day: number | null;
  recurrence: 'none' | 'weekly' | 'monthly' | 'yearly';
  offsets_min: number[];
  channels: Channel[];
  notify_counterparty: boolean;
  counterparty_channels: Channel[];
}

export interface PlannedDelivery {
  occurrence_due_at: Date;
  scheduled_for: Date;
  channel: Channel;
  recipient: 'self' | 'counterparty';
}

/** Data/hora no fuso local de referência (campos UTC do Date retornado = horário local). */
const toLocal = (d: Date) => new Date(d.getTime() + TZ_OFFSET_MIN * 60_000);
const fromLocal = (d: Date) => new Date(d.getTime() - TZ_OFFSET_MIN * 60_000);

export function localDay(d: Date): number {
  return toLocal(d).getUTCDate();
}

/** Próxima ocorrência mantendo o horário local e o dia âncora (31 → 28 fev → 31 mar). */
export function nextOccurrenceAt(
  current: Date,
  recurrence: SchedulableReminder['recurrence'],
  anchorDay: number | null,
): Date | null {
  const local = toLocal(current);
  const iso = local.toISOString().slice(0, 10);
  const next = nextOccurrence(iso, recurrence, anchorDay);
  if (!next) return null;
  const [y, m, d] = next.split('-').map(Number) as [number, number, number];
  const out = new Date(
    Date.UTC(
      y,
      m - 1,
      d,
      local.getUTCHours(),
      local.getUTCMinutes(),
      local.getUTCSeconds(),
      local.getUTCMilliseconds(),
    ),
  );
  return fromLocal(out);
}

/**
 * Envios da ocorrência atual. Antecedências que já passaram (ex.: lembrete criado em cima da
 * hora) viram UM envio imediato, desde que o vencimento ainda não tenha passado.
 */
export function planDeliveries(r: SchedulableReminder, now: Date): PlannedDelivery[] {
  const occurrence = r.next_occurrence_at ?? r.due_at;
  const times = new Set<number>();
  let pastButRelevant = false;
  for (const off of [...new Set(r.offsets_min)]) {
    const t = occurrence.getTime() - off * 60_000;
    if (t >= now.getTime() - 60_000) times.add(t);
    else if (occurrence.getTime() > now.getTime()) pastButRelevant = true;
  }
  if (pastButRelevant && times.size === 0) times.add(now.getTime());

  const targets: { channel: Channel; recipient: 'self' | 'counterparty' }[] = [
    ...r.channels.map((channel) => ({ channel, recipient: 'self' as const })),
    ...(r.notify_counterparty
      ? r.counterparty_channels
          .filter((c) => c !== 'push')
          .map((channel) => ({ channel, recipient: 'counterparty' as const }))
      : []),
  ];

  const out: PlannedDelivery[] = [];
  for (const t of [...times].sort((a, b) => a - b)) {
    for (const target of targets) {
      out.push({ occurrence_due_at: occurrence, scheduled_for: new Date(t), ...target });
    }
  }
  return out;
}

/** "hoje às 09:00", "amanhã às 18:30", "quarta · 25 nov às 10:00", "5 dez às 09:00". */
export function dueText(due: Date, now: Date): string {
  const local = toLocal(due);
  const iso = local.toISOString().slice(0, 10);
  const hh = String(local.getUTCHours()).padStart(2, '0');
  const mm = String(local.getUTCMinutes()).padStart(2, '0');
  const today = toLocal(now);
  const rel = formatRelativeDay(
    iso,
    new Date(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const day = rel.startsWith('Hoje')
    ? 'hoje'
    : rel.startsWith('Amanhã')
      ? 'amanhã'
      : rel.startsWith('Ontem')
        ? 'ontem'
        : rel.toLowerCase().includes('·')
          ? rel.split(' · ')[1]!
          : rel;
  return `${day} às ${hh}:${mm}`;
}

export { toISODate };
