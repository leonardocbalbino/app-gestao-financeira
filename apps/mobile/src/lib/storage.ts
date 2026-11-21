import { createMMKV } from 'react-native-mmkv';

/** Armazenamento chave-valor rápido (preferências, caches pequenos). NÃO guarde segredos aqui. */
export const storage = createMMKV({ id: 'app-prefs' });

export const PrefKeys = {
  theme: 'pref.theme',
  hideBalance: 'pref.hideBalance',
  onboardingDone: 'pref.onboardingDone',
  entitlementsCache: 'cache.entitlements',
  configCache: 'cache.appConfig',
  adConfigCache: 'cache.adConfig',
  lastSyncAt: 'sync.lastPulledAt',
  installedAt: 'meta.installedAt',
} as const;

export function getJSON<T>(key: string): T | undefined {
  const raw = storage.getString(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function setJSON(key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value));
}
