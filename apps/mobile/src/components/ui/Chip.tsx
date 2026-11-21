import { Pressable, View } from 'react-native';
import type { ReactNode } from 'react';
import { minTouchTarget } from '@app/shared/theme';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: ReactNode;
  tone?: 'default' | 'pro';
  testID?: string;
}

export function Chip({ label, selected, onPress, icon, tone = 'default', testID }: Props) {
  const t = useTheme();
  const c = t.colors;
  const bg = selected ? (tone === 'pro' ? c.proSoft : c.primarySoft) : c.surface;
  const border = selected ? (tone === 'pro' ? c.pro : c.primary) : c.chipBorder;
  const fg = selected ? (tone === 'pro' ? 'proInk' : 'primaryDark') : 'inkMuted';
  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.xs,
        paddingHorizontal: t.spacing.md,
        height: 36,
        borderRadius: t.radii.chip,
        borderWidth: 1,
        borderColor: border,
        backgroundColor: bg,
      }}
    >
      {icon}
      <AppText
        variant="caption"
        weight="semibold"
        color={t.scheme === 'dark' && selected ? 'ink' : fg}
      >
        {label}
      </AppText>
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      hitSlop={(minTouchTarget - 36) / 2}
    >
      {content}
    </Pressable>
  );
}
