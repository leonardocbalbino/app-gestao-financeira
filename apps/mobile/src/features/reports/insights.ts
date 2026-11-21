import { formatBRL, percent } from '@app/shared';
import type { CategorySpending, PeriodSummary } from '@/data/repositories/transactions';

export interface Insight {
  id: string;
  icon: string;
  text: string;
}

/** Insights determinísticos do mês, a partir de dados locais (sem enviar nada a servidores). */
export function monthlyInsights(
  current: PeriodSummary,
  previous: PeriodSummary,
  byCat: CategorySpending[],
  prevByCat: CategorySpending[],
): Insight[] {
  const out: Insight[] = [];
  if (current.incomeCents > 0) {
    const rate = percent(current.netCents, current.incomeCents);
    out.push({
      id: 'savings',
      icon: rate >= 0 ? 'piggy-bank' : 'trending-down',
      text:
        rate >= 0
          ? `Você guardou ${rate}% do que recebeu este mês.`
          : `Você gastou ${formatBRL(-current.netCents)} a mais do que recebeu.`,
    });
  }
  const top = byCat[0];
  if (top && current.expenseCents > 0) {
    out.push({
      id: 'top',
      icon: top.icon,
      text: `${top.name} foi seu maior gasto: ${percent(top.totalCents, current.expenseCents)}% das despesas.`,
    });
  }
  // Maior aumento por categoria vs mês anterior
  let worst: { name: string; diff: number } | null = null;
  for (const c of byCat) {
    const prev = prevByCat.find((p) => p.categoryId === c.categoryId)?.totalCents ?? 0;
    const diff = c.totalCents - prev;
    if (prev > 0 && diff > 0 && (!worst || diff > worst.diff)) worst = { name: c.name, diff };
  }
  if (worst) {
    out.push({
      id: 'increase',
      icon: 'trending-up',
      text: `${worst.name} subiu ${formatBRL(worst.diff)} em relação ao mês anterior.`,
    });
  } else if (previous.expenseCents > 0 && current.expenseCents < previous.expenseCents) {
    out.push({
      id: 'decrease',
      icon: 'trending-down',
      text: `Seus gastos caíram ${formatBRL(previous.expenseCents - current.expenseCents)} em relação ao mês anterior.`,
    });
  }
  return out;
}
