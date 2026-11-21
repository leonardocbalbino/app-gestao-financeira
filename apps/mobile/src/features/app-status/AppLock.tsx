import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { brand } from '@app/shared';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, Button, Icon } from '@/components/ui';
import { usePrefs } from '@/state/prefs';

/** Tempo em segundo plano antes de exigir biometria de novo. */
export const LOCK_AFTER_MS = 30_000;

export async function biometricsAvailable(): Promise<boolean> {
  return (
    (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync())
  );
}

export async function authenticate(): Promise<boolean> {
  const r = await LocalAuthentication.authenticateAsync({
    promptMessage: `Desbloquear ${brand.name}`,
    cancelLabel: 'Cancelar',
    fallbackLabel: 'Usar senha do aparelho',
  });
  return r.success;
}

/** Cobre o app com uma tela de bloqueio quando a proteção por biometria está ativa. */
export function AppLock() {
  const t = useTheme();
  const enabled = usePrefs((s) => s.appLock);
  const [locked, setLocked] = useState(enabled);
  const backgroundAt = useRef<number | null>(null);

  const unlock = useCallback(() => {
    void authenticate().then((ok) => ok && setLocked(false));
  }, []);

  // Pede biometria uma vez ao abrir, se o app começou bloqueado.
  const prompted = useRef(false);
  useEffect(() => {
    if (enabled && locked && !prompted.current) {
      prompted.current = true;
      unlock();
    }
  }, [enabled, locked, unlock]);

  // Bloqueia de novo após LOCK_AFTER_MS em segundo plano (estado alterado no handler do evento).
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') backgroundAt.current = Date.now();
      if (
        s === 'active' &&
        backgroundAt.current &&
        Date.now() - backgroundAt.current > LOCK_AFTER_MS
      ) {
        setLocked(true);
        unlock();
      }
    });
    return () => sub.remove();
  }, [enabled, unlock]);

  // Desativar a proteção libera imediatamente (derivado, sem setState em efeito).
  if (!enabled || !locked) return null;
  return (
    <View
      testID="app-lock"
      accessibilityViewIsModal
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: t.colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        padding: t.spacing.xxl,
        gap: t.spacing.lg,
      }}
    >
      <Icon name="lock" size={40} color="primary" />
      <AppText variant="title" align="center">
        {brand.name} está bloqueado
      </AppText>
      <Button label="Desbloquear" onPress={unlock} fullWidth={false} />
    </View>
  );
}
