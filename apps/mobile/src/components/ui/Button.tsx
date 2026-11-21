import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { minTouchTarget } from '@app/shared/theme';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'pro';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  loading,
  disabled,
  fullWidth = true,
  accessibilityHint,
  testID,
  style,
}: Props) {
  const t = useTheme();
  const c = t.colors;
  const palette: Record<ButtonVariant, { bg: string; fg: keyof typeof c; border?: string }> = {
    primary: { bg: c.primary, fg: 'onPrimary' },
    secondary: { bg: c.surface, fg: 'ink', border: c.chipBorder },
    ghost: { bg: 'transparent', fg: 'primary' },
    danger: { bg: c.dangerSoft, fg: 'danger' },
    pro: { bg: c.pro, fg: 'proInk' },
  };
  const p = palette[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: size === 'lg' ? 52 : minTouchTarget,
          paddingHorizontal: t.spacing.lg,
          borderRadius: t.radii.button,
          backgroundColor: p.bg,
          borderWidth: p.border ? 1 : 0,
          borderColor: p.border,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={c[p.fg]} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
          {icon}
          <AppText variant="bodyStrong" color={p.fg} weight="bold">
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}
