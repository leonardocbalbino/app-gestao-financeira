import { router } from 'expo-router';
import { AppText, EmptyState, Screen } from '@/components/ui';

export default function TransactionsScreen() {
  return (
    <Screen testID="screen-transactions">
      <AppText variant="title" accessibilityRole="header">
        Transações
      </AppText>
      <EmptyState
        icon="arrow-left-right"
        title="Sem transações"
        message="Suas receitas e despesas aparecerão aqui."
        actionLabel="Adicionar"
        onAction={() => router.push('/transaction/new')}
      />
    </Screen>
  );
}
