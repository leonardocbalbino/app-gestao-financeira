import { useEffect, useMemo, useState } from 'react';
import { analytics } from '@/lib/analytics';
import { useAppStatus } from '@/features/app-status/RemoteConfigGate';
import { Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
  brand,
  buildComparisonRows,
  describeFeatureValue,
  getFeatureDefinition,
  palette,
  type FeatureValue,
  type PlanComparisonRow,
} from '@app/shared';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, Button, Icon, ProBadge } from '@/components/ui';
import { billing, type BillingPeriod, type PaywallPackage } from '@/billing';
import { useEntitlements, useEntitlementsContext } from '@/entitlements';

interface Props {
  source?: string;
}

/** Valor de célula: ✓/✗ para booleanos, número/"Ilimitado" para limites. */
function Cell({ row, value }: { row: PlanComparisonRow; value: FeatureValue | undefined }) {
  const def = getFeatureDefinition(row.key);
  if (def?.type === 'limit') {
    return (
      <AppText variant="caption" weight="bold" tabular align="center">
        {value === undefined ? '—' : describeFeatureValue(row.key, value)}
      </AppText>
    );
  }
  // Para "ads", a linha é "Sem anúncios": liberado quando ads.show = false.
  const on = def?.type === 'ads' ? value === false : value === true;
  return (
    <View
      accessible
      accessibilityLabel={on ? 'Incluído' : 'Não incluído'}
      style={{ alignItems: 'center' }}
    >
      <Icon name={on ? 'check' : 'x'} size={18} color={on ? 'primary' : 'inkFaint'} />
    </View>
  );
}

export function PaywallScreen({ source }: Props) {
  const t = useTheme();
  const { matrix, config, refresh } = useEntitlementsContext();
  const ent = useEntitlements();
  const [period, setPeriod] = useState<BillingPeriod>(config.app.paywall_default_plan);
  const { maintenance } = useAppStatus();
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);

  const packages = useQuery({
    queryKey: ['billing', 'packages'],
    queryFn: () => billing().getPackages(),
    staleTime: 5 * 60_000,
  });

  const plans = useMemo(
    () => [...matrix.plans].sort((a, b) => a.sort_order - b.sort_order),
    [matrix.plans],
  );
  const rows = useMemo(() => buildComparisonRows(matrix), [matrix]);
  const selected: PaywallPackage | undefined = packages.data?.find((p) => p.period === period);
  const monthly = packages.data?.find((p) => p.period === 'monthly');
  const annual = packages.data?.find((p) => p.period === 'annual');
  const savings =
    monthly && annual && monthly.priceCents > 0
      ? Math.round((1 - annual.priceCents / (monthly.priceCents * 12)) * 100)
      : null;
  const sourceDef = source ? getFeatureDefinition(source) : undefined;
  const alreadyPro = ent.planId !== 'free' && ent.source !== 'fallback';

  useEffect(() => {
    analytics.track('paywall_viewed', { source: source ?? 'direct' });
  }, [source]);

  const finish = async (kind: 'buy' | 'restore') => {
    setBusy(kind);
    if (kind === 'buy') analytics.track('purchase_started', { period, source: source ?? 'direct' });
    try {
      const res =
        kind === 'buy' && selected
          ? await billing().purchase(selected.id)
          : await billing().restore();
      if (res.status === 'success') {
        analytics.track(kind === 'buy' ? 'purchase_completed' : 'purchase_restored', { period });
        await refresh();
        router.back();
      } else if (res.status === 'error') {
        Alert.alert('Não foi possível concluir', res.message);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView
      testID="screen-paywall"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: t.colors.bg }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          paddingHorizontal: t.spacing.md,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={() => router.back()}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="x" size={24} />
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: t.spacing.xl,
          paddingBottom: t.spacing.xl,
          gap: t.spacing.lg,
        }}
      >
        <View style={{ alignItems: 'center', gap: t.spacing.sm }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: t.radii.card,
              backgroundColor: palette.pro,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="crown" size={30} rawColor={palette.proInk} />
          </View>
          <ProBadge label={`${brand.name} PRO`} />
          <AppText variant="title" align="center" accessibilityRole="header">
            {sourceDef ? `Desbloqueie: ${sourceDef.label}` : 'Tenha controle total do seu dinheiro'}
          </AppText>
          <AppText variant="body" color="inkMuted" align="center">
            {sourceDef?.description ??
              'Relatórios completos, sincronização, lembretes e nenhum anúncio.'}
          </AppText>
        </View>

        {/* Tabela comparativa gerada da matriz do admin */}
        <View
          accessibilityRole="summary"
          style={{
            backgroundColor: t.colors.surface,
            borderRadius: t.radii.card,
            borderWidth: 1,
            borderColor: t.colors.border,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              padding: t.spacing.md,
              backgroundColor: t.colors.divider,
            }}
          >
            <AppText variant="caption" weight="bold" style={{ flex: 1 }}>
              Recurso
            </AppText>
            {plans.map((p) => (
              <AppText
                key={p.id}
                variant="caption"
                weight="bold"
                align="center"
                style={{ width: 72 }}
                color={p.is_default ? 'inkMuted' : 'ink'}
              >
                {p.name}
              </AppText>
            ))}
          </View>
          {rows.map((r, i) => (
            <View
              key={r.key}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                minHeight: 44,
                paddingHorizontal: t.spacing.md,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: t.colors.divider,
                backgroundColor: r.key === source ? t.colors.proSoft : undefined,
              }}
            >
              <AppText variant="caption" style={{ flex: 1 }}>
                {r.label}
              </AppText>
              {plans.map((p) => (
                <View key={p.id} style={{ width: 72 }}>
                  <Cell row={r} value={r.values[p.id]} />
                </View>
              ))}
            </View>
          ))}
        </View>

        {alreadyPro ? (
          <AppText variant="bodyStrong" align="center" color="primary">
            Você já tem o plano {ent.planName}. Obrigado!
          </AppText>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
              {(['annual', 'monthly'] as const).map((p) => {
                const pkg = p === 'annual' ? annual : monthly;
                const active = period === p;
                return (
                  <Pressable
                    key={p}
                    testID={`plan-${p}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${p === 'annual' ? 'Anual' : 'Mensal'}, ${pkg?.priceString ?? 'preço indisponível'}`}
                    onPress={() => setPeriod(p)}
                    style={{
                      flex: 1,
                      padding: t.spacing.md,
                      borderRadius: t.radii.button,
                      borderWidth: 2,
                      borderColor: active ? palette.pro : t.colors.border,
                      backgroundColor: active ? t.colors.proSoft : t.colors.surface,
                      gap: 2,
                    }}
                  >
                    <AppText variant="caption" weight="bold">
                      {p === 'annual' ? 'Anual' : 'Mensal'}
                    </AppText>
                    <AppText variant="headline" tabular>
                      {pkg?.priceString ?? '—'}
                    </AppText>
                    <AppText variant="caption" color="inkMuted">
                      {p === 'annual'
                        ? pkg?.monthlyEquivalent
                          ? `${pkg.monthlyEquivalent}/mês${savings ? ` · economize ${savings}%` : ''}`
                          : 'por ano'
                        : 'por mês'}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
            <Button
              testID="paywall-subscribe"
              label={
                selected?.trialDays
                  ? `Testar grátis por ${selected.trialDays} dias`
                  : 'Assinar o Pro'
              }
              variant="pro"
              onPress={() => finish('buy')}
              loading={busy === 'buy'}
              disabled={!selected || !billing().isAvailable() || maintenance}
            />
            {!billing().isAvailable() ? (
              <AppText variant="caption" color="inkMuted" align="center">
                As compras ficam disponíveis no app instalado pela loja.
              </AppText>
            ) : null}
          </>
        )}

        <Button
          label="Restaurar compras"
          variant="ghost"
          onPress={() => finish('restore')}
          loading={busy === 'restore'}
        />
        <AppText variant="micro" color="inkSubtle" align="center">
          A assinatura renova automaticamente e pode ser cancelada a qualquer momento nas
          configurações da loja. Cobrança na conta da loja após a confirmação.
        </AppText>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: t.spacing.lg }}>
          <Pressable accessibilityRole="link" onPress={() => Linking.openURL(brand.termsUrl)}>
            <AppText variant="caption" color="primary">
              Termos de uso
            </AppText>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => Linking.openURL(brand.privacyUrl)}>
            <AppText variant="caption" color="primary">
              Privacidade
            </AppText>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
