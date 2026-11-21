import type { ReactNode } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import {
  getFeatureDefinition,
  type BooleanFeatureKey,
  type FeatureKey,
  type LimitFeatureKey,
  type LimitState,
} from '@app/shared';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, Button, Card, Icon, ProBadge } from '@/components/ui';
import { analytics } from '@/lib/analytics';
import { useFeature, useLimit } from './hooks';

/** Abre o paywall registrando de onde veio (para analytics e copy contextual). */
export function openPaywall(source: FeatureKey | string) {
  analytics.track('feature_locked_tapped', { source });
  router.push({ pathname: '/paywall', params: { source } });
}

interface UpgradeCardProps {
  feature: FeatureKey;
  title?: string;
  message?: string;
  compact?: boolean;
}

/** Cartão padrão "recurso Pro" — dourado, com CTA para o paywall. */
export function UpgradeCard({ feature, title, message, compact }: UpgradeCardProps) {
  const t = useTheme();
  const def = getFeatureDefinition(feature);
  return (
    <Card tone="pro" testID={`upgrade-${feature}`}>
      <View style={{ gap: t.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
          <Icon name="lock" size={16} color="proInk" />
          <AppText variant="bodyStrong" color="proInk" style={{ flex: 1 }}>
            {title ?? def?.label ?? 'Recurso Pro'}
          </AppText>
          <ProBadge />
        </View>
        {!compact ? (
          <AppText variant="caption" color="proInk">
            {message ?? def?.description ?? 'Disponível no plano Pro.'}
          </AppText>
        ) : null}
        <Button
          label="Conhecer o Pro"
          variant="pro"
          size="md"
          onPress={() => openPaywall(feature)}
          testID={`upgrade-cta-${feature}`}
        />
      </View>
    </Card>
  );
}

interface FeatureGateProps {
  feature: BooleanFeatureKey;
  children: ReactNode;
  /** O que mostrar quando bloqueado (padrão: UpgradeCard). `null` para esconder. */
  fallback?: ReactNode;
}

/** Renderiza os filhos somente se a feature estiver liberada. */
export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const enabled = useFeature(feature);
  if (enabled) return <>{children}</>;
  return <>{fallback === undefined ? <UpgradeCard feature={feature} /> : fallback}</>;
}

interface LimitGateProps {
  feature: LimitFeatureKey;
  /** Render-prop com o estado do limite; recebe `canAdd`. */
  children: (state: LimitState & { canAdd: boolean }) => ReactNode;
}

/** Expõe o estado do limite e se é possível adicionar mais um item. */
export function LimitGate({ feature, children }: LimitGateProps) {
  const state = useLimit(feature);
  return <>{children({ ...state, canAdd: !state.reached })}</>;
}

/** Botão "adicionar" que vira CTA do paywall quando o limite é atingido. */
export function LimitedAddButton({
  feature,
  label,
  onPress,
  testID,
}: {
  feature: LimitFeatureKey;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  const t = useTheme();
  const state = useLimit(feature);
  if (!state.reached) {
    return <Button label={label} variant="secondary" onPress={onPress} testID={testID} />;
  }
  return (
    <View style={{ gap: t.spacing.xs }}>
      <Button
        testID={testID ? `${testID}-locked` : undefined}
        label={`${label} · Pro`}
        variant="pro"
        icon={<Icon name="lock" size={16} color="proInk" />}
        onPress={() => openPaywall(feature)}
        accessibilityHint="Limite do plano atingido. Abre os planos."
      />
      <AppText variant="caption" color="inkMuted" align="center">
        Você usa {state.used} de {state.limit} no seu plano.
      </AppText>
    </View>
  );
}
