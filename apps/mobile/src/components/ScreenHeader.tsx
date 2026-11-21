import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { AppText, Icon } from '@/components/ui';

interface Props {
  title: string;
  right?: ReactNode;
  onBack?: () => void;
}

/** Cabeçalho de telas empilhadas (voltar + título). */
export function ScreenHeader({ title, right, onBack }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: -12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        onPress={onBack ?? (() => router.back())}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="chevron-left" size={24} />
      </Pressable>
      <AppText variant="title" accessibilityRole="header" style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </AppText>
      {right}
    </View>
  );
}
