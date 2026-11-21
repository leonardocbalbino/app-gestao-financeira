export type BillingPeriod = 'monthly' | 'annual';

export interface PaywallPackage {
  id: string;
  period: BillingPeriod;
  /** Preço formatado pela loja (ex.: "R$ 14,90"). */
  priceString: string;
  /** Preço em centavos (para calcular economia). */
  priceCents: number;
  /** Preço mensal equivalente formatado (anual / 12). */
  monthlyEquivalent?: string;
  trialDays?: number;
}

export type PurchaseResult =
  { status: 'success' } | { status: 'cancelled' } | { status: 'error'; message: string };

/** Abstração de cobrança (RevenueCat no app; stub em testes/Expo Go). */
export interface BillingService {
  isAvailable(): boolean;
  configure(userId: string | null): Promise<void>;
  getPackages(): Promise<PaywallPackage[]>;
  purchase(packageId: string): Promise<PurchaseResult>;
  restore(): Promise<PurchaseResult>;
  /** Abre a gestão de assinatura da loja. */
  manageSubscription(): Promise<void>;
  /** cb recebe se o entitlement Pro está ativo na loja. */
  onCustomerInfoChange(cb: (hasPro: boolean) => void): () => void;
}
