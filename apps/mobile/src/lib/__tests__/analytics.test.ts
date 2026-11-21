import { analytics, sanitize, type AnalyticsProvider } from '../analytics';

describe('analytics', () => {
  it('remove propriedades sensíveis', () => {
    expect(
      sanitize({
        source: 'export.pdf',
        amountCents: 100,
        description: 'x',
        email: 'a@b',
        kind: 'expense',
      }),
    ).toEqual({
      source: 'export.pdf',
      kind: 'expense',
    });
  });
  it('encaminha para o provider configurado', () => {
    const track = jest.fn();
    const p: AnalyticsProvider = { identify: jest.fn(), track, reset: jest.fn() };
    analytics.setProvider(p);
    analytics.track('paywall_viewed', { source: 'settings' });
    expect(track).toHaveBeenCalledWith('paywall_viewed', { source: 'settings' });
  });
});
