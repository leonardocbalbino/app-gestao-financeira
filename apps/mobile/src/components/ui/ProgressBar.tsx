import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  /** 0..1 (valores acima de 1 indicam estouro). */
  value: number;
  tone?: 'auto' | 'primary' | 'danger' | 'pro';
  height?: number;
  accessibilityLabel?: string;
}

/** Barra de progresso (raio 3). Em "auto": verde até 80%, laranja a partir de 100%. */
export function ProgressBar({ value, tone = 'auto', height = 6, accessibilityLabel }: Props) {
  const t = useTheme();
  const clamped = Math.max(0, Math.min(1, value));
  const color =
    tone === 'auto'
      ? value >= 1
        ? t.colors.danger
        : value >= 0.8
          ? t.colors.chart4
          : t.colors.primary
      : tone === 'primary'
        ? t.colors.primary
        : tone === 'danger'
          ? t.colors.danger
          : t.colors.pro;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={{
        height,
        borderRadius: t.radii.progress,
        backgroundColor: t.colors.divider,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          borderRadius: t.radii.progress,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
