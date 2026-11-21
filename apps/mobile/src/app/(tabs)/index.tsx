import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { formatBRL, formatRelativeDay, greeting, monthKey, percent } from '@app/shared';
import { buildAlerts } from '@/features/notifications/alerts';
import { useFeature } from '@/entitlements';
import { useTheme } from '@/theme/ThemeProvider';
import {
  AppText,
  Card,
  EmptyState,
  Icon,
  IconBadge,
  MoneyText,
  ProgressBar,
  Screen,
  SectionHeader,
} from '@/components/ui';
import { TransactionRow } from '@/components/TransactionRow';
import {
  useAccounts,
  useBudgets,
  useMonthSummary,
  useOpenBills,
  useSpendingByCategory,
  useTransactions,
} from '@/data/hooks';
import { usePrefs } from '@/state/prefs';

export default function HomeScreen() {
  const t = useTheme();
  const budgetAlerts = useFeature('budgets.alerts');
  const month = monthKey(new Date());
  const hide = usePrefs((s) => s.hideBalance);
  const toggleHide = usePrefs((s) => s.toggleHideBalance);
  const accounts = useAccounts();
  const summary = useMonthSummary(month);
  const byCategory = useSpendingByCategory(month);
  const recent = useTransactions({ limit: 5 });
  const openBills = useOpenBills();
  const budgets = useBudgets(month);
  const alerts = useMemo(
    () => buildAlerts(openBills.data ?? [], budgets.data ?? [], { budgetAlerts }),
    [openBills.data, budgets.data, budgetAlerts],
  );
  const nextBill = openBills.data?.[0];

  const total = (accounts.data ?? []).reduce((s, a) => s + a.balanceCents, 0);
  const s = summary.data;
  const topCats = (byCategory.data ?? []).slice(0, 3);
  const maxCat = topCats[0]?.totalCents ?? 0;
  const openTx = (id: string) => router.push({ pathname: '/transaction/[id]', params: { id } });

  return (
    <Screen testID="screen-home">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <AppText variant="caption" color="inkMuted">
            {greeting()}
          </AppText>
          <AppText variant="title" accessibilityRole="header">
            Início
          </AppText>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Pressable
            testID="home-notifications"
            accessibilityRole="button"
            accessibilityLabel={
              alerts.length ? `Notificações, ${alerts.length} alerta(s)` : 'Notificações'
            }
            onPress={() => router.push('/notifications')}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="bell" size={22} color="inkMuted" />
            {alerts.length ? (
              <View
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  paddingHorizontal: 3,
                  backgroundColor: t.colors.danger,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppText variant="micro" style={{ color: '#FFFFFF', fontSize: 10, lineHeight: 12 }}>
                  {alerts.length}
                </AppText>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Configurações"
            onPress={() => router.push('/settings')}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="settings" size={22} color="inkMuted" />
          </Pressable>
        </View>
      </View>

      {nextBill ? (
        <Card
          tone={nextBill.status === 'overdue' ? 'danger' : 'surface'}
          onPress={() => router.push('/bills')}
          accessibilityLabel={`Próxima conta: ${nextBill.name}, ${formatBRL(nextBill.amountCents)}, ${formatRelativeDay(nextBill.dueDate)}`}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
            <IconBadge
              name="calendar-clock"
              tint={nextBill.status === 'overdue' ? t.colors.danger : t.colors.primary}
            />
            <View style={{ flex: 1 }}>
              <AppText variant="caption" color="inkMuted">
                {nextBill.status === 'overdue' ? 'Conta atrasada' : 'Próxima conta'}
              </AppText>
              <AppText variant="bodyStrong">
                {nextBill.name} · {formatRelativeDay(nextBill.dueDate)}
              </AppText>
            </View>
            <MoneyText cents={nextBill.amountCents} variant="bodyStrong" hidden={hide} />
          </View>
        </Card>
      ) : null}

      <Card tone="primary" padding={t.spacing.xl}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <AppText variant="caption" color="onPrimary" style={{ opacity: 0.85 }}>
            Saldo total
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hide ? 'Mostrar valores' : 'Ocultar valores'}
            onPress={toggleHide}
            hitSlop={12}
          >
            <Icon name={hide ? 'eye-off' : 'eye'} size={18} color="onPrimary" />
          </Pressable>
        </View>
        <MoneyText cents={total} variant="display" color="onPrimary" hidden={hide} />
        <View style={{ flexDirection: 'row', gap: t.spacing.lg, marginTop: t.spacing.md }}>
          <View style={{ flex: 1 }}>
            <AppText variant="micro" color="onPrimary" style={{ opacity: 0.8 }}>
              ENTRADAS DO MÊS
            </AppText>
            <MoneyText
              cents={s?.incomeCents ?? 0}
              color="onPrimary"
              variant="bodyStrong"
              hidden={hide}
            />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="micro" color="onPrimary" style={{ opacity: 0.8 }}>
              SAÍDAS DO MÊS
            </AppText>
            <MoneyText
              cents={s?.expenseCents ?? 0}
              color="onPrimary"
              variant="bodyStrong"
              hidden={hide}
            />
          </View>
        </View>
      </Card>

      <SectionHeader
        title="Contas"
        actionLabel="Gerenciar"
        onAction={() => router.push('/settings/accounts')}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -20 }}
      >
        <View style={{ flexDirection: 'row', gap: t.spacing.md, paddingHorizontal: 20 }}>
          {(accounts.data ?? []).map((a) => (
            <Card key={a.id} style={{ minWidth: 150 }} padding={t.spacing.md}>
              <IconBadge name={a.icon} tint={a.color} size={32} />
              <AppText variant="caption" color="inkMuted" style={{ marginTop: t.spacing.sm }}>
                {a.name}
              </AppText>
              <MoneyText cents={a.balanceCents} variant="bodyStrong" hidden={hide} />
            </Card>
          ))}
        </View>
      </ScrollView>

      {topCats.length > 0 ? (
        <>
          <SectionHeader
            title="Para onde foi o dinheiro"
            actionLabel="Relatórios"
            onAction={() => router.push('/reports')}
          />
          <Card>
            <View style={{ gap: t.spacing.md }}>
              {topCats.map((c) => (
                <View key={c.categoryId ?? 'none'} style={{ gap: t.spacing.xs }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <AppText variant="bodyStrong">{c.name}</AppText>
                    <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
                      <AppText variant="caption" color="inkMuted" tabular>
                        {percent(c.totalCents, s?.expenseCents ?? 0)}%
                      </AppText>
                      <MoneyText cents={c.totalCents} variant="caption" hidden={hide} />
                    </View>
                  </View>
                  <ProgressBar
                    value={maxCat ? c.totalCents / maxCat : 0}
                    tone="primary"
                    accessibilityLabel={`${c.name}: ${percent(c.totalCents, s?.expenseCents ?? 0)}% dos gastos`}
                  />
                </View>
              ))}
            </View>
          </Card>
        </>
      ) : null}

      <SectionHeader
        title="Últimas transações"
        actionLabel={recent.data?.length ? 'Ver todas' : undefined}
        onAction={() => router.push('/transactions')}
      />
      <Card padding={t.spacing.md}>
        {recent.data && recent.data.length > 0 ? (
          recent.data.map((item, i) => (
            <TransactionRow
              key={item.id}
              item={item}
              showDate
              divider={i < (recent.data?.length ?? 0) - 1}
              hideAmount={hide}
              onPress={openTx}
            />
          ))
        ) : (
          <EmptyState
            testID="home-empty"
            icon="receipt"
            title="Nenhuma transação ainda"
            message="Toque em + para registrar seu primeiro gasto ou receita."
            actionLabel="Adicionar transação"
            onAction={() => router.push('/transaction/new')}
          />
        )}
      </Card>
    </Screen>
  );
}
