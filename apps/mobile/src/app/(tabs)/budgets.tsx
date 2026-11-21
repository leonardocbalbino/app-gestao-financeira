import { AppText, EmptyState, Screen } from '@/components/ui';

export default function BudgetsScreen() {
  return (
    <Screen testID="screen-budgets">
      <AppText variant="title" accessibilityRole="header">
        Orçamentos
      </AppText>
      <EmptyState
        icon="wallet"
        title="Nenhum orçamento"
        message="Defina limites por categoria para controlar seus gastos do mês."
      />
    </Screen>
  );
}
