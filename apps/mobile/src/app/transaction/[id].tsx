import { useLocalSearchParams } from 'expo-router';
import { TransactionFormScreen } from '@/features/transactions/TransactionFormScreen';

export default function EditTransactionModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TransactionFormScreen id={id} />;
}
