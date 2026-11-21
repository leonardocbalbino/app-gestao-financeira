import { useMemo } from 'react';
import { router } from 'expo-router';
import { monthKey } from '@app/shared';
import { useTheme } from '@/theme/ThemeProvider';
import { Card, EmptyState, Icon, IconBadge, ListItem, Screen } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useBudgets, useOpenBills } from '@/data/hooks';
import { buildAlerts } from '@/features/notifications/alerts';

export default function NotificationsScreen() {
  const t = useTheme();
  const bills = useOpenBills();
  const budgets = useBudgets(monthKey(new Date()));
  const alerts = useMemo(
    () => buildAlerts(bills.data ?? [], budgets.data ?? []),
    [bills.data, budgets.data],
  );

  return (
    <Screen testID="screen-notifications">
      <ScreenHeader title="Notificações" />
      <Card padding={t.spacing.md}>
        {alerts.length === 0 ? (
          <EmptyState
            icon="bell"
            title="Nada por aqui"
            message="Avisaremos sobre contas e orçamentos."
          />
        ) : (
          alerts.map((a, i) => (
            <ListItem
              key={a.id}
              title={a.title}
              subtitle={a.message}
              divider={i < alerts.length - 1}
              onPress={() => router.push(a.href)}
              accessibilityLabel={`${a.severity === 'critical' ? 'Urgente: ' : ''}${a.title}, ${a.message}`}
              left={
                <IconBadge
                  name={a.icon}
                  tint={
                    a.severity === 'critical'
                      ? t.colors.danger
                      : a.severity === 'warning'
                        ? t.colors.pro
                        : t.colors.primary
                  }
                />
              }
              right={<Icon name="chevron-right" color="inkSubtle" />}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}
