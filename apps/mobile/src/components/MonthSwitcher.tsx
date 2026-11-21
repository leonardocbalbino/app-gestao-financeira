import { Pressable, View } from 'react-native';
import { addMonths, formatMonth, monthKey, type MonthKey } from '@app/shared';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, Icon } from '@/components/ui';

interface Props {
  month: MonthKey;
  onChange: (m: MonthKey) => void;
  /** Mês mais antigo permitido (limite de histórico do plano). */
  minMonth?: MonthKey;
}

export function MonthSwitcher({ month, onChange, minMonth }: Props) {
  const t = useTheme();
  const current = monthKey(new Date());
  const canPrev = !minMonth || month > minMonth;
  const canNext = month < current;
  const btn = (dir: -1 | 1, enabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={dir < 0 ? 'Mês anterior' : 'Próximo mês'}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={() => onChange(addMonths(month, dir))}
      style={{
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: enabled ? 1 : 0.3,
      }}
    >
      <Icon name={dir < 0 ? 'chevron-left' : 'chevron-right'} size={22} />
    </Pressable>
  );
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: t.colors.surface,
        borderRadius: t.radii.button,
        borderWidth: 1,
        borderColor: t.colors.border,
      }}
    >
      {btn(-1, canPrev)}
      <AppText variant="bodyStrong" accessibilityLiveRegion="polite">
        {formatMonth(month)}
      </AppText>
      {btn(1, canNext)}
    </View>
  );
}
