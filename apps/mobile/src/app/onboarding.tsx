import { useCallback, useRef, useState } from 'react';
import { FlatList, useWindowDimensions, View, type ListViewToken } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { brand } from '@app/shared';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, Button, Icon, type IconName } from '@/components/ui';
import { usePrefs } from '@/state/prefs';
import { ensureAnonymousSession } from '@/auth/authService';
import { analytics } from '@/lib/analytics';

const SLIDES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'wallet',
    title: 'Tudo em um lugar',
    text: 'Registre gastos e receitas em segundos. Seus dados ficam no seu aparelho, mesmo sem internet.',
  },
  {
    icon: 'chart-pie',
    title: 'Entenda para onde vai o dinheiro',
    text: 'Orçamentos por categoria, relatórios claros e alertas antes de estourar o limite.',
  },
  {
    icon: 'target',
    title: 'Alcance suas metas',
    text: 'Planeje a viagem, a reserva de emergência e não esqueça nenhuma conta a pagar.',
  },
];

export default function Onboarding() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const complete = usePrefs((s) => s.completeOnboarding);
  const [index, setIndex] = useState(0);
  const list = useRef<FlatList>(null);
  const onViewable = useCallback(({ viewableItems }: { viewableItems: ListViewToken[] }) => {
    const i = viewableItems[0]?.index;
    if (typeof i === 'number') setIndex(i);
  }, []);

  const finish = () => {
    complete();
    analytics.track('onboarding_completed', { skipped: index < SLIDES.length - 1 });
    // Sessão anônima em segundo plano; o app funciona offline se falhar.
    void ensureAnonymousSession().catch(() => undefined);
    router.replace('/');
  };

  const last = index === SLIDES.length - 1;

  return (
    <SafeAreaView testID="screen-onboarding" style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <View style={{ alignItems: 'flex-end', paddingHorizontal: t.spacing.xl }}>
        {!last ? (
          <Button label="Pular" variant="ghost" fullWidth={false} size="md" onPress={finish} />
        ) : (
          <View style={{ height: 44 }} />
        )}
      </View>
      <FlatList
        ref={list}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.title}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item }) => (
          <View
            style={{ width, padding: t.spacing.xxl, justifyContent: 'center', gap: t.spacing.lg }}
          >
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: t.radii.card,
                backgroundColor: t.colors.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'center',
              }}
            >
              <Icon name={item.icon} size={44} color="primary" />
            </View>
            <AppText variant="display" align="center" accessibilityRole="header">
              {item.title}
            </AppText>
            <AppText variant="body" color="inkMuted" align="center">
              {item.text}
            </AppText>
          </View>
        )}
      />
      <View style={{ padding: t.spacing.xl, gap: t.spacing.lg }}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}
          accessible
          accessibilityLabel={`Passo ${index + 1} de ${SLIDES.length}`}
        >
          {SLIDES.map((s, i) => (
            <View
              key={s.title}
              style={{
                width: i === index ? 20 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === index ? t.colors.primary : t.colors.chipBorder,
              }}
            />
          ))}
        </View>
        <Button
          testID="onboarding-next"
          label={last ? `Começar a usar o ${brand.name}` : 'Continuar'}
          onPress={() =>
            last ? finish() : list.current?.scrollToIndex({ index: index + 1, animated: true })
          }
        />
      </View>
    </SafeAreaView>
  );
}
