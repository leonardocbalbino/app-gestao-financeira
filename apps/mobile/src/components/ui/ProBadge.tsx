import { View } from 'react-native';
import { palette } from '@app/shared/theme';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';
import { Icon } from './Icon';

/** Selo dourado "PRO". Texto sempre proInk sobre pro (contraste AA em ambos os temas). */
export function ProBadge({ label = 'PRO' }: { label?: string }) {
  const t = useTheme();
  return (
    <View
      accessible
      accessibilityLabel="Recurso Pro"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: t.spacing.sm,
        paddingVertical: 2,
        borderRadius: t.radii.pill,
        backgroundColor: palette.pro,
        alignSelf: 'flex-start',
      }}
    >
      <Icon name="crown" size={12} rawColor={palette.proInk} />
      <AppText variant="micro" style={{ color: palette.proInk }}>
        {label}
      </AppText>
    </View>
  );
}
