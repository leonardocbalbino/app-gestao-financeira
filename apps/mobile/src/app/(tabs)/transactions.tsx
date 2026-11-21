import { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { formatRelativeDay } from '@app/shared';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, Card, Chip, EmptyState, Icon, MoneyText, TextField } from '@/components/ui';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { TransactionRow } from '@/components/TransactionRow';
import { useMonthSummary, useTransactions } from '@/data/hooks';
import { groupByDay } from '@/features/transactions/groupByDay';
import { withNativeSlots } from '@/ads/logic';
import { useAdPlacement } from '@/ads/AdsProvider';
import { NativeAdRow } from '@/ads/NativeAdRow';
import { useEntitlementsContext } from '@/entitlements';
import { useUI, type KindFilter } from '@/state/ui';
import { usePrefs } from '@/state/prefs';

const KIND_CHIPS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'expense', label: 'Despesas' },
  { value: 'income', label: 'Receitas' },
  { value: 'transfer', label: 'Transferências' },
];

export default function TransactionsScreen() {
  const t = useTheme();
  const { month, setMonth, kindFilter, setKindFilter, search, setSearch } = useUI();
  const hide = usePrefs((s) => s.hideBalance);
  const filter = useMemo(
    () => ({
      month: search.trim() ? undefined : month,
      kind: kindFilter === 'all' ? undefined : kindFilter,
      search: search.trim() || undefined,
    }),
    [month, kindFilter, search],
  );
  const txQ = useTransactions(filter);
  const summary = useMonthSummary(month);
  const nativeEnabled = useAdPlacement('native_transactions') !== null;
  const everyN = useEntitlementsContext().config.ads.native_every_n;
  const rows = useMemo(
    () =>
      withNativeSlots(groupByDay(txQ.data ?? []), everyN, nativeEnabled, (r) => r.type === 'tx'),
    [txQ.data, everyN, nativeEnabled],
  );
  const openTx = useCallback(
    (id: string) => router.push({ pathname: '/transaction/[id]', params: { id } }),
    [],
  );

  const header = (
    <View style={{ gap: t.spacing.md, paddingBottom: t.spacing.md }}>
      <AppText variant="title" accessibilityRole="header">
        Transações
      </AppText>
      <TextField
        placeholder="Buscar por descrição ou categoria"
        accessibilityLabel="Buscar transações"
        value={search}
        onChangeText={setSearch}
        leading={<Icon name="search" size={18} color="inkSubtle" />}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      {!search.trim() ? <MonthSwitcher month={month} onChange={setMonth} /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
        {KIND_CHIPS.map((c) => (
          <Chip
            key={c.value}
            label={c.label}
            selected={kindFilter === c.value}
            onPress={() => setKindFilter(c.value)}
          />
        ))}
      </View>
      {!search.trim() && summary.data ? (
        <Card padding={t.spacing.md}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <AppText variant="micro" color="inkMuted">
                ENTRADAS
              </AppText>
              <MoneyText
                cents={summary.data.incomeCents}
                tone="income"
                variant="bodyStrong"
                hidden={hide}
              />
            </View>
            <View>
              <AppText variant="micro" color="inkMuted">
                SAÍDAS
              </AppText>
              <MoneyText
                cents={summary.data.expenseCents}
                tone="expense"
                variant="bodyStrong"
                hidden={hide}
              />
            </View>
            <View>
              <AppText variant="micro" color="inkMuted">
                SALDO
              </AppText>
              <MoneyText cents={summary.data.netCents} variant="bodyStrong" hidden={hide} />
            </View>
          </View>
        </Card>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView
      testID="screen-transactions"
      edges={['top']}
      style={{ flex: 1, backgroundColor: t.colors.bg }}
    >
      <FlashList
        data={rows}
        keyExtractor={(r) => r.key}
        getItemType={(r) => r.type}
        contentContainerStyle={{ padding: t.spacing.xl, paddingBottom: 120 }}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: r }) =>
          r.type === 'ad' ? (
            <NativeAdRow />
          ) : r.type === 'header' ? (
            <View
              accessibilityRole="header"
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingTop: t.spacing.lg,
                paddingBottom: t.spacing.xs,
              }}
            >
              <AppText variant="caption" weight="bold" color="inkMuted">
                {formatRelativeDay(r.date)}
              </AppText>
              <MoneyText cents={r.totalCents} variant="caption" color="inkMuted" hidden={hide} />
            </View>
          ) : (
            <TransactionRow item={r.item} divider={!r.last} hideAmount={hide} onPress={openTx} />
          )
        }
        ListEmptyComponent={
          <EmptyState
            testID="transactions-empty"
            icon={search ? 'search' : 'arrow-left-right'}
            title={search ? 'Nada encontrado' : 'Sem transações neste mês'}
            message={
              search ? 'Tente outro termo de busca.' : 'Suas receitas e despesas aparecerão aqui.'
            }
            actionLabel={search ? undefined : 'Adicionar'}
            onAction={() => router.push('/transaction/new')}
          />
        }
      />
    </SafeAreaView>
  );
}
