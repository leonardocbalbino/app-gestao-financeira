import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import mobileAds, {
  AdsConsent,
  AdsConsentPrivacyOptionsRequirementStatus,
  TestIds,
} from 'react-native-google-mobile-ads';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { showsAds, type AdPlacement } from '@app/shared';
import { useEntitlements, useEntitlementsContext } from '@/entitlements';
import { resolveUnitId, shouldShowAd, type AdFormat } from './logic';

interface AdsContextValue {
  sdkReady: boolean;
  canRequestAds: boolean;
  /** UMP exige botão "Privacidade de anúncios" nas configurações (ex.: EEE/UK). */
  privacyOptionsRequired: boolean;
  showPrivacyOptions: () => Promise<void>;
}

const AdsContext = createContext<AdsContextValue>({
  sdkReady: false,
  canRequestAds: false,
  privacyOptionsRequired: false,
  showPrivacyOptions: async () => undefined,
});

const TEST_IDS: Record<AdFormat, string> = {
  banner: TestIds.BANNER,
  native: TestIds.NATIVE,
  interstitial: TestIds.INTERSTITIAL,
};

/**
 * Ordem obrigatória: 1) UMP (consentimento GDPR/LGPD) → 2) ATT no iOS → 3) inicializa o SDK.
 * Usuários sem anúncios (Pro) nunca veem formulários nem carregam o SDK.
 */
export function AdsProvider({ children }: { children: ReactNode }) {
  const wantsAds = showsAds(useEntitlements());
  const [sdkReady, setSdkReady] = useState(false);
  const [canRequestAds, setCanRequestAds] = useState(false);
  const [privacyOptionsRequired, setPrivacyRequired] = useState(false);

  useEffect(() => {
    if (!wantsAds || sdkReady) return;
    let cancelled = false;
    (async () => {
      try {
        const info = await AdsConsent.gatherConsent();
        if (cancelled) return;
        setPrivacyRequired(
          info.privacyOptionsRequirementStatus ===
            AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
        );
        if (!info.canRequestAds) return;
        if (Platform.OS === 'ios') await requestTrackingPermissionsAsync().catch(() => undefined);
        await mobileAds().initialize();
        if (!cancelled) {
          setCanRequestAds(true);
          setSdkReady(true);
        }
      } catch {
        // Falha de rede/consentimento: o app segue sem anúncios.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wantsAds, sdkReady]);

  const showPrivacyOptions = useCallback(async () => {
    const info = await AdsConsent.showPrivacyOptionsForm();
    setCanRequestAds(info.canRequestAds);
  }, []);

  const value = useMemo(
    () => ({ sdkReady, canRequestAds, privacyOptionsRequired, showPrivacyOptions }),
    [sdkReady, canRequestAds, privacyOptionsRequired, showPrivacyOptions],
  );
  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
}

export function useAds(): AdsContextValue {
  return useContext(AdsContext);
}

/** Decide se a posição deve exibir anúncio agora e com qual unit id. Pro → sempre null. */
export function useAdPlacement(placement: AdPlacement): { unitId: string } | null {
  const ent = useEntitlements();
  const { config } = useEntitlementsContext();
  const { sdkReady, canRequestAds } = useAds();
  const visible = shouldShowAd({
    entitlementShowsAds: showsAds(ent),
    config: config.ads,
    placement,
    sdkReady,
    canRequestAds,
  });
  if (!visible) return null;
  const unitId = resolveUnitId(
    config.ads,
    placement,
    Platform.OS === 'ios' ? 'ios' : 'android',
    __DEV__,
    TEST_IDS,
  );
  return unitId ? { unitId } : null;
}
