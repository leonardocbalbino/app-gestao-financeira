import type { BillWithStatus } from '@/data/repositories/bills';
import type { BudgetWithSpending } from '@/data/repositories/budgets';
import { buildAlerts } from '../alerts';

const bill = (p: Partial<BillWithStatus>) =>
  ({
    id: 'b',
    name: 'Luz',
    amountCents: 10000,
    dueDate: '2026-11-20',
    status: 'upcoming',
    daysUntilDue: 10,
    ...p,
  }) as BillWithStatus;
const budget = (p: Partial<BudgetWithSpending>) =>
  ({
    id: 'g',
    categoryName: 'Lazer',
    spentCents: 0,
    limitCents: 10000,
    ratio: 0,
    ...p,
  }) as BudgetWithSpending;

describe('buildAlerts', () => {
  it('prioriza críticos e ignora o que está em dia', () => {
    const alerts = buildAlerts(
      [
        bill({ id: '1', status: 'due_soon', daysUntilDue: 0 }),
        bill({ id: '2', status: 'overdue' }),
        bill({ id: '3' }),
      ],
      [
        budget({ id: 'x', ratio: 0.85, spentCents: 8500 }),
        budget({ id: 'y', ratio: 1.2, spentCents: 12000 }),
        budget({ id: 'z', ratio: 0.5 }),
      ],
    );
    expect(alerts.map((a) => a.id)).toEqual(['bill-2', 'budget-y', 'bill-1', 'budget-x']);
    expect(alerts[2]?.title).toBe('Luz vence hoje');
    expect(alerts[3]?.title).toBe('85% do orçamento de Lazer');
  });
});
