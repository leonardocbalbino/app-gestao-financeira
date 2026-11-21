import type { LimitFeatureKey } from '@app/shared';
import type { AppDB } from '@/data/db';
import { countActiveAccounts } from '@/data/repositories/accounts';
import { countBudgets } from '@/data/repositories/budgets';
import { countGoals } from '@/data/repositories/goals';

/** Quanto do limite está em uso, contado no banco local. */
export function countUsage(db: AppDB, key: LimitFeatureKey): number {
  switch (key) {
    case 'accounts.max':
      return countActiveAccounts(db);
    case 'budgets.max':
      return countBudgets(db);
    case 'goals.max':
      return countGoals(db);
    case 'members.max':
      return 1;
    case 'history.months':
      return 0;
  }
}
