/**
 * Lógica pura do webhook do RevenueCat (sem APIs do Deno) — testada com vitest em packages/shared.
 * Docs de eventos: https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
 */

export type SubscriptionStatus = 'active' | 'in_grace' | 'cancelled' | 'billing_issue' | 'expired';

export interface RevenueCatEvent {
  id: string;
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  transferred_to?: string[];
  transferred_from?: string[];
  entitlement_ids?: string[] | null;
  entitlement_id?: string | null;
  product_id?: string;
  period_type?: string;
  store?: string;
  expiration_at_ms?: number | null;
  grace_period_expiration_at_ms?: number | null;
  event_timestamp_ms?: number;
  original_transaction_id?: string;
}

export interface SubscriptionUpsert {
  user_id: string;
  rc_entitlement: string;
  status: SubscriptionStatus;
  store: string | null;
  product_id: string | null;
  period_type: string | null;
  expires_at: string | null;
  original_transaction_id: string | null;
  last_event_id: string;
  last_event_at: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Comparação em tempo constante do header Authorization com o segredo configurado. */
export function isAuthorized(header: string | null, secret: string): boolean {
  if (!secret || !header) return false;
  const expected = `Bearer ${secret}`;
  const a = new TextEncoder().encode(header);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** O app faz Purchases.logIn(supabaseUserId); IDs anônimos do RevenueCat são ignorados. */
export function resolveUserId(e: RevenueCatEvent): string | null {
  const candidates = [e.app_user_id, e.original_app_user_id, ...(e.aliases ?? [])];
  return candidates.find((c): c is string => !!c && UUID_RE.test(c)) ?? null;
}

export function statusForEvent(type: string): SubscriptionStatus | null {
  switch (type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'PRODUCT_CHANGE':
    case 'UNCANCELLATION':
    case 'NON_RENEWING_PURCHASE':
    case 'SUBSCRIPTION_EXTENDED':
    case 'TEMPORARY_ENTITLEMENT_GRANT':
      return 'active';
    case 'CANCELLATION':
      // Cancelou a renovação: continua válido até expires_at.
      return 'cancelled';
    case 'BILLING_ISSUE':
      return 'billing_issue';
    case 'EXPIRATION':
    case 'SUBSCRIPTION_PAUSED':
      return 'expired';
    default:
      return null; // TEST, TRANSFER (tratado à parte), etc.
  }
}

/** Converte um evento em upsert de subscriptions (ou null se não se aplica). */
export function mapEvent(e: RevenueCatEvent, entitlement = 'pro'): SubscriptionUpsert | null {
  const status = statusForEvent(e.type);
  if (!status) return null;
  const ents = e.entitlement_ids ?? (e.entitlement_id ? [e.entitlement_id] : []);
  if (ents.length && !ents.includes(entitlement)) return null;
  const userId = resolveUserId(e);
  if (!userId) return null;
  const expiresMs =
    status === 'billing_issue' && e.grace_period_expiration_at_ms
      ? e.grace_period_expiration_at_ms
      : (e.expiration_at_ms ?? null);
  return {
    user_id: userId,
    rc_entitlement: entitlement,
    status: status === 'billing_issue' && e.grace_period_expiration_at_ms ? 'in_grace' : status,
    store: e.store ?? null,
    product_id: e.product_id ?? null,
    period_type: e.period_type ?? null,
    expires_at: expiresMs ? new Date(expiresMs).toISOString() : null,
    original_transaction_id: e.original_transaction_id ?? null,
    last_event_id: e.id,
    last_event_at: new Date(e.event_timestamp_ms ?? Date.now()).toISOString(),
  };
}

/** Eventos fora de ordem (mais antigos que o último aplicado) ou repetidos são ignorados. */
export function shouldApply(
  incoming: Pick<SubscriptionUpsert, 'last_event_id' | 'last_event_at'>,
  current: { last_event_id: string | null; last_event_at: string | null } | null,
): boolean {
  if (!current) return true;
  if (current.last_event_id === incoming.last_event_id) return false;
  if (!current.last_event_at) return true;
  return new Date(incoming.last_event_at).getTime() >= new Date(current.last_event_at).getTime();
}
