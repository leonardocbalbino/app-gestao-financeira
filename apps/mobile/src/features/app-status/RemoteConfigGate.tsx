import type { ReactNode } from 'react';
import { Linking, Platform, View } from 'react-native';
import * as Application from 'expo-application';
import { SafeAreaView } from 'react-native-safe-area-context';
import { brand } from '@app/shared';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, Button, Icon } from '@/components/ui';
import { useEntitlementsContext } from '@/entitlements';
import { isBelowMinimum } from '@/lib/version';

export function useAppStatus() {
  const { config } = useEntitlementsContext();
  return {
    forceUpdate: isBelowMinimum(Application.nativeApplicationVersion, config.app.min_app_version),
    maintenance: config.app.maintenance_mode,
    maintenanceMessage: config.app.maintenance_message,
  };
}

const STORE_URL = Platform.select({
  ios: `itms-apps://apps.apple.com/app/id${process.env.EXPO_PUBLIC_APP_STORE_ID ?? ''}`,
  default: `market://details?id=${brand.androidPackage}`,
});

/** Bloqueia o app quando a versão está abaixo da mínima; mostra faixa em manutenção. */
export function RemoteConfigGate({ children }: { children: ReactNode }) {
  const t = useTheme();
  const { forceUpdate, maintenance, maintenanceMessage } = useAppStatus();

  if (forceUpdate) {
    return (
      <SafeAreaView
        testID="screen-force-update"
        style={{
          flex: 1,
          backgroundColor: t.colors.bg,
          padding: t.spacing.xxl,
          justifyContent: 'center',
          gap: t.spacing.lg,
        }}
      >
        <View style={{ alignItems: 'center' }}>
          <Icon name="download" size={40} color="primary" />
        </View>
        <AppText variant="title" align="center" accessibilityRole="header">
          Atualize o {brand.name}
        </AppText>
        <AppText variant="body" color="inkMuted" align="center">
          Esta versão não é mais suportada. Seus dados estão salvos no aparelho e continuarão lá
          depois da atualização.
        </AppText>
        <Button label="Atualizar agora" onPress={() => void Linking.openURL(STORE_URL)} />
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {maintenance ? (
        <SafeAreaView edges={['top']} style={{ backgroundColor: t.colors.proSoft }}>
          <View
            accessibilityRole="alert"
            style={{
              flexDirection: 'row',
              gap: t.spacing.sm,
              padding: t.spacing.md,
              alignItems: 'center',
            }}
          >
            <Icon name="settings" size={16} color="proInk" />
            <AppText variant="caption" color="proInk" style={{ flex: 1 }}>
              {maintenanceMessage ||
                'Estamos em manutenção. O app funciona normalmente; backup e compras voltam em breve.'}
            </AppText>
          </View>
        </SafeAreaView>
      ) : null}
      {children}
    </View>
  );
}
