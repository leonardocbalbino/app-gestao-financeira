import {
  brand,
  formatBRL,
  formatMonth,
  formatShortDate,
  percent,
  type MonthKey,
} from '@app/shared';
import type {
  CategorySpending,
  PeriodSummary,
  TransactionListItem,
} from '@/data/repositories/transactions';

const BOM = String.fromCharCode(0xfeff);
const CRLF = String.fromCharCode(13, 10);
const KIND = { expense: 'Despesa', income: 'Receita', transfer: 'Transferência' } as const;

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // Neutraliza fórmulas, mas preserva números (ex.: "-1234,56").
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(,\d+)?$/.test(s)) s = `'${s}`;
  if (/[";\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Valor para planilha pt-BR: "1234,56" (sem "R$", sinal ASCII para a planilha somar). */
export function csvAmount(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

/** "2026-11-21" → "21/11/2026" */
export function csvDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** CSV para Excel/Planilhas em pt-BR (";" e BOM). Despesas saem negativas. */
export function transactionsToCsv(items: TransactionListItem[]): string {
  const header = ['Data', 'Tipo', 'Descrição', 'Categoria', 'Conta', 'Valor (R$)', 'Observações'];
  const rows = items.map((t) => [
    csvDate(t.date),
    KIND[t.kind],
    t.description,
    t.kind === 'transfer' ? '' : (t.categoryName ?? ''),
    t.accountName ?? '',
    csvAmount(t.kind === 'expense' ? -t.amountCents : t.amountCents),
    t.notes ?? '',
  ]);
  return BOM + [header, ...rows].map((r) => r.map(csvCell).join(';')).join(CRLF) + CRLF;
}

export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

export interface MonthlyReportData {
  month: MonthKey;
  summary: PeriodSummary;
  byCategory: CategorySpending[];
  transactions: TransactionListItem[];
  generatedAt?: Date;
}

/** HTML do relatório mensal (impresso em PDF pelo expo-print). Usa só os tokens do tema. */
export function monthlyReportHtml(d: MonthlyReportData): string {
  const e = escapeHtml;
  const gen = (d.generatedAt ?? new Date()).toLocaleDateString('pt-BR');
  const catRows = d.byCategory
    .map(
      (c) => `<tr><td><span class="dot" style="background:${e(c.color)}"></span>${e(c.name)}</td>
        <td class="num">${percent(c.totalCents, d.summary.expenseCents)}%</td>
        <td class="num">${e(formatBRL(c.totalCents))}</td></tr>`,
    )
    .join('');
  const txRows = d.transactions
    .map((t) => {
      const v = t.kind === 'expense' ? -t.amountCents : t.amountCents;
      return `<tr><td>${e(formatShortDate(t.date))}</td>
        <td>${e(t.description || t.categoryName || KIND[t.kind])}</td>
        <td>${e(t.kind === 'transfer' ? 'Transferência' : (t.categoryName ?? ''))}</td>
        <td class="num ${t.kind === 'expense' ? 'neg' : t.kind === 'income' ? 'pos' : ''}">${e(
          formatBRL(v, { signed: t.kind === 'income' }),
        )}</td></tr>`;
    })
    .join('');

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<style>
  @page { margin: 24px; }
  body { font-family: -apple-system, 'Helvetica Neue', Roboto, sans-serif; color: #14201B; font-size: 12px; }
  h1 { font-size: 20px; margin: 0; } h2 { font-size: 14px; margin: 24px 0 8px; }
  .muted { color: #5B6661; }
  .cards { display: flex; gap: 12px; margin-top: 16px; }
  .card { flex: 1; border: 1px solid #E6E9E5; border-radius: 14px; padding: 12px; }
  .card b { display: block; font-size: 16px; margin-top: 4px; font-variant-numeric: tabular-nums; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 6px 4px; border-bottom: 1px solid #EEF0ED; text-align: left; }
  th { color: #5B6661; font-weight: 600; font-size: 11px; text-transform: uppercase; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .neg { color: #C2410C; } .pos { color: #0B6E4F; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 3px; margin-right: 6px; }
  footer { margin-top: 24px; font-size: 10px; color: #8C948F; }
</style></head><body>
  <h1>Relatório de ${e(formatMonth(d.month))}</h1>
  <div class="muted">${e(brand.name)} · gerado em ${e(gen)}</div>
  <div class="cards">
    <div class="card"><span class="muted">Entradas</span><b class="pos">${e(formatBRL(d.summary.incomeCents))}</b></div>
    <div class="card"><span class="muted">Saídas</span><b class="neg">${e(formatBRL(d.summary.expenseCents))}</b></div>
    <div class="card"><span class="muted">Saldo</span><b>${e(formatBRL(d.summary.netCents))}</b></div>
  </div>
  <h2>Gastos por categoria</h2>
  <table><thead><tr><th>Categoria</th><th class="num">%</th><th class="num">Valor</th></tr></thead>
  <tbody>${catRows || '<tr><td colspan="3" class="muted">Sem gastos no mês.</td></tr>'}</tbody></table>
  <h2>Transações (${d.transactions.length})</h2>
  <table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th class="num">Valor</th></tr></thead>
  <tbody>${txRows || '<tr><td colspan="4" class="muted">Nenhuma transação.</td></tr>'}</tbody></table>
  <footer>Valores em reais (BRL). Documento gerado no aparelho; nenhum dado foi enviado a terceiros.</footer>
</body></html>`;
}
