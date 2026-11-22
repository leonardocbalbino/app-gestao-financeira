import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { CHANNEL_LABEL } from '@app/shared';
import { useTheme } from '@/theme/ThemeProvider';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconBadge,
  ListItem,
  MoneyText,
  Screen,
  Segmented,
} from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuth } from '@/auth/AuthProvider';
import { LimitedAddButton } from '@/entitlements';
import { useReminders } from '@/features/reminders/hooks';
import { formatDue } from '@/features/reminders/format';

export default function RemindersScreen() {
  const t = useTheme();
  const { user, online } = useAuth();
  const [kind, setKind] = useState<'payment' | 'charge'>('payment');
  const q = useReminders();
  const items = (q.data ?? []).filter((r) => r.kind === kind);

  return (
    <Screen testID="screen-reminders" refreshControl={undefined}>
      <ScreenHeader title="Lembretes" />
      <AppText variant="body" color="inkMuted">
        Receba avisos de pagamentos e cobranças por notificação, e-mail, SMS ou WhatsApp — mesmo com
        o app fechado.
      </AppText>
      <Segmented
        options={[
          { value: 'payment', label: 'A pagar' },
          { value: 'charge', label: 'A receber' },
        ]}
        value={kind}
        onChange={setKind}
      />

      {!online || !user ? (
        <Card>
          <EmptyState
            icon="bell"
            title="Conecte-se para usar lembretes"
            message="Os avisos são enviados pelo nosso servidor. Verifique sua conexão."
          />
        </Card>
      ) : q.isError ? (
        <ErrorState
          message="Não foi possível carregar seus lembretes."
          onRetry={() => void q.refetch()}
        />
      ) : (
        <Card padding={t.spacing.md}>
          {items.length === 0 ? (
            <EmptyState
              testID="reminders-empty"
              icon={kind === 'payment' ? 'calendar-clock' : 'wallet'}
              title={kind === 'payment' ? 'Nada a pagar por aqui' : 'Nenhuma cobrança'}
              message={
                kind === 'payment'
                  ? 'Crie um lembrete e avisamos você antes do vencimento.'
                  : 'Registre quem te deve e avise a pessoa por WhatsApp, SMS ou e-mail.'
              }
            />
          ) : (
            items.map((r, i) => (
              <ListItem
                key={r.id}
                testID={`reminder-${r.id}`}
                title={r.title}
                subtitle={`${r.status === 'paused' ? 'Pausado · ' : r.status === 'done' ? 'Concluído · ' : ''}${formatDue(
                  r.nextOccurrenceAt ?? r.dueAt,
                )} · ${r.channels.map((c) => CHANNEL_LABEL[c]).join(', ')}`}
                divider={i < items.length - 1}
                dimmed={r.status !== 'active'}
                onPress={() => router.push({ pathname: '/reminders/[id]', params: { id: r.id } })}
                left={
                  <IconBadge
                    name={r.kind === 'payment' ? 'calendar-clock' : 'wallet'}
                    tint={r.kind === 'payment' ? t.colors.danger : t.colors.primary}
                  />
                }
                right={
                  r.amountCents ? (
                    <MoneyText
                      cents={r.amountCents}
                      variant="bodyStrong"
                      tone={r.kind === 'payment' ? 'expense' : 'income'}
                    />
                  ) : undefined
                }
              />
            ))
          )}
        </Card>
      )}

      {online && user ? (
        <LimitedAddButton
          feature="reminders.max"
          label={kind === 'payment' ? 'Novo lembrete de pagamento' : 'Nova cobrança'}
          onPress={() => router.push('/reminders/new')}
          testID="reminder-add"
        />
      ) : null}
      <View style={{ height: t.spacing.sm }} />
      <Button
        label="Canais de contato"
        variant="ghost"
        onPress={() => router.push('/settings/contact')}
      />
    </Screen>
  );
}
