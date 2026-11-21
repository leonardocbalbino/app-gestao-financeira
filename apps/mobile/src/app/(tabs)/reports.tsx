import { useMemo, useState } from 'react';
import { Alert, useWindowDimensions, View } from 'react-native';
import { addMonths, formatBRL, getLimit, monthKey, percent } from '@app/shared';
import { chartColors } from '@app/shared/theme';
import { useTheme } from '@/theme/ThemeProvider';
import {
  AppText,
  Card,
  EmptyState,
  Icon,
  ListItem,
  MoneyText,
  Screen,
  SectionHeader,
} from '@/components/ui';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { DonutChart, type DonutSegment } from '@/components/charts/DonutChart';
import { IncomeExpenseBars } from '@/components/charts/IncomeExpenseBars';
import { useMonthSummary, useMonthlyTotals, useSpendingByCategory } from '@/data/hooks';
import { useUI } from '@/state/ui';
import { BannerSlot } from '@/ads/BannerSlot';
import { FeatureGate, openPaywall, useEntitlements, useFeature } from '@/entitlements';
import { exportMonthCsv, exportMonthlyPdf } from '@/features/export/exporter';
import { useDb } from '@/data/DatabaseProvider';
import { analytics } from '@/lib/analytics';
import { Button, ProBadge } from '@/components/ui';
import { monthlyInsights } from '@/features/reports/insights';

/** Até 4 categorias com cor própria; o restante vira "Outras" (nunca gera cor nova). */
const MAX_SLICES = 4;

export default function ReportsScreen() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const { month: selectedMonth, setMonth } = useUI();
  const advanced = useFeature('reports.advanced');
  const db = useDb();
  const canPdf = useFeature('export.pdf');
  const canCsv = useFeature('export.csv');
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);
  const historyMonths = getLimit(useEntitlements(), 'history.months');
  // Histórico visível: mês atual + (N-1) anteriores. null = ilimitado. Dados antigos não são
  // apagados — apenas ficam fora do período visível no plano atual.
  const minMonth =
    historyMonths === null
      ? undefined
      : addMonths(monthKey(new Date()), -(Math.max(1, historyMonths) - 1));
  const month = minMonth && selectedMonth < minMonth ? minMonth : selectedMonth;
  const summary = useMonthSummary(month);
  const prev = useMonthSummary(addMonths(month, -1));
  const byCat = useSpendingByCategory(month);
  const prevByCat = useSpendingByCategory(addMonths(month, -1));
  const trend = useMonthlyTotals(addMonths(month, -5), month);
  const [selected, setSelected] = useState<string | null>(null);
  const colors = chartColors(t.scheme);

  const cats = useMemo(() => byCat.data ?? [], [byCat.data]);
  const segments = useMemo<DonutSegment[]>(() => {
    const top = cats.slice(0, MAX_SLICES).map((c) => ({
      key: c.categoryId ?? 'none',
      label: c.name,
      value: c.totalCents,
      color: c.color,
    }));
    const rest = cats.slice(MAX_SLICES).reduce((s, c) => s + c.totalCents, 0);
    if (rest > 0) top.push({ key: 'other', label: 'Outras', value: rest, color: colors.other });
    return top;
  }, [cats, colors.other]);

  const s = summary.data;
  const expense = s?.expenseCents ?? 0;
  const prevExpense = prev.data?.expenseCents ?? 0;
  const delta = prevExpense ? Math.round(((expense - prevExpense) / prevExpense) * 100) : null;
  const sel = segments.find((x) => x.key === selected);
  const insights = useMemo(
    () => (s && prev.data ? monthlyInsights(s, prev.data, cats, prevByCat.data ?? []) : []),
    [s, prev.data, cats, prevByCat.data],
  );

  return (
    <Screen testID="screen-reports">
      <AppText variant="title" accessibilityRole="header">
        Relatórios
      </AppText>
      <MonthSwitcher month={month} onChange={setMonth} minMonth={minMonth} />
      <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
        {(
          [
            ['pdf', 'Relatório PDF', canPdf, 'export.pdf'],
            ['csv', 'Planilha CSV', canCsv, 'export.csv'],
          ] as const
        ).map(([kind, label, allowed, feature]) => (
          <View key={kind} style={{ flex: 1 }}>
            <Button
              testID={`export-${kind}`}
              label={label}
              size="md"
              variant={allowed ? 'secondary' : 'pro'}
              icon={allowed ? undefined : <ProBadge label="PRO" />}
              loading={exporting === kind}
              accessibilityHint={allowed ? undefined : 'Recurso Pro. Abre os planos.'}
              onPress={async () => {
                if (!allowed) return openPaywall(feature);
                setExporting(kind);
                try {
                  if (kind === 'pdf') await exportMonthlyPdf(db, month);
                  else await exportMonthCsv(db, month);
                  analytics.track(kind === 'pdf' ? 'export_pdf' : 'export_csv');
                } catch {
                  Alert.alert('Não foi possível exportar', 'Tente novamente.');
                } finally {
                  setExporting(null);
                }
              }}
            />
          </View>
        ))}
      </View>
      {minMonth && month <= minMonth ? (
        <AppText variant="caption" color="inkMuted" align="center">
          Seu plano mostra {historyMonths} meses de histórico.
        </AppText>
      ) : null}

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <AppText variant="micro" color="inkMuted">
              ENTRADAS
            </AppText>
            <MoneyText cents={s?.incomeCents ?? 0} tone="income" variant="bodyStrong" />
          </View>
          <View>
            <AppText variant="micro" color="inkMuted">
              SAÍDAS
            </AppText>
            <MoneyText cents={expense} tone="expense" variant="bodyStrong" />
          </View>
          <View>
            <AppText variant="micro" color="inkMuted">
              SALDO
            </AppText>
            <MoneyText cents={s?.netCents ?? 0} variant="bodyStrong" />
          </View>
        </View>
        {delta !== null && advanced ? (
          <AppText variant="caption" color="inkMuted" style={{ marginTop: t.spacing.sm }}>
            {delta === 0
              ? 'Gastos iguais ao mês anterior'
              : `Gastos ${delta > 0 ? `${delta}% acima` : `${Math.abs(delta)}% abaixo`} do mês anterior`}
          </AppText>
        ) : null}
      </Card>

      <BannerSlot placement="banner_reports" />

      <SectionHeader title="Gastos por categoria" />
      <Card>
        {segments.length === 0 ? (
          <EmptyState
            icon="chart-pie"
            title="Sem gastos neste mês"
            message="Registre despesas para ver para onde vai o seu dinheiro."
          />
        ) : (
          <View style={{ gap: t.spacing.lg }}>
            <View style={{ alignItems: 'center' }}>
              <DonutChart
                segments={segments}
                selectedKey={selected}
                onSelect={setSelected}
                accessibilityLabel={`Gráfico de gastos por categoria. ${segments
                  .map((x) => `${x.label} ${percent(x.value, expense)}%`)
                  .join(', ')}`}
                center={
                  <View style={{ alignItems: 'center' }}>
                    <AppText variant="caption" color="inkMuted">
                      {sel ? sel.label : 'Total'}
                    </AppText>
                    <AppText variant="headline" tabular>
                      {formatBRL(sel ? sel.value : expense)}
                    </AppText>
                  </View>
                }
              />
            </View>
            {/* Legenda + tabela de valores: identidade nunca depende só da cor. */}
            <View>
              {segments.map((x, i) => (
                <ListItem
                  key={x.key}
                  title={x.label}
                  divider={i < segments.length - 1}
                  onPress={() => setSelected(selected === x.key ? null : x.key)}
                  accessibilityLabel={`${x.label}, ${formatBRL(x.value)}, ${percent(x.value, expense)}%`}
                  left={
                    <View
                      style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: x.color }}
                    />
                  }
                  right={
                    <View style={{ alignItems: 'flex-end' }}>
                      <MoneyText cents={x.value} variant="bodyStrong" />
                      <AppText variant="caption" color="inkMuted" tabular>
                        {percent(x.value, expense)}%
                      </AppText>
                    </View>
                  }
                />
              ))}
            </View>
          </View>
        )}
      </Card>

      <SectionHeader title="Insights do mês" />
      <FeatureGate feature="insights.monthly">
        <Card>
          <View style={{ gap: t.spacing.md }}>
            {insights.length === 0 ? (
              <AppText variant="caption" color="inkMuted">
                Registre mais transações para receber insights.
              </AppText>
            ) : (
              insights.map((i) => (
                <View
                  key={i.id}
                  style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'center' }}
                >
                  <Icon name={i.icon} color="primary" />
                  <AppText variant="body" style={{ flex: 1 }}>
                    {i.text}
                  </AppText>
                </View>
              ))
            )}
          </View>
        </Card>
      </FeatureGate>

      <SectionHeader title="Últimos 6 meses" />
      <FeatureGate feature="reports.advanced">
        <Card>
          <IncomeExpenseBars data={trend.data ?? []} width={width - 40 - 32} />
        </Card>
      </FeatureGate>
    </Screen>
  );
}
