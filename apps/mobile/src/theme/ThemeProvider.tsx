import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import {
  darkColors,
  lightColors,
  radii,
  spacing,
  typography,
  fontFamily,
  type ColorTokens,
} from '@app/shared/theme';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Theme {
  scheme: 'light' | 'dark';
  colors: ColorTokens;
  radii: typeof radii;
  spacing: typeof spacing;
  typography: typeof typography;
  fontFamily: typeof fontFamily;
}

interface ThemeContextValue {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

export function buildTheme(scheme: 'light' | 'dark'): Theme {
  return {
    scheme,
    colors: scheme === 'dark' ? darkColors : lightColors,
    radii,
    spacing,
    typography,
    fontFamily,
  };
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: buildTheme('light'),
  preference: 'system',
  setPreference: () => undefined,
});

interface Props {
  children: ReactNode;
  initialPreference?: ThemePreference;
  onPreferenceChange?: (p: ThemePreference) => void;
}

export function ThemeProvider({
  children,
  initialPreference = 'system',
  onPreferenceChange,
}: Props) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>(initialPreference);
  const scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: buildTheme(scheme),
      preference,
      setPreference: (p) => {
        setPref(p);
        onPreferenceChange?.(p);
      },
    }),
    [scheme, preference, onPreferenceChange],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

export function useThemePreference() {
  const { preference, setPreference } = useContext(ThemeContext);
  return { preference, setPreference };
}
