# Checklist de publicação

## Contas e serviços (precisam ser criados pelo responsável)

- [ ] **Apple Developer Program** e app no App Store Connect (bundle `brand.json → bundleId`)
- [ ] **Google Play Console** e app (package `brand.json → androidPackage`)
- [ ] **Supabase** (projeto de produção): `supabase link` → `supabase db push` →
      `supabase functions deploy revenuecat-webhook delete-account app-config`
- [ ] Segredos das Edge Functions: `supabase secrets set REVENUECAT_WEBHOOK_AUTH=...`
- [ ] Auth: habilitar anônimo, e-mail (OTP), Apple e Google; URL de redirect `gestaofinanceira://auth-callback`
- [ ] **RevenueCat**: produtos `pro_monthly` e `pro_annual`, entitlement `pro` e offering atual;
      webhook → `https://<projeto>.functions.supabase.co/revenuecat-webhook` com o header Authorization
- [ ] **AdMob**: apps iOS/Android, blocos (banner ×3, nativo, intersticial) e mensagem de consentimento
      UMP (GDPR + LGPD); IDs dos blocos no admin → Anúncios; App IDs em `ADMOB_IOS_APP_ID` / `ADMOB_ANDROID_APP_ID`
- [ ] **Sentry** (DSN + `SENTRY_AUTH_TOKEN` no EAS) e **PostHog** (chave do projeto)
- [ ] **EAS**: `eas init` (gera `EAS_PROJECT_ID`) e variáveis por ambiente (`.env.example`)

## Antes de cada versão

- [ ] `pnpm check` e `npx supabase test db` verdes; E2E do admin verde no CI
- [ ] Maestro (`maestro test apps/mobile/.maestro`) em iOS e Android
- [ ] Testar compra sandbox, restauração, cancelamento → expiração (o webhook atualiza o plano)
- [ ] Testar Free → Pro: anúncios somem na hora; Pro → Free: excedentes ficam somente leitura
- [ ] Revisar `docs/store/privacy.md` se algum SDK mudou
- [ ] `eas build --profile production --platform all` → `eas submit`
- [ ] Depois de publicar, subir `min_app_version` no admin só quando for necessário
