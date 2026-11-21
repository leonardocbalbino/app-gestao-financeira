import data from './brand.json';

/**
 * Identidade do app. A fonte única é `brand.json` (lido também pelo app.config.ts do Expo).
 * Para renomear o app, altere SOMENTE brand.json.
 */
export const brand = data;

export type Brand = typeof brand;
