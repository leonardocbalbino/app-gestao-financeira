import type { BillingService } from './types';

/** Usado quando a loja não está disponível (Expo Go, testes, chave ausente). */
export const noopBilling: BillingService = {
  isAvailable: () => false,
  configure: async () => undefined,
  getPackages: async () => [],
  purchase: async () => ({ status: 'error', message: 'Compras indisponíveis neste aparelho.' }),
  restore: async () => ({ status: 'error', message: 'Compras indisponíveis neste aparelho.' }),
  manageSubscription: async () => undefined,
  onCustomerInfoChange: () => () => undefined,
};
