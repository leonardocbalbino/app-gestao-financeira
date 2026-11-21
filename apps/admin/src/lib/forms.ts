import {
  adConfigSchema,
  adPlacementSchema,
  appConfigSchema,
  type AdConfig,
  type AppConfig,
} from '@app/shared';

const PLACEMENTS = adPlacementSchema.options;

const bool = (fd: FormData, key: string) => fd.get(key) === 'on' || fd.get(key) === 'true';

/** FormData do formulário de anúncios → AdConfig validado. */
export function parseAdConfigForm(fd: FormData): AdConfig {
  const placements = Object.fromEntries(PLACEMENTS.map((p) => [p, bool(fd, `placement.${p}`)]));
  const ids = (platform: 'ios' | 'android') =>
    Object.fromEntries(
      PLACEMENTS.map((p) => [p, String(fd.get(`unit.${platform}.${p}`) ?? '').trim()]).filter(
        ([, v]) => v !== '',
      ),
    );
  return adConfigSchema.parse({
    enabled: bool(fd, 'enabled'),
    placements,
    native_every_n: Number(fd.get('native_every_n')),
    interstitial_min_interval_sec: Number(fd.get('interstitial_min_interval_sec')),
    ad_unit_ids: { ios: ids('ios'), android: ids('android') },
  });
}

/** FormData da config remota → AppConfig validado (feature_flags em JSON). */
export function parseAppConfigForm(fd: FormData): AppConfig {
  const flagsRaw = String(fd.get('feature_flags') ?? '{}').trim() || '{}';
  let flags: unknown;
  try {
    flags = JSON.parse(flagsRaw);
  } catch {
    throw new Error('feature_flags precisa ser um JSON válido, ex.: {"novo_onboarding": true}');
  }
  const version = String(fd.get('min_app_version') ?? '0.0.0').trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Versão mínima no formato 1.2.3');
  return appConfigSchema.parse({
    min_app_version: version,
    maintenance_mode: bool(fd, 'maintenance_mode'),
    maintenance_message: String(fd.get('maintenance_message') ?? ''),
    paywall_default_plan: fd.get('paywall_default_plan') === 'monthly' ? 'monthly' : 'annual',
    feature_flags: flags,
  });
}
