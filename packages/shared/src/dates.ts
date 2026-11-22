const MONTHS_SHORT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const;
const MONTHS_LONG = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'] as const;

/** Datas de transação são "datas civis" no formato YYYY-MM-DD (sem fuso). */
export type ISODate = string;
/** Chave de mês "2026-11". */
export type MonthKey = string;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISODate(iso: ISODate): Date {
  const [y = 1970, m = 1, d = 1] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "21 nov" */
export function formatShortDate(iso: ISODate): string {
  const d = fromISODate(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** "Hoje · 21 nov", "Ontem · 20 nov", "Quarta · 19 nov" (até 6 dias), senão "12 nov". */
export function formatRelativeDay(iso: ISODate, today: Date = new Date()): string {
  const d = fromISODate(iso);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((t.getTime() - d.getTime()) / 86_400_000);
  const short = formatShortDate(iso);
  if (diff === 0) return `Hoje · ${short}`;
  if (diff === 1) return `Ontem · ${short}`;
  if (diff === -1) return `Amanhã · ${short}`;
  if (diff > 1 && diff < 7) return `${capitalize(WEEKDAYS[d.getDay()] ?? '')} · ${short}`;
  return d.getFullYear() === t.getFullYear() ? short : `${short} ${d.getFullYear()}`;
}

/** "Novembro 2026" ou "Novembro". */
export function formatMonth(key: MonthKey, withYear = true): string {
  const [y, m = 1] = key.split('-').map(Number);
  const name = capitalize(MONTHS_LONG[m - 1] ?? '');
  return withYear ? `${name} ${y}` : name;
}

export function monthShort(monthIndex0: number): string {
  return MONTHS_SHORT[monthIndex0] ?? '';
}

export function monthKey(d: Date | ISODate): MonthKey {
  const date = typeof d === 'string' ? fromISODate(d) : d;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthRange(key: MonthKey): { start: ISODate; end: ISODate } {
  const [y = 1970, m = 1] = key.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { start: `${key}-01`, end: `${key}-${String(last).padStart(2, '0')}` };
}

export function addMonths(key: MonthKey, delta: number): MonthKey {
  const [y = 1970, m = 1] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

export function addDays(iso: ISODate, delta: number): ISODate {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + delta);
  return toISODate(d);
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / 86_400_000);
}

/** Saudação conforme horário. */
export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Soma meses a uma data civil, ajustando ao último dia do mês (31 jan + 1 → 28/29 fev). */
export function addMonthsToDate(iso: ISODate, delta: number): ISODate {
  const d = fromISODate(iso);
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + delta, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, last));
  return toISODate(target);
}

/**
 * Próxima ocorrência. Mensal/anual usam o dia âncora (dia original do vencimento) para não
 * desviar: 31 jan → 28 fev → 31 mar. Sem âncora, usa o dia da data informada.
 */
export function nextOccurrence(
  iso: ISODate,
  recurrence: 'none' | 'weekly' | 'monthly' | 'yearly',
  anchorDay?: number | null,
): ISODate | null {
  if (recurrence === 'none') return null;
  if (recurrence === 'weekly') return addDays(iso, 7);
  const months = recurrence === 'monthly' ? 1 : 12;
  const [y = 1970, m = 1] = iso.split('-').map(Number);
  const target = new Date(y, m - 1 + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const day = Math.min(anchorDay ?? Number(iso.slice(8, 10)), last);
  return toISODate(new Date(target.getFullYear(), target.getMonth(), day));
}
