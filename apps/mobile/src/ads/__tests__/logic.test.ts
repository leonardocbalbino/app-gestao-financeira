import { adConfigSchema } from '@app/shared';
import { canShowInterstitial, resolveUnitId, shouldShowAd, withNativeSlots } from '../logic';

const config = adConfigSchema.parse({
  ad_unit_ids: { ios: { banner_home: 'ca-app-pub-1/111' }, android: {} },
});
const testIds = { banner: 'TEST_BANNER', native: 'TEST_NATIVE', interstitial: 'TEST_INT' };
const base = {
  entitlementShowsAds: true,
  config,
  placement: 'banner_home' as const,
  sdkReady: true,
  canRequestAds: true,
};

describe('shouldShowAd', () => {
  it('Free com consentimento e posição ativa mostra', () => {
    expect(shouldShowAd(base)).toBe(true);
  });
  it('Pro (ads.show=false) nunca mostra', () => {
    expect(shouldShowAd({ ...base, entitlementShowsAds: false })).toBe(false);
  });
  it('respeita chave global, posição, SDK e consentimento', () => {
    expect(shouldShowAd({ ...base, config: { ...config, enabled: false } })).toBe(false);
    expect(shouldShowAd({ ...base, placement: 'interstitial' })).toBe(false); // desligado por padrão
    expect(shouldShowAd({ ...base, sdkReady: false })).toBe(false);
    expect(shouldShowAd({ ...base, canRequestAds: false })).toBe(false);
  });
});

describe('resolveUnitId', () => {
  it('dev usa TestIds; produção usa IDs do admin', () => {
    expect(resolveUnitId(config, 'banner_home', 'ios', true, testIds)).toBe('TEST_BANNER');
    expect(resolveUnitId(config, 'native_transactions', 'ios', true, testIds)).toBe('TEST_NATIVE');
    expect(resolveUnitId(config, 'banner_home', 'ios', false, testIds)).toBe('ca-app-pub-1/111');
    expect(resolveUnitId(config, 'banner_home', 'android', false, testIds)).toBeNull();
  });
});

describe('withNativeSlots', () => {
  it('insere a cada N itens e não no fim', () => {
    const rows = [1, 2, 3, 4, 5, 6];
    expect(withNativeSlots(rows, 3, true)).toEqual([1, 2, 3, { type: 'ad', key: 'ad-3' }, 4, 5, 6]);
    expect(withNativeSlots(rows, 3, false)).toEqual(rows);
  });
  it('conta só itens reais (ignora cabeçalhos)', () => {
    const rows = ['h', 'a', 'b', 'h', 'c'];
    const out = withNativeSlots(rows, 2, true, (r) => r !== 'h');
    expect(out).toEqual(['h', 'a', 'b', { type: 'ad', key: 'ad-2' }, 'h', 'c']);
  });
});

describe('canShowInterstitial', () => {
  it('respeita intervalo mínimo', () => {
    expect(canShowInterstitial(null, 0, 300)).toBe(true);
    expect(canShowInterstitial(0, 299_000, 300)).toBe(false);
    expect(canShowInterstitial(0, 300_000, 300)).toBe(true);
  });
});
