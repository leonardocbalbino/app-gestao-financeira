import * as Notifications from 'expo-notifications';
import { addDays, formatBRL, formatShortDate, fromISODate } from '@app/shared';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

export interface ReminderBill {
  id: string;
  name: string;
  amountCents: number;
  dueDate: string;
  remindDaysBefore: number;
}

/** Data/hora do lembrete: N dias antes do vencimento, às 9h. Null se já passou. */
export function reminderDate(bill: ReminderBill, now: Date = new Date()): Date | null {
  const day = fromISODate(addDays(bill.dueDate, -bill.remindDaysBefore));
  day.setHours(9, 0, 0, 0);
  return day.getTime() > now.getTime() ? day : null;
}

/** Agenda lembrete local de conta a pagar. Retorna o id da notificação (ou null). */
export async function scheduleBillReminder(bill: ReminderBill): Promise<string | null> {
  const when = reminderDate(bill);
  if (!when) return null;
  if (!(await ensureNotificationPermission())) return null;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: `${bill.name} vence ${bill.remindDaysBefore === 0 ? 'hoje' : `em ${formatShortDate(bill.dueDate)}`}`,
      body: `Valor: ${formatBRL(bill.amountCents)}`,
      data: { billId: bill.id, url: '/bills' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
  });
}

export async function cancelReminder(notificationId: string | null | undefined): Promise<void> {
  if (notificationId) await Notifications.cancelScheduledNotificationAsync(notificationId);
}
