import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '@/components/ui';

/** Botão central "+" da tab bar: abre o modal de nova transação. */
export function AddTabButton() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Pressable
        testID="tab-add"
        accessibilityRole="button"
        accessibilityLabel="Nova transação"
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/transaction/new');
        }}
        style={({ pressed }) => ({
          width: 56,
          height: 56,
          marginTop: -18,
          borderRadius: 28,
          backgroundColor: pressed ? t.colors.primaryDark : t.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 4,
          borderColor: t.colors.surface,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        })}
      >
        <Icon name="plus" size={26} color="onPrimary" strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}
