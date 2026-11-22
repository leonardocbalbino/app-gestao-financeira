import { describe, expect, it } from 'vitest';
import {
  isAuthorized,
  mapEvent,
  resolveUserId,
  shouldApply,
  statusForEvent,
} from '../src/billing/revenuecat.ts';

const uid = '7d0f6f8e-4b1a-4c2e-9d6b-1f2e3a4b5c6d';
const base = {
  id: 'evt_1',
  type: 'INITIAL_PURCHASE',
  app_user_id: uid,
  entitlement_ids: ['pro'],
  product_id: 'pro_annual',
  store: 'APP_STORE',
  period_type: 'NORMAL',
  expiration_at_ms: Date.UTC(2027, 10, 21),
  event_timestamp_ms: Date.UTC(2026, 10, 21),
};

describe('webhook RevenueCat', () => {
  it('valida o segredo em tempo constante', () => {
    expect(isAuthorized('Bearer s3cr3t', 's3cr3t')).toBe(true);
    expect(isAuthorized('Bearer errado', 's3cr3t')).toBe(false);
    expect(isAuthorized(null, 's3cr3t')).toBe(false);
    expect(isAuthorized('Bearer ', '')).toBe(false);
  });

  it('mapeia tipos de evento', () => {
    expect(statusForEvent('RENEWAL')).toBe('active');
    expect(statusForEvent('CANCELLATION')).toBe('cancelled');
    expect(statusForEvent('EXPIRATION')).toBe('expired');
    expect(statusForEvent('TEST')).toBeNull();
  });

  it('gera upsert com expiração', () => {
    expect(mapEvent(base)).toMatchObject({
      user_id: uid,
      status: 'active',
      expires_at: '2027-11-21T00:00:00.000Z',
      product_id: 'pro_annual',
    });
  });

  it('problema de cobrança com período de carência', () => {
    const m = mapEvent({
      ...base,
      type: 'BILLING_ISSUE',
      grace_period_expiration_at_ms: Date.UTC(2026, 11, 5),
    });
    expect(m).toMatchObject({ status: 'in_grace', expires_at: '2026-12-05T00:00:00.000Z' });
  });

  it('ignora IDs anônimos e outros entitlements', () => {
    expect(
      resolveUserId({ id: 'x', type: 'X', app_user_id: '$RCAnonymousID:abc', aliases: [uid] }),
    ).toBe(uid);
    expect(mapEvent({ ...base, app_user_id: '$RCAnonymousID:abc' })).toBeNull();
    expect(mapEvent({ ...base, entitlement_ids: ['outro'] })).toBeNull();
  });

  it('idempotência e ordem', () => {
    const inc = { last_event_id: 'b', last_event_at: '2026-11-21T10:00:00Z' };
    expect(shouldApply(inc, null)).toBe(true);
    expect(shouldApply(inc, { last_event_id: 'b', last_event_at: '2026-11-21T10:00:00Z' })).toBe(
      false,
    );
    expect(shouldApply(inc, { last_event_id: 'a', last_event_at: '2026-11-21T11:00:00Z' })).toBe(
      false,
    );
    expect(shouldApply(inc, { last_event_id: 'a', last_event_at: '2026-11-21T09:00:00Z' })).toBe(
      true,
    );
  });
});
