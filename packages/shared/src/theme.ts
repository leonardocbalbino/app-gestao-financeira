/**
 * Design tokens. Use APENAS estes valores nas UIs (mobile e admin).
 */
export const palette = {
  primary: '#0B6E4F',
  primaryDark: '#08513A',
  primarySoft: '#E3F1EA',
  primaryTint: '#CFE8DD',
  chart2: '#6FB89A',
  danger: '#C2410C',
  dangerSoft: '#FCE9DF',
  chart4: '#F3C49B',
  pro: '#E8B64C',
  proInk: '#5E4100',
  proSoft: '#FBF5E6',
  ink: '#14201B',
  inkMuted: '#5B6661',
  inkSubtle: '#8C948F',
  inkFaint: '#A9B1AC',
  bg: '#F5F6F4',
  surface: '#FFFFFF',
  border: '#E6E9E5',
  divider: '#EEF0ED',
  chipBorder: '#D5DAD6',
} as const;

export type ColorTokens = { [K in keyof typeof palette]: string } & {
  onPrimary: string;
  overlay: string;
};

export const lightColors: ColorTokens = {
  ...palette,
  onPrimary: '#FFFFFF',
  overlay: 'rgba(20,32,27,0.45)',
};

/** Tema escuro derivado da mesma paleta (contraste AA verificado em testes). */
export const darkColors: ColorTokens = {
  primary: '#6FB89A',
  primaryDark: '#0B6E4F',
  primarySoft: '#16302A',
  primaryTint: '#1E4136',
  chart2: '#0B6E4F',
  danger: '#F3A27A',
  dangerSoft: '#3A2219',
  chart4: '#C2410C',
  pro: '#E8B64C',
  proInk: '#FBF5E6',
  proSoft: '#352B12',
  ink: '#EEF0ED',
  inkMuted: '#A9B1AC',
  inkSubtle: '#8C948F',
  inkFaint: '#5B6661',
  bg: '#0E1512',
  surface: '#16201C',
  border: '#26312C',
  divider: '#1E2924',
  chipBorder: '#33403A',
  onPrimary: '#0E1512',
  overlay: 'rgba(0,0,0,0.6)',
};

export const radii = {
  card: 20,
  button: 14,
  input: 14,
  chip: 12,
  progress: 3,
  pill: 999,
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontFamily: fontFamily.extrabold, letterSpacing: -0.6 },
  title: { fontSize: 22, lineHeight: 28, fontFamily: fontFamily.bold, letterSpacing: -0.3 },
  headline: { fontSize: 17, lineHeight: 22, fontFamily: fontFamily.bold, letterSpacing: 0 },
  body: { fontSize: 15, lineHeight: 21, fontFamily: fontFamily.medium, letterSpacing: 0 },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontFamily: fontFamily.semibold, letterSpacing: 0 },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: fontFamily.medium, letterSpacing: 0 },
  micro: { fontSize: 11, lineHeight: 14, fontFamily: fontFamily.semibold, letterSpacing: 0.4 },
} as const;

export type TypographyVariant = keyof typeof typography;

/** Área mínima de toque (a11y). */
export const minTouchTarget = 44;

/** Cores de série para gráficos (ordem estável). */
export function chartSeries(c: ColorTokens): string[] {
  return [c.primary, c.chart2, c.chart4, c.danger, c.pro, c.inkSubtle];
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const channel = (i: number) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/** Razão de contraste WCAG entre duas cores hex (#RRGGBB). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
