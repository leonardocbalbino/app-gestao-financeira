import { formatBRL, formatShortDate } from '@app/shared';
import type { BillWithStatus } from '@/data/repositories/bills';
import type { BudgetWithSpending } from '@/data/repositories/budgets';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface AppAlert {
  id: string;
  severity: AlertSeverity;
  icon: string;
  title: string;
  message: string;
  href: '/bills' | '/budgets';
}

const ORDER: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };

/** Alertas in-app derivados dos dados locais (contas atrasadas/próximas, orçamentos ≥ 80%). */
export function buildAlerts(
  bills: BillWithStatus[],
  budgets: BudgetWithSpending[],
  opts: { budgetAlerts?: boolean } = {},
): AppAlert[] {
  const out: AppAlert[] = [];
  for (const b of bills) {
    if (b.status === 'overdue') {
      out.push({
        id: `bill-${b.id}`,
        severity: 'critical',
        icon: 'calendar-clock',
        title: `${b.name} está atrasada`,
        message: `${formatBRL(b.amountCents)} · venceu ${formatShortDate(b.dueDate)}`,
        href: '/bills',
      });
    } else if (b.status === 'due_soon') {
      out.push({
        id: `bill-${b.id}`,
        severity: 'warning',
        icon: 'calendar-clock',
        title:
          b.daysUntilDue === 0
            ? `${b.name} vence hoje`
            : `${b.name} vence em ${b.daysUntilDue} dia(s)`,
        message: formatBRL(b.amountCents),
        href: '/bills',
      });
    }
  }
  for (const b of opts.budgetAlerts === false ? [] : budgets) {
    if (b.ratio >= 1) {
      out.push({
        id: `budget-${b.id}`,
        severity: 'critical',
        icon: 'wallet',
        title: `Orçamento de ${b.categoryName} estourado`,
        message: `${formatBRL(b.spentCents)} de ${formatBRL(b.limitCents)}`,
        href: '/budgets',
      });
    } else if (b.ratio >= 0.8) {
      out.push({
        id: `budget-${b.id}`,
        severity: 'warning',
        icon: 'wallet',
        title: `${Math.round(b.ratio * 100)}% do orçamento de ${b.categoryName}`,
        message: `Restam ${formatBRL(b.limitCents - b.spentCents)}`,
        href: '/budgets',
      });
    }
  }
  return out.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}
