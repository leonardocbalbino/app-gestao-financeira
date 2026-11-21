import { screen, waitFor } from '@testing-library/react-native';
import { AdsConsent } from 'react-native-google-mobile-ads';
import { createTestDb } from '@/test/testDb';
import { proEntitlements, renderWithProviders } from '@/test/renderWithProviders';
import { AdsProvider } from '../AdsProvider';
import { BannerSlot } from '../BannerSlot';

const gather = AdsConsent.gatherConsent as jest.Mock;

beforeEach(() => {
  gather.mockReset();
  gather.mockResolvedValue({
    canRequestAds: true,
    privacyOptionsRequirementStatus: 'NOT_REQUIRED',
  });
});

describe('BannerSlot', () => {
  it('Free com consentimento vê o banner (TestIds em dev)', async () => {
    const db = await createTestDb();
    await renderWithProviders(
      <AdsProvider>
        <BannerSlot placement="banner_home" />
      </AdsProvider>,
      db,
    );
    expect(await screen.findByTestId('ad-banner_home')).toBeTruthy();
    expect(gather).toHaveBeenCalledTimes(1);
  });

  it('sem consentimento não mostra', async () => {
    gather.mockResolvedValue({ canRequestAds: false, privacyOptionsRequirementStatus: 'REQUIRED' });
    const db = await createTestDb();
    await renderWithProviders(
      <AdsProvider>
        <BannerSlot placement="banner_home" />
      </AdsProvider>,
      db,
    );
    await waitFor(() => expect(gather).toHaveBeenCalled());
    expect(screen.queryByTestId('ad-banner_home')).toBeNull();
  });

  it('Pro nunca vê anúncio nem formulário de consentimento', async () => {
    const db = await createTestDb();
    await renderWithProviders(
      <AdsProvider>
        <BannerSlot placement="banner_home" />
      </AdsProvider>,
      db,
      { entitlements: proEntitlements() },
    );
    expect(screen.queryByTestId('ad-banner_home')).toBeNull();
    expect(gather).not.toHaveBeenCalled();
  });
});
