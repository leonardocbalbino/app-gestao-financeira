import { ScrollView, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  padded?: boolean;
  refreshControl?: ScrollViewProps['refreshControl'];
  footer?: ReactNode;
  testID?: string;
}

export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  padded = true,
  refreshControl,
  footer,
  testID,
}: Props) {
  const t = useTheme();
  const pad = padded ? t.spacing.xl : 0;
  return (
    <SafeAreaView testID={testID} edges={edges} style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
      {scroll ? (
        <ScrollView
          refreshControl={refreshControl}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: pad, paddingBottom: pad + 96, gap: t.spacing.lg }}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, padding: pad, gap: t.spacing.lg }}>{children}</View>
      )}
      {footer}
    </SafeAreaView>
  );
}
