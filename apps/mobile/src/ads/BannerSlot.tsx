import { useState } from 'react';
import { View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import type { AdPlacement } from '@app/shared';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/components/ui';
import { useAdPlacement } from './AdsProvider';

/**
 * Banner 320×50. Some imediatamente quando o usuário vira Pro (entitlements mudam →
 * useAdPlacement retorna null) ou quando a posição é desligada no admin.
 */
export function BannerSlot({ placement }: { placement: AdPlacement }) {
  const t = useTheme();
  const ad = useAdPlacement(placement);
  const [failed, setFailed] = useState(false);
  if (!ad || failed) return null;
  return (
    <View
      testID={`ad-${placement}`}
      accessibilityLabel="Anúncio"
      style={{ alignItems: 'center', gap: 2, minHeight: 50 + 14 }}
    >
      <AppText variant="micro" color="inkSubtle">
        PUBLICIDADE
      </AppText>
      <View style={{ width: 320, height: 50, backgroundColor: t.colors.divider }}>
        <BannerAd
          unitId={ad.unitId}
          size={BannerAdSize.BANNER}
          onAdFailedToLoad={() => setFailed(true)}
        />
      </View>
    </View>
  );
}
