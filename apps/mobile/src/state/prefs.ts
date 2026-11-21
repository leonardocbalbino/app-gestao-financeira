import { create } from 'zustand';
import { PrefKeys, storage } from '@/lib/storage';
import type { ThemePreference } from '@/theme/ThemeProvider';

interface PrefsState {
  theme: ThemePreference;
  hideBalance: boolean;
  onboardingDone: boolean;
  setTheme: (t: ThemePreference) => void;
  toggleHideBalance: () => void;
  completeOnboarding: () => void;
}

const readTheme = (): ThemePreference => {
  const v = storage.getString(PrefKeys.theme);
  return v === 'light' || v === 'dark' ? v : 'system';
};

/** Preferências do usuário persistidas no MMKV. */
export const usePrefs = create<PrefsState>((set, get) => ({
  theme: readTheme(),
  hideBalance: storage.getBoolean(PrefKeys.hideBalance) ?? false,
  onboardingDone: storage.getBoolean(PrefKeys.onboardingDone) ?? false,
  setTheme: (theme) => {
    storage.set(PrefKeys.theme, theme);
    set({ theme });
  },
  toggleHideBalance: () => {
    const hideBalance = !get().hideBalance;
    storage.set(PrefKeys.hideBalance, hideBalance);
    set({ hideBalance });
  },
  completeOnboarding: () => {
    storage.set(PrefKeys.onboardingDone, true);
    set({ onboardingDone: true });
  },
}));
