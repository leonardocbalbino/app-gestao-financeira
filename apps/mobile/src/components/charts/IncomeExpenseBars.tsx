import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { G, Line, Path } from 'react-native-svg';
import { chartColors } from '@app/shared/theme';
import { formatBRL, formatBRLShort, formatMonth, monthShort } from '@app/shared';
import type { MonthTotals } from '@/data/repositories/transactions';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/components/ui';

interface Props {
  data: MonthTotals[];
  height?: number;
  width: number;
}

/** Barra com topo arredondado (4px) ancorada na base. */
function barPath(x: number, w: number, base: number, h: number) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  const top = base - h;
  return `M ${x} ${base} L ${x} ${top + r} Q ${x} ${top} ${x + r} ${top} L ${x + w - r} ${top} Q ${x + w} ${top} ${x + w} ${top + r} L ${x + w} ${base} Z`;
}

/** Escala "bonita" para o eixo: 1, 2, 2.5, 5 × 10^n. */
export function niceMax(v: number): number {
  if (v <= 0) return 100;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * exp;
}

/**
 * Entradas × saídas por mês. Um único eixo y. Posição fixa no grupo (entrada à esquerda,
 * saída à direita) + legenda = codificação secundária além da cor. Toque mostra os valores.
 */
export function IncomeExpenseBars({ data, height = 180, width }: Props) {
  const t = useTheme();
  const colors = chartColors(t.scheme);
  const [selected, setSelected] = useState<number>(data.length - 1);
  const axisW = 48;
  const plotW = Math.max(0, width - axisW);
  const plotH = height - 24;
  const max = niceMax(Math.max(...data.map((d) => Math.max(d.incomeCents, d.expenseCents)), 0));
  const groupW = data.length ? plotW / data.length : 0;
  const barW = Math.min(14, groupW / 3);
  const sel = data[selected];

  return (
    <View style={{ gap: t.spacing.md }}>
      <View style={{ flexDirection: 'row', gap: t.spacing.lg }}>
        {[
          { label: 'Entradas', color: colors.income },
          { label: 'Saídas', color: colors.expense },
        ].map((l) => (
          <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: l.color }} />
            <AppText variant="caption" color="inkMuted">
              {l.label}
            </AppText>
          </View>
        ))}
      </View>

      {sel ? (
        <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: t.spacing.lg }}>
          <AppText variant="caption" weight="bold">
            {formatMonth(sel.month)}
          </AppText>
          <AppText variant="caption" tabular>
            Entradas {formatBRL(sel.incomeCents)}
          </AppText>
          <AppText variant="caption" tabular>
            Saídas {formatBRL(sel.expenseCents)}
          </AppText>
        </View>
      ) : null}

      <View style={{ height, width }}>
        <Svg width={width} height={height} style={{ position: 'absolute' }}>
          {[0, 0.5, 1].map((f) => (
            <Line
              key={f}
              x1={axisW}
              x2={width}
              y1={plotH - plotH * f}
              y2={plotH - plotH * f}
              stroke={t.colors.divider}
              strokeWidth={1}
            />
          ))}
          {data.map((d, i) => {
            const gx = axisW + i * groupW + groupW / 2;
            const hi = (d.incomeCents / max) * plotH;
            const he = (d.expenseCents / max) * plotH;
            const dim = i !== selected ? 0.45 : 1;
            return (
              <G key={d.month}>
                <Path
                  d={barPath(gx - barW - 1, barW, plotH, hi)}
                  fill={colors.income}
                  opacity={dim}
                />
                <Path d={barPath(gx + 1, barW, plotH, he)} fill={colors.expense} opacity={dim} />
              </G>
            );
          })}
        </Svg>
        {[1, 0.5, 0].map((f) => (
          <AppText
            key={f}
            variant="micro"
            color="inkMuted"
            tabular
            style={{ position: 'absolute', left: 0, top: plotH - plotH * f - 7, width: axisW - 6 }}
          >
            {formatBRLShort(max * f)}
          </AppText>
        ))}
        {data.map((d, i) => {
          const mIdx = Number(d.month.slice(5)) - 1;
          return (
            <Pressable
              key={d.month}
              accessibilityRole="button"
              accessibilityLabel={`${formatMonth(d.month)}: entradas ${formatBRL(d.incomeCents)}, saídas ${formatBRL(d.expenseCents)}`}
              accessibilityState={{ selected: i === selected }}
              onPress={() => setSelected(i)}
              style={{
                position: 'absolute',
                left: axisW + i * groupW,
                width: groupW,
                top: 0,
                height,
                justifyContent: 'flex-end',
                alignItems: 'center',
              }}
            >
              <AppText variant="micro" color={i === selected ? 'ink' : 'inkMuted'}>
                {monthShort(mIdx)}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
