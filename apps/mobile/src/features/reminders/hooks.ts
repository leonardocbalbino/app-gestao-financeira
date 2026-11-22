import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Reminder, ReminderChannel, ReminderInput } from '@app/shared';
import { api, ApiRequestError, isApiConfigured } from '@/lib/api';
import { useAuth } from '@/auth/AuthProvider';

export interface ReminderDto extends Reminder {
  nextDeliveryAt: string | null;
}

export interface DeliveryDto {
  id: string;
  channel: ReminderChannel;
  recipient: 'self' | 'counterparty';
  status: 'pending' | 'sending' | 'sent' | 'simulated' | 'failed' | 'skipped';
  scheduled_for: string;
  sent_at: string | null;
  last_error: string | null;
}

export interface Profile {
  id: string;
  email: string | null;
  is_anonymous: boolean;
  display_name: string | null;
  phone: string | null;
  email_opt_in: boolean;
  sms_opt_in: boolean;
  whatsapp_opt_in: boolean;
}

export const reminderKeys = {
  all: ['reminders'] as const,
  list: ['reminders', 'list'] as const,
  deliveries: (id: string) => ['reminders', 'deliveries', id] as const,
  profile: ['profile'] as const,
};

/** Lembretes vivem no servidor (o envio por push/SMS/WhatsApp/e-mail é feito lá). */
export function useReminders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: reminderKeys.list,
    queryFn: () => api<ReminderDto[]>('GET', '/reminders'),
    enabled: isApiConfigured() && !!user,
    refetchOnWindowFocus: true,
  });
}

export function useDeliveries(id: string | undefined) {
  return useQuery({
    queryKey: reminderKeys.deliveries(id ?? ''),
    queryFn: () => api<DeliveryDto[]>('GET', `/reminders/${id}/deliveries`),
    enabled: !!id,
  });
}

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: reminderKeys.profile,
    queryFn: () => api<Profile>('GET', '/me'),
    enabled: isApiConfigured() && !!user,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      body: Partial<{
        displayName: string | null;
        phone: string | null;
        emailOptIn: boolean;
        smsOptIn: boolean;
        whatsappOptIn: boolean;
      }>,
    ) => api<Profile>('PATCH', '/me', { body }),
    onSuccess: (p) => qc.setQueryData(reminderKeys.profile, p),
  });
}

export function useSaveReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ReminderInput }) =>
      id
        ? api<ReminderDto>('PUT', `/reminders/${id}`, { body: input })
        : api<ReminderDto>('POST', '/reminders', { body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: reminderKeys.all }),
  });
}

export function useReminderAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: { id: string; action: 'done' | 'pause' | 'resume' | 'delete' }) => {
      if (a.action === 'delete') return api('DELETE', `/reminders/${a.id}`);
      if (a.action === 'done') return api('POST', `/reminders/${a.id}/done`);
      return api('POST', `/reminders/${a.id}/status`, {
        body: { status: a.action === 'pause' ? 'paused' : 'active' },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: reminderKeys.all }),
  });
}

export function useTestReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { id: string; channel: ReminderChannel }) =>
      api<{ outcome: string; status: string; last_error: string | null }>(
        'POST',
        `/reminders/${a.id}/test`,
        {
          body: { channel: a.channel },
        },
      ),
    onSuccess: (_r, a) => qc.invalidateQueries({ queryKey: reminderKeys.deliveries(a.id) }),
  });
}

/** Códigos da API que pedem upgrade (limite/canal pago). */
export function upgradeFeatureFromError(e: unknown): string | null {
  if (!(e instanceof ApiRequestError)) return null;
  const m = e.code.match(/^(limit_reached|feature_required):(.+)$/);
  return m ? m[2]! : null;
}
