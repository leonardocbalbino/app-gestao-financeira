import { View } from 'react-native';
import { router } from 'expo-router';
import { greeting } from '@app/shared';
import { AppText, Card, EmptyState, MoneyText, ProgressBar, SectionHeader } from '@/components/ui';
import { Screen } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

export default function HomeScreen() {
  const t = useTheme();
  return (
    <Screen testID="screen-home">
      <View>
        <AppText variant="caption" color="inkMuted">
          {greeting()}
        </AppText>
        <AppText variant="title" accessibilityRole="header">
          Início
        </AppText>
      </View>

      <Card tone="primary" padding={t.spacing.xl}>
        <AppText variant="caption" color="onPrimary" style={{ opacity: 0.85 }}>
          Saldo do mês
        </AppText>
        <MoneyText cents={0} variant="display" color="onPrimary" />
        <View style={{ marginTop: t.spacing.md }}>
          <ProgressBar value={0} tone="pro" accessibilityLabel="Orçamento usado: 0%" />
        </View>
      </Card>

      <SectionHeader title="Últimas transações" />
      <Card>
        <EmptyState
          icon="receipt"
          title="Nenhuma transação ainda"
          message="Toque em + para registrar seu primeiro gasto ou receita."
          actionLabel="Adicionar transação"
          onAction={() => router.push('/transaction/new')}
        />
      </Card>
    </Screen>
  );
}
