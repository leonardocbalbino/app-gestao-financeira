/**
 * Fonte única de identidade do app. Para renomear o app, altere SOMENTE este arquivo.
 * Consumido por apps/mobile/app.config.ts, pelo admin e pelos textos do app.
 */
export const brand = {
  name: '[NOME_DO_APP]',
  slug: 'app-gestao-financeira',
  scheme: 'gestaofinanceira',
  bundleId: 'com.example.gestaofinanceira',
  androidPackage: 'com.example.gestaofinanceira',
  supportEmail: 'suporte@example.com',
  privacyUrl: 'https://example.com/privacidade',
  termsUrl: 'https://example.com/termos',
  colors: {
    primary: '#0B6E4F',
    splashBackground: '#0B6E4F',
    iconBackground: '#0B6E4F',
  },
} as const;

export type Brand = typeof brand;
