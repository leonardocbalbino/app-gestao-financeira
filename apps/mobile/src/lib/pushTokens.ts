import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { api, getSessionUser, isApiConfigured } from './api';
import { ensureNotificationPermission } from './notifications';

/**
 * Registra o token Expo deste aparelho na API (lembretes chegam por push).
 * `prompt=false` só registra se a permissão já foi concedida (não incomoda o usuário).
 */
export async function registerPushToken(prompt = false): Promise<boolean> {
  if (!isApiConfigured() || !getSessionUser() || Platform.OS === 'web') return false;
  const granted = prompt
    ? await ensureNotificationPermission()
    : (await Notifications.getPermissionsAsync()).granted;
  if (!granted) return false;
  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) return false; // dev build sem EAS configurado
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await api('POST', '/me/push-tokens', { body: { token, platform: Platform.OS } });
  return true;
}
