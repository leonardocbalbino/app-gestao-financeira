import { Text, type TextProps, type TextStyle } from 'react-native';
import type { ColorTokens, TypographyVariant } from '@app/shared/theme';
import { useTheme } from '@/theme/ThemeProvider';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: keyof ColorTokens;
  /** Números tabulares (obrigatório para valores monetários). */
  tabular?: boolean;
  align?: TextStyle['textAlign'];
  weight?: 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold';
}

export function AppText({
  variant = 'body',
  color = 'ink',
  tabular,
  align,
  weight,
  style,
  ...rest
}: AppTextProps) {
  const t = useTheme();
  const base = t.typography[variant];
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[
        base,
        { color: t.colors[color] },
        weight ? { fontFamily: t.fontFamily[weight] } : null,
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
