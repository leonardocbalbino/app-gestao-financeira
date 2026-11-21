import { Switch, View } from 'react-native';
import { router } from 'expo-router';
import { brand } from '@app/shared';
import { useTheme, useThemePreference, type ThemePreference } from '@/theme/ThemeProvider';
import { AppText, Card, Icon, ListItem, Screen, Segmented } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { usePrefs } from '@/state/prefs';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
];

export default function SettingsScreen() {
  const t = useTheme();
  const { preference, setPreference } = useThemePreference();
  const hide = usePrefs((s) => s.hideBalance);
  const toggleHide = usePrefs((s) => s.toggleHideBalance);
  const chevron = <Icon name="chevron-right" color="inkSubtle" />;

  return (
    <Screen testID="screen-settings">
      <ScreenHeader title="Configurações" />

      <AppText variant="micro" color="inkMuted">
        ORGANIZAÇÃO
      </AppText>
      <Card padding={t.spacing.md}>
        <ListItem
          title="Contas e carteiras"
          left={<Icon name="wallet" color="primary" />}
          right={chevron}
          divider
          onPress={() => router.push('/settings/accounts')}
        />
        <ListItem
          title="Categorias"
          left={<Icon name="sliders-horizontal" color="primary" />}
          right={chevron}
          onPress={() => router.push('/settings/categories')}
        />
      </Card>

      <AppText variant="micro" color="inkMuted">
        APARÊNCIA E PRIVACIDADE
      </AppText>
      <Card>
        <View style={{ gap: t.spacing.md }}>
          <AppText variant="bodyStrong">Tema</AppText>
          <Segmented options={THEME_OPTIONS} value={preference} onChange={setPreference} />
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">Ocultar valores</AppText>
              <AppText variant="caption" color="inkMuted">
                Esconde saldos na tela inicial e nas listas
              </AppText>
            </View>
            <Switch
              accessibilityLabel="Ocultar valores"
              value={hide}
              onValueChange={toggleHide}
              trackColor={{ true: t.colors.primary, false: t.colors.chipBorder }}
            />
          </View>
        </View>
      </Card>

      <AppText variant="caption" color="inkSubtle" align="center">
        {brand.name} · versão 1.0.0
      </AppText>
    </Screen>
  );
}
