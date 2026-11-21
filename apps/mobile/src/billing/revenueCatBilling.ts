import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PACKAGE_TYPE,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';
import { env } from '@/lib/env';
import type { BillingService, PaywallPackage, PurchaseResult } from './types';

/** Entitlement configurado no RevenueCat (produtos pro_monthly / pro_annual). */
export const RC_ENTITLEMENT = 'pro';

function apiKey(): string {
  return Platform.OS === 'ios' ? env.revenueCatIosKey : env.revenueCatAndroidKey;
}

function toPaywallPackage(p: PurchasesPackage): PaywallPackage | null {
  const period =
    p.packageType === PACKAGE_TYPE.MONTHLY
      ? 'monthly'
      : p.packageType === PACKAGE_TYPE.ANNUAL
        ? 'annual'
        : null;
  if (!period) return null;
  const intro = p.product.introPrice;
  return {
    id: p.identifier,
    period,
    priceString: p.product.priceString,
    priceCents: Math.round(p.product.price * 100),
    monthlyEquivalent:
      period === 'annual' ? (p.product.pricePerMonthString ?? undefined) : undefined,
    trialDays:
      intro && intro.price === 0
        ? intro.periodUnit === 'DAY'
          ? intro.periodNumberOfUnits
          : intro.periodUnit === 'WEEK'
            ? intro.periodNumberOfUnits * 7
            : intro.periodUnit === 'MONTH'
              ? intro.periodNumberOfUnits * 30
              : undefined
        : undefined,
  };
}

function errorResult(e: unknown): PurchaseResult {
  const err = e as { userCancelled?: boolean; message?: string };
  if (err?.userCancelled) return { status: 'cancelled' };
  return { status: 'error', message: err?.message ?? 'Erro desconhecido na compra.' };
}

export function hasProEntitlement(info: CustomerInfo): boolean {
  return RC_ENTITLEMENT in info.entitlements.active;
}

export function createRevenueCatBilling(): BillingService {
  let configured = false;
  let packages: PurchasesPackage[] = [];

  return {
    isAvailable: () => configured,

    async configure(userId) {
      const key = apiKey();
      if (!key) return;
      if (!configured) {
        if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
        // appUserID = id do usuário no Supabase: o webhook usa esse id para atualizar subscriptions.
        Purchases.configure({ apiKey: key, appUserID: userId ?? undefined });
        configured = true;
      } else if (userId) {
        await Purchases.logIn(userId);
      }
    },

    async getPackages() {
      if (!configured) return [];
      const offerings = await Purchases.getOfferings();
      packages = offerings.current?.availablePackages ?? [];
      return packages.map(toPaywallPackage).filter((p): p is PaywallPackage => p !== null);
    },

    async purchase(packageId) {
      const pkg = packages.find((p) => p.identifier === packageId);
      if (!pkg) return { status: 'error', message: 'Plano indisponível. Tente novamente.' };
      try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        return hasProEntitlement(customerInfo)
          ? { status: 'success' }
          : { status: 'error', message: 'Compra não confirmada pela loja.' };
      } catch (e) {
        return errorResult(e);
      }
    },

    async restore() {
      if (!configured) return { status: 'error', message: 'Compras indisponíveis.' };
      try {
        const info = await Purchases.restorePurchases();
        return hasProEntitlement(info)
          ? { status: 'success' }
          : {
              status: 'error',
              message: 'Nenhuma assinatura ativa encontrada para esta conta da loja.',
            };
      } catch (e) {
        return errorResult(e);
      }
    },

    async manageSubscription() {
      if (configured) await Purchases.showManageSubscriptions();
    },

    onCustomerInfoChange(cb) {
      if (!configured) return () => undefined;
      const listener = (info: CustomerInfo) => cb(hasProEntitlement(info));
      Purchases.addCustomerInfoUpdateListener(listener);
      return () => {
        Purchases.removeCustomerInfoUpdateListener(listener);
      };
    },
  };
}
