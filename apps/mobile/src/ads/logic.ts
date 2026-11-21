import type { AdConfig, AdPlacement } from '@app/shared';

export type AdFormat = 'banner' | 'native' | 'interstitial';

export const PLACEMENT_FORMAT: Record<AdPlacement, AdFormat> = {
  banner_home: 'banner',
  banner_budgets: 'banner',
  banner_reports: 'banner',
  native_transactions: 'native',
  interstitial: 'interstitial',
};

export interface AdDecisionInput {
  /** Entitlement ads.show (Free = true, Pro = false). */
  entitlementShowsAds: boolean;
  config: AdConfig;
  placement: AdPlacement;
  /** SDK inicializado após consentimento (UMP) e, no iOS, após o ATT. */
  sdkReady: boolean;
  /** UMP: pode requisitar anúncios (consentimento obtido ou não necessário). */
  canRequestAds: boolean;
}

/** Um anúncio só aparece se TODAS as condições forem verdadeiras. */
export function shouldShowAd(i: AdDecisionInput): boolean {
  return (
    i.entitlementShowsAds &&
    i.config.enabled &&
    i.config.placements[i.placement] === true &&
    i.sdkReady &&
    i.canRequestAds
  );
}

/** Em dev sempre usa TestIds (nunca clique/impressão real). Em produção, IDs do admin. */
export function resolveUnitId(
  config: AdConfig,
  placement: AdPlacement,
  platform: 'ios' | 'android',
  isDev: boolean,
  testIds: Record<AdFormat, string>,
): string | null {
  if (isDev) return testIds[PLACEMENT_FORMAT[placement]];
  const id = config.ad_unit_ids[platform][placement];
  return id && id.trim() ? id : null;
}

export type WithAds<T> = T | { type: 'ad'; key: string };

/**
 * Insere um slot de anúncio nativo a cada `everyN` itens "reais" (contados por `isItem`),
 * nunca no topo nem no fim da lista.
 */
export function withNativeSlots<T>(
  rows: T[],
  everyN: number,
  enabled: boolean,
  isItem: (row: T) => boolean = () => true,
): WithAds<T>[] {
  if (!enabled || everyN < 1) return rows;
  const out: WithAds<T>[] = [];
  let count = 0;
  rows.forEach((row, idx) => {
    out.push(row);
    if (!isItem(row)) return;
    count++;
    if (count % everyN === 0 && idx < rows.length - 1) out.push({ type: 'ad', key: `ad-${count}` });
  });
  return out;
}

/** Intersticial respeita o intervalo mínimo configurado (padrão 5 min). */
export function canShowInterstitial(
  lastShownAt: number | null,
  now: number,
  minIntervalSec: number,
): boolean {
  return lastShownAt === null || now - lastShownAt >= minIntervalSec * 1000;
}
