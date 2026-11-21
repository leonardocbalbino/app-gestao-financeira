import type { ExpoConfig } from 'expo/config';
import brand from '../../packages/shared/src/brand.json';

const IS_DEV = process.env.APP_VARIANT === 'development';

/**
 * Configuração do app. Nome, slug, bundle id e cores vêm de packages/shared/src/brand.json.
 * Chaves sensíveis/ambientais vêm de variáveis EXPO_PUBLIC_* (EAS env) — nunca commitadas.
 */
const config: ExpoConfig = {
  name: IS_DEV ? `${brand.name} (Dev)` : brand.name,
  slug: brand.slug,
  scheme: brand.scheme,
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: false,
    usesAppleSignIn: true,
    bundleIdentifier: IS_DEV ? `${brand.bundleId}.dev` : brand.bundleId,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: IS_DEV ? `${brand.androidPackage}.dev` : brand.androidPackage,
    adaptiveIcon: {
      backgroundColor: brand.colors.iconBackground,
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-sqlite',
    'expo-apple-authentication',
    'expo-web-browser',
    ['expo-notifications', { color: brand.colors.primary }],
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 160,
        backgroundColor: brand.colors.splashBackground,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
};

export default config;
