import { useCallback, useEffect, useRef } from 'react';
import { AdEventType, InterstitialAd } from 'react-native-google-mobile-ads';
import { useEntitlementsContext } from '@/entitlements';
import { useAdPlacement } from './AdsProvider';
import { canShowInterstitial } from './logic';

let lastShownAt: number | null = null;

/**
 * Intersticial (desligado por padrão no admin). Pré-carrega e expõe `maybeShow()`, que só exibe
 * se a posição estiver ativa, o usuário tiver anúncios e o intervalo mínimo tiver passado.
 */
export function useInterstitial() {
  const ad = useAdPlacement('interstitial');
  const { config } = useEntitlementsContext();
  const ref = useRef<InterstitialAd | null>(null);
  const loaded = useRef(false);
  const unitId = ad?.unitId;

  useEffect(() => {
    if (!unitId) return;
    const i = InterstitialAd.createForAdRequest(unitId);
    ref.current = i;
    const offLoaded = i.addAdEventListener(AdEventType.LOADED, () => {
      loaded.current = true;
    });
    const offClosed = i.addAdEventListener(AdEventType.CLOSED, () => {
      loaded.current = false;
      i.load();
    });
    i.load();
    return () => {
      offLoaded();
      offClosed();
      ref.current = null;
      loaded.current = false;
    };
  }, [unitId]);

  return useCallback(() => {
    const now = Date.now();
    if (!ref.current || !loaded.current) return false;
    if (!canShowInterstitial(lastShownAt, now, config.ads.interstitial_min_interval_sec))
      return false;
    lastShownAt = now;
    void ref.current.show();
    return true;
  }, [config.ads.interstitial_min_interval_sec]);
}
