import { z } from 'zod';

export const reminderChannelSchema = z.enum(['push', 'email', 'sms', 'whatsapp']);
export type ReminderChannel = z.infer<typeof reminderChannelSchema>;
export const counterpartyChannelSchema = z.enum(['email', 'sms', 'whatsapp']);
export type CounterpartyChannel = z.infer<typeof counterpartyChannelSchema>;

/** Telefone no formato E.164 (+5511999998888). */
export const e164 = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Use o formato +55DDDNÚMERO');

/** Normaliza telefone brasileiro digitado ("(11) 99999-8888" → "+5511999998888"). */
export function normalizeBrPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (input.trim().startsWith('+')) return /^\d{8,15}$/.test(digits) ? `+${digits}` : null;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55'))
    return `+${digits}`;
  return null;
}

export const reminderInputSchema = z
  .object({
    kind: z.enum(['payment', 'charge']),
    title: z.string().trim().min(1, 'Informe o título').max(60),
    amountCents: z.number().int().positive().nullable(),
    dueAt: z.string().datetime({ offset: true }),
    recurrence: z.enum(['none', 'weekly', 'monthly', 'yearly']),
    offsetsMin: z
      .array(
        z
          .number()
          .int()
          .min(0)
          .max(60 * 24 * 30),
      )
      .min(1)
      .max(4),
    channels: z.array(reminderChannelSchema).min(1, 'Escolha ao menos um canal'),
    counterpartyName: z.string().trim().max(60).nullable(),
    counterpartyPhone: e164.nullable(),
    counterpartyEmail: z.string().email('E-mail inválido').nullable(),
    notifyCounterparty: z.boolean(),
    counterpartyChannels: z.array(counterpartyChannelSchema),
    note: z.string().max(280).nullable(),
  })
  .superRefine((v, ctx) => {
    if (!v.notifyCounterparty) return;
    if (v.kind !== 'charge') {
      ctx.addIssue({
        code: 'custom',
        path: ['notifyCounterparty'],
        message: 'Só cobranças avisam o devedor',
      });
    }
    if (!v.counterpartyChannels.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['counterpartyChannels'],
        message: 'Escolha como avisar o devedor',
      });
    }
    const needsPhone = v.counterpartyChannels.some((c) => c === 'sms' || c === 'whatsapp');
    if (needsPhone && !v.counterpartyPhone) {
      ctx.addIssue({
        code: 'custom',
        path: ['counterpartyPhone'],
        message: 'Informe o celular do devedor',
      });
    }
    if (v.counterpartyChannels.includes('email') && !v.counterpartyEmail) {
      ctx.addIssue({
        code: 'custom',
        path: ['counterpartyEmail'],
        message: 'Informe o e-mail do devedor',
      });
    }
  });
export type ReminderInput = z.infer<typeof reminderInputSchema>;

export interface Reminder extends ReminderInput {
  id: string;
  status: 'active' | 'paused' | 'done';
  nextOccurrenceAt: string | null;
  createdAt: string;
}

export type DeliveryStatus =
  'pending' | 'sending' | 'sent' | 'simulated' | 'failed' | 'skipped' | 'cancelled';

export interface ReminderDelivery {
  id: string;
  reminderId: string;
  channel: ReminderChannel;
  recipient: 'self' | 'counterparty';
  status: DeliveryStatus;
  scheduledFor: string;
  sentAt: string | null;
  lastError: string | null;
}

export const CHANNEL_LABEL: Record<ReminderChannel, string> = {
  push: 'Notificação',
  email: 'E-mail',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
};

/** Mensagem curta (SMS/WhatsApp/push). Sem dados além do necessário. */
export function reminderMessage(r: {
  kind: 'payment' | 'charge';
  title: string;
  amountText: string | null;
  dueText: string;
  recipient: 'self' | 'counterparty';
  senderName?: string | null;
  appName: string;
}): string {
  const amount = r.amountText ? ` de ${r.amountText}` : '';
  if (r.recipient === 'counterparty') {
    const who = r.senderName || 'Um contato';
    return `${who} lembra: "${r.title}"${amount} vence ${r.dueText}. (enviado pelo ${r.appName})`;
  }
  return r.kind === 'payment'
    ? `Lembrete: pagar "${r.title}"${amount} — vence ${r.dueText}.`
    : `Lembrete: receber "${r.title}"${amount} — vence ${r.dueText}.`;
}
