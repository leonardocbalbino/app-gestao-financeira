import { Pressable, View } from 'react-native';
import type { ReactNode } from 'react';
import { minTouchTarget } from '@app/shared/theme';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';

interface Props {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  divider?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  /** Itens além do limite do plano ficam esmaecidos (somente leitura). */
  dimmed?: boolean;
}

export function ListItem({
  title,
  subtitle,
  left,
  right,
  onPress,
  onLongPress,
  divider,
  accessibilityLabel,
  testID,
  dimmed,
}: Props) {
  const t = useTheme();
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.md,
        minHeight: 56,
        paddingVertical: t.spacing.sm,
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: t.colors.divider,
        opacity: dimmed ? 0.5 : 1,
      }}
    >
      {left}
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="inkMuted" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </View>
  );
  if (!onPress && !onLongPress) return body;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(', ')}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [{ minHeight: minTouchTarget }, pressed && { opacity: 0.7 }]}
    >
      {body}
    </Pressable>
  );
}
