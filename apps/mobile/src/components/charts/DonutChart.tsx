import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { chartColors } from '@app/shared/theme';
import { useTheme } from '@/theme/ThemeProvider';

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface Props {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  selectedKey?: string | null;
  onSelect?: (key: string | null) => void;
  /** Conteúdo central (ex.: total). */
  center?: React.ReactNode;
  accessibilityLabel: string;
}

function polar(cx: number, cy: number, r: number, angle: number) {
  const a = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

export function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  start: number,
  end: number,
) {
  const sweep = Math.min(end - start, 359.999);
  const e = start + sweep;
  const large = sweep > 180 ? 1 : 0;
  const o1 = polar(cx, cy, rOuter, start);
  const o2 = polar(cx, cy, rOuter, e);
  const i1 = polar(cx, cy, rInner, e);
  const i2 = polar(cx, cy, rInner, start);
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${i2.x} ${i2.y}`,
    'Z',
  ].join(' ');
}

/**
 * Rosca com 2px de separação (cor da superfície) entre fatias. A identidade das fatias é
 * sempre repetida na legenda/lista ao lado (nunca só cor). Toque destaca a fatia.
 */
export function DonutChart({
  segments,
  size = 168,
  thickness = 22,
  selectedKey,
  onSelect,
  center,
  accessibilityLabel,
}: Props) {
  const t = useTheme();
  const gap = chartColors(t.scheme).gap;
  const total = segments.reduce((s, x) => s + x.value, 0);
  const cx = size / 2;
  const r = size / 2 - 4;
  let angle = 0;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {total <= 0 ? (
          <Circle
            cx={cx}
            cy={cx}
            r={r - thickness / 2}
            stroke={t.colors.divider}
            strokeWidth={thickness}
            fill="none"
          />
        ) : (
          segments.map((s) => {
            const sweep = (s.value / total) * 360;
            const start = angle;
            angle += sweep;
            const dim = selectedKey && selectedKey !== s.key;
            const grow = selectedKey === s.key ? 3 : 0;
            return (
              <Path
                key={s.key}
                d={arcPath(cx, cx, r + grow, r - thickness, start, start + sweep)}
                fill={s.color}
                opacity={dim ? 0.35 : 1}
                stroke={gap}
                strokeWidth={segments.length > 1 ? 2 : 0}
                onPress={
                  onSelect ? () => onSelect(selectedKey === s.key ? null : s.key) : undefined
                }
              />
            );
          })
        )}
      </Svg>
      {center}
    </View>
  );
}
