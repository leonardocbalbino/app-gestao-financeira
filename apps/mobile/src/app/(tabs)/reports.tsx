import { AppText, EmptyState, Screen } from '@/components/ui';

export default function ReportsScreen() {
  return (
    <Screen testID="screen-reports">
      <AppText variant="title" accessibilityRole="header">
        Relatórios
      </AppText>
      <EmptyState
        icon="chart-pie"
        title="Sem dados ainda"
        message="Registre transações para ver para onde vai o seu dinheiro."
      />
    </Screen>
  );
}
