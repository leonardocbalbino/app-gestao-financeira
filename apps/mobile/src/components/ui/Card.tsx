import { Pressable, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

interface Props extends ViewProps {
  padding?: number;
  tone?: 'surface' | 'primary' | 'primarySoft' | 'pro' | 'danger';
  bordered?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Card({
  padding,
  tone = 'surface',
  bordered = true,
  onPress,
  onLongPress,
  style,
  children,
  ...rest
}: Props) {
  const t = useTheme();
  const bg = {
    surface: t.colors.surface,
    primary: t.colors.primary,
    primarySoft: t.colors.primarySoft,
    pro: t.colors.proSoft,
    danger: t.colors.dangerSoft,
  }[tone];
  const cardStyle: StyleProp<ViewStyle> = [
    {
      backgroundColor: bg,
      borderRadius: t.radii.card,
      padding: padding ?? t.spacing.lg,
      borderWidth: bordered && tone === 'surface' ? 1 : 0,
      borderColor: t.colors.border,
    },
    style,
  ];
  if (onPress || onLongPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => [cardStyle, pressed && { opacity: 0.85 }]}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={cardStyle} {...rest}>
      {children}
    </View>
  );
}
