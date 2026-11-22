import { z } from 'zod';

const list = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  SERVICE_DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(56080),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa ter 32+ caracteres'),
  PUBLIC_APP_NAME: z.string().default('[NOME_DO_APP]'),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('Gestão Financeira <nao-responda@example.com>'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_SMS_FROM: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  TWILIO_WHATSAPP_CONTENT_SID: z.string().optional(),
  EXPO_ACCESS_TOKEN: z.string().optional(),
  APPLE_BUNDLE_IDS: z.string().optional(),
  GOOGLE_CLIENT_IDS: z.string().optional(),
  REVENUECAT_WEBHOOK_AUTH: z.string().optional(),
  FIXED_OTP_ACCOUNTS: z.string().optional(),
  NODE_ENV: z.string().default('development'),
  CORS_ORIGINS: z.string().optional(),
});

export type Config = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const c = schema.parse(env);
  const fixedOtp = new Map<string, string>();
  for (const pair of list(c.FIXED_OTP_ACCOUNTS)) {
    const [email, code] = pair.split(':');
    if (email && code && /^\d{6}$/.test(code)) fixedOtp.set(email.toLowerCase(), code);
  }
  return {
    ...c,
    isProduction: c.NODE_ENV === 'production',
    appleAudiences: list(c.APPLE_BUNDLE_IDS),
    googleAudiences: list(c.GOOGLE_CLIENT_IDS),
    corsOrigins: list(c.CORS_ORIGINS),
    fixedOtp,
  };
}
