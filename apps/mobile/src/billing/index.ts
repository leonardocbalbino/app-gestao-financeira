import type { BillingService } from './types';
import { noopBilling } from './noopBilling';

let service: BillingService = noopBilling;

/** Serviço de cobrança atual (substituído pelo RevenueCat na inicialização do app). */
export function billing(): BillingService {
  return service;
}

export function setBillingService(s: BillingService): void {
  service = s;
}

export type { BillingService, PaywallPackage, PurchaseResult, BillingPeriod } from './types';
