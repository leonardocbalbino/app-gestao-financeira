import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
} from 'react-native-google-mobile-ads';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/components/ui';
import { useAdPlacement } from './AdsProvider';

/** Anúncio nativo no formato de uma linha da lista de transações, sempre rotulado "Anúncio". */
export function NativeAdRow() {
  const t = useTheme();
  const ad = useAdPlacement('native_transactions');
  const [native, setNative] = useState<NativeAd | null>(null);

  const unitId = ad?.unitId;
  useEffect(() => {
    if (!unitId) return;
    let alive = true;
    let loaded: NativeAd | null = null;
    NativeAd.createForAdRequest(unitId)
      .then((n) => {
        loaded = n;
        if (alive) setNative(n);
        else n.destroy();
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      loaded?.destroy();
    };
  }, [unitId]);

  if (!ad || !native) return null;

  return (
    <NativeAdView nativeAd={native}>
      <View
        accessibilityLabel={`Anúncio: ${native.headline}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.md,
          minHeight: 56,
          paddingVertical: t.spacing.sm,
          paddingHorizontal: t.spacing.sm,
          marginVertical: t.spacing.xs,
          borderRadius: t.radii.chip,
          backgroundColor: t.colors.surface,
          borderWidth: 1,
          borderColor: t.colors.border,
        }}
      >
        {native.icon ? (
          <NativeAsset assetType={NativeAssetType.ICON}>
            <Image
              source={{ uri: native.icon.url }}
              style={{ width: 40, height: 40, borderRadius: t.radii.chip }}
            />
          </NativeAsset>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
            <View
              style={{ paddingHorizontal: 4, borderRadius: 4, backgroundColor: t.colors.divider }}
            >
              <AppText variant="micro" color="inkMuted">
                Anúncio
              </AppText>
            </View>
            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <AppText variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
                {native.headline}
              </AppText>
            </NativeAsset>
          </View>
          <NativeAsset assetType={NativeAssetType.BODY}>
            <AppText variant="caption" color="inkMuted" numberOfLines={1}>
              {native.body}
            </AppText>
          </NativeAsset>
        </View>
        {native.callToAction ? (
          <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
            <AppText variant="caption" weight="bold" color="primary">
              {native.callToAction}
            </AppText>
          </NativeAsset>
        ) : null}
      </View>
    </NativeAdView>
  );
}
