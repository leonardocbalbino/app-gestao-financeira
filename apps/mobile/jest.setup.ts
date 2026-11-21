jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => require('node:crypto').randomUUID(),
}));

jest.mock('react-native-mmkv', () => {
  const createMMKV = () => {
    const map = new Map<string, unknown>();
    return {
      set: (k: string, v: unknown) => void map.set(k, v),
      getString: (k: string) => map.get(k) as string | undefined,
      getBoolean: (k: string) => map.get(k) as boolean | undefined,
      getNumber: (k: string) => map.get(k) as number | undefined,
      contains: (k: string) => map.has(k),
      remove: (k: string) => map.delete(k),
      getAllKeys: () => [...map.keys()],
      clearAll: () => map.clear(),
    };
  };
  return { createMMKV };
});

jest.mock('expo-sqlite', () => ({ openDatabaseSync: jest.fn() }));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  scheduleNotificationAsync: jest.fn(async () => 'notif-id'),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    logIn: jest.fn(),
    getOfferings: jest.fn(async () => ({ current: null })),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
    setLogLevel: jest.fn(),
  },
  LOG_LEVEL: { WARN: 'WARN' },
  PACKAGE_TYPE: { MONTHLY: 'MONTHLY', ANNUAL: 'ANNUAL' },
}));
jest.mock('expo-apple-authentication', () => ({}));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));

jest.mock('react-native-google-mobile-ads', () => ({
  __esModule: true,
  default: () => ({ initialize: jest.fn(async () => []) }),
  AdsConsent: {
    gatherConsent: jest.fn(async () => ({
      canRequestAds: false,
      privacyOptionsRequirementStatus: 'NOT_REQUIRED',
    })),
    showPrivacyOptionsForm: jest.fn(async () => ({ canRequestAds: false })),
  },
  AdsConsentPrivacyOptionsRequirementStatus: { REQUIRED: 'REQUIRED', NOT_REQUIRED: 'NOT_REQUIRED' },
  TestIds: { BANNER: 'test-banner', NATIVE: 'test-native', INTERSTITIAL: 'test-interstitial' },
  BannerAd: () => null,
  BannerAdSize: { BANNER: 'BANNER' },
  NativeAd: { createForAdRequest: jest.fn(async () => null) },
  NativeAdView: ({ children }: { children: unknown }) => children,
  NativeAsset: ({ children }: { children: unknown }) => children,
  NativeAssetType: {
    ICON: 'icon',
    HEADLINE: 'headline',
    BODY: 'body',
    CALL_TO_ACTION: 'callToAction',
  },
  InterstitialAd: { createForAdRequest: jest.fn() },
  AdEventType: { LOADED: 'loaded', CLOSED: 'closed' },
}));
jest.mock('expo-tracking-transparency', () => ({
  requestTrackingPermissionsAsync: jest.fn(async () => ({ granted: false })),
}));

// Mock padrão do expo-router (testes podem sobrescrever com jest.mock próprio).
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}));

jest.mock('posthog-react-native', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(() => ({ capture: jest.fn(), identify: jest.fn(), reset: jest.fn() })),
}));
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  setUser: jest.fn(),
  captureException: jest.fn(),
}));
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(async () => ({ uri: 'file://x.pdf' })),
}));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(async () => undefined) }));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file://cache/',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  authenticateAsync: jest.fn(async () => ({ success: true })),
}));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.0.0' }));
