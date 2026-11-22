import {
  ArrowLeftRight,
  Bell,
  Calendar,
  CalendarClock,
  Check,
  ChevronLeft,
  Car,
  ChartPie,
  ChevronRight,
  CircleEllipsis,
  Crown,
  Download,
  Eye,
  EyeOff,
  GraduationCap,
  HeartPulse,
  House,
  Lock,
  Mail,
  MessageCircle,
  Smartphone,
  Share2,
  Users,
  Copy,
  PartyPopper,
  Pencil,
  PiggyBank,
  Plus,
  Receipt,
  Repeat,
  Search,
  Settings,
  SlidersHorizontal,
  StickyNote,
  Trash2,
  ShoppingBag,
  Target,
  TrendingDown,
  TrendingUp,
  Utensils,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { View } from 'react-native';
import type { ReactNode } from 'react';
import type { ColorTokens } from '@app/shared/theme';
import { useTheme } from '@/theme/ThemeProvider';

/** Registro explícito (evita importar o pacote inteiro). Nomes = slugs lucide. */
export const ICONS = {
  'arrow-left-right': ArrowLeftRight,
  bell: Bell,
  calendar: Calendar,
  'calendar-clock': CalendarClock,
  check: Check,
  'chevron-left': ChevronLeft,
  car: Car,
  'chart-pie': ChartPie,
  'chevron-right': ChevronRight,
  'circle-ellipsis': CircleEllipsis,
  crown: Crown,
  download: Download,
  eye: Eye,
  'eye-off': EyeOff,
  'graduation-cap': GraduationCap,
  'heart-pulse': HeartPulse,
  house: House,
  lock: Lock,
  mail: Mail,
  'message-circle': MessageCircle,
  smartphone: Smartphone,
  share: Share2,
  users: Users,
  copy: Copy,
  'party-popper': PartyPopper,
  pencil: Pencil,
  'piggy-bank': PiggyBank,
  plus: Plus,
  receipt: Receipt,
  repeat: Repeat,
  search: Search,
  settings: Settings,
  'sliders-horizontal': SlidersHorizontal,
  'sticky-note': StickyNote,
  trash: Trash2,
  'shopping-bag': ShoppingBag,
  target: Target,
  'trending-down': TrendingDown,
  'trending-up': TrendingUp,
  utensils: Utensils,
  wallet: Wallet,
  x: X,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function isIconName(name: string): name is IconName {
  return name in ICONS;
}

interface Props {
  name: IconName | string;
  size?: number;
  color?: keyof ColorTokens;
  rawColor?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 20, color = 'ink', rawColor, strokeWidth = 2 }: Props) {
  const t = useTheme();
  const Cmp = isIconName(name) ? ICONS[name] : CircleEllipsis;
  return <Cmp size={size} color={rawColor ?? t.colors[color]} strokeWidth={strokeWidth} />;
}

interface BadgeProps {
  name: IconName | string;
  /** Cor de destaque (hex) — o fundo usa a mesma cor com transparência. */
  tint?: string;
  size?: number;
}

/** Ícone dentro de um quadrado arredondado (categorias, contas). */
export function IconBadge({ name, tint, size = 40 }: BadgeProps) {
  const t = useTheme();
  const color = tint ?? t.colors.primary;
  return (
    <IconBadgeFrame size={size} bg={`${color}22`}>
      <Icon name={name} size={size * 0.5} rawColor={color} />
    </IconBadgeFrame>
  );
}

function IconBadgeFrame({ size, bg, children }: { size: number; bg: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: t.radii.chip,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
  );
}
