import { formatDue, fromDueIso, toDueIso } from '../format';
import { upgradeFeatureFromError } from '../hooks';
import { ApiRequestError } from '@/lib/api';

describe('formato de vencimento', () => {
  it('ida e volta mantém data e hora locais', () => {
    const iso = toDueIso('2026-12-05', '09:30');
    expect(fromDueIso(iso)).toEqual({ date: '2026-12-05', time: '09:30' });
  });
  it('texto relativo', () => {
    const now = new Date(2026, 10, 21, 8, 0);
    expect(formatDue(toDueIso('2026-11-21', '18:00'), now)).toBe('Hoje · 21 nov às 18:00');
  });
});

describe('erros que pedem upgrade', () => {
  it('extrai a funcionalidade', () => {
    expect(
      upgradeFeatureFromError(new ApiRequestError(409, 'feature_required:reminders.sms', 'x')),
    ).toBe('reminders.sms');
    expect(
      upgradeFeatureFromError(new ApiRequestError(409, 'limit_reached:reminders.max', 'x')),
    ).toBe('reminders.max');
    expect(upgradeFeatureFromError(new Error('x'))).toBeNull();
  });
});
