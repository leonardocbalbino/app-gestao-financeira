/** Todo valor monetário é armazenado em centavos (inteiro). */
export type Cents = number;

/** Sinal de menos tipográfico. */
export const MINUS = '−';

function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export interface FormatBRLOptions {
  /** Exibe "+" para positivos (ex.: receitas). */
  signed?: boolean;
  /** Oculta "R$". */
  hideSymbol?: boolean;
  /** Omite centavos quando zerados (ex.: eixos de gráfico). */
  compactCents?: boolean;
}

/** 123456 → "R$ 1.234,56"; -123456 → "−R$ 1.234,56". Determinístico (não depende de Intl). */
export function formatBRL(cents: Cents, opts: FormatBRLOptions = {}): string {
  const safe = Number.isFinite(cents) ? Math.round(cents) : 0;
  const abs = Math.abs(safe);
  const int = Math.floor(abs / 100).toString();
  const dec = (abs % 100).toString().padStart(2, '0');
  const body =
    opts.compactCents && dec === '00' ? groupThousands(int) : `${groupThousands(int)},${dec}`;
  const value = opts.hideSymbol ? body : `R$ ${body}`;
  if (safe < 0) return `${MINUS}${value}`;
  if (opts.signed && safe > 0) return `+${value}`;
  return value;
}

/** Formato curto para eixos e chips: "R$ 1,2 mil", "R$ 3,4 mi". */
export function formatBRLShort(cents: Cents): string {
  const reais = Math.abs(cents) / 100;
  const sign = cents < 0 ? MINUS : '';
  const fmt = (n: number) => n.toFixed(1).replace('.', ',').replace(/,0$/, '');
  if (reais >= 1_000_000) return `${sign}R$ ${fmt(reais / 1_000_000)} mi`;
  if (reais >= 1_000) return `${sign}R$ ${fmt(reais / 1_000)} mil`;
  return `${sign}R$ ${Math.round(reais)}`;
}

/**
 * Converte texto digitado em centavos. Aceita "1.234,56", "1234,5", "1234.56", "R$ 12".
 * Retorna null se inválido.
 */
export function parseBRL(input: string): Cents | null {
  const cleaned = input.replace(/R\$|\s/g, '').replace(MINUS, '-');
  if (!cleaned) return null;
  let normalized: string;
  if (cleaned.includes(',')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, '');
  } else {
    normalized = cleaned;
  }
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const negative = normalized.startsWith('-');
  const [i = '0', d = ''] = normalized.replace('-', '').split('.');
  const cents = Number(i) * 100 + Number(d.padEnd(2, '0'));
  return negative ? -cents : cents;
}

/**
 * Máscara estilo "caixa registradora": cada dígito entra pela direita.
 * "1" → 1 centavo; "123" → 123 centavos (R$ 1,23).
 */
export function centsFromDigits(digits: string): Cents {
  const only = digits.replace(/\D/g, '').slice(0, 13);
  return only ? Number(only) : 0;
}

/** Percentual inteiro seguro (0 quando total = 0). */
export function percent(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}
