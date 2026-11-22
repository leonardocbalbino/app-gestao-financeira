import { loadConfig, type Config } from './config.ts';
import { createDb } from './db.ts';
import { TokenService } from './auth/tokens.ts';
import { createSocialVerifier } from './auth/social.ts';
import { createProviders } from './channels/providers.ts';
import { ReminderDispatcher } from './reminders/dispatcher.ts';
import type { Deps } from './context.ts';

export function buildDeps(cfg: Config = loadConfig(), overrides: Partial<Deps> = {}): Deps {
  const db = overrides.db ?? createDb(cfg.DATABASE_URL, cfg.SERVICE_DATABASE_URL);
  const providers = overrides.providers ?? createProviders(cfg);
  return {
    cfg,
    db,
    tokens: overrides.tokens ?? new TokenService(cfg.JWT_SECRET, db.service),
    providers,
    social: overrides.social ?? createSocialVerifier(cfg.appleAudiences, cfg.googleAudiences),
    dispatcher: overrides.dispatcher ?? new ReminderDispatcher(db, providers, cfg.PUBLIC_APP_NAME),
  };
}
