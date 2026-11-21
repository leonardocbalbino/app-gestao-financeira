import { forwardRef } from 'react';
import { TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  leading?: React.ReactNode;
}

export const TextField = forwardRef<TextInputInstance, Props>(function TextField(
  { label, error, leading, style, ...rest },
  ref,
) {
  const t = useTheme();
  return (
    <View style={{ gap: t.spacing.xs }}>
      {label ? (
        <AppText variant="caption" color="inkMuted" weight="semibold">
          {label}
        </AppText>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.sm,
          minHeight: 48,
          paddingHorizontal: t.spacing.md,
          borderRadius: t.radii.input,
          borderWidth: 1,
          borderColor: error ? t.colors.danger : t.colors.border,
          backgroundColor: t.colors.surface,
        }}
      >
        {leading}
        <TextInput
          ref={ref}
          accessibilityLabel={label ?? rest.placeholder}
          placeholderTextColor={t.colors.inkSubtle}
          maxFontSizeMultiplier={1.6}
          style={[
            {
              flex: 1,
              color: t.colors.ink,
              fontFamily: t.fontFamily.medium,
              fontSize: 15,
              paddingVertical: t.spacing.sm,
            },
            style,
          ]}
          {...rest}
        />
      </View>
      {error ? (
        <AppText variant="caption" color="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
    </View>
  );
});
