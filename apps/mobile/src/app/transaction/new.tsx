import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { AppText, Icon, Screen } from '@/components/ui';

/** Modal de nova transação — formulário completo na Fase 2. */
export default function NewTransactionModal() {
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="title" accessibilityRole="header">
          Nova transação
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={() => router.back()}
          hitSlop={12}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="x" size={24} />
        </Pressable>
      </View>
    </Screen>
  );
}
