# Checklist de publicação

## Infraestrutura (Postgres puro + API)

- [ ] **Postgres 15+** gerenciado ou na sua VPS, com backups diários e TLS.
- [ ] Rodar `pnpm --filter @app/api migrate` com `MIGRATION_DATABASE_URL` apontando para o usuário dono do schema. Isso cria os papéis `app_api` e `app_service`.
- [ ] Definir senhas fortes em `APP_API_PASSWORD` e `APP_SERVICE_PASSWORD`. A migration aplica as senhas.
- [ ] **API**: `apps/api/Dockerfile` (ou `pnpm --filter @app/api start`) atrás de HTTPS, com `NODE_ENV=production` e `JWT_SECRET` aleatório de 32+ caracteres.
- [ ] **Worker**: roda dentro da API por padrão. Para escalar, use `RUN_WORKER=false` na API e um processo separado com `pnpm --filter @app/api worker`. Vários workers são seguros (`SKIP LOCKED`).
- [ ] **Não** definir `FIXED_OTP_ACCOUNTS` em produção, exceto uma conta exclusiva para a revisão das lojas.
- [ ] Painel admin: `API_URL` apontando para a API. Criar o primeiro owner com `pnpm --filter @app/api seed:demo` em ambiente de staging, ou via SQL.

## Canais de lembrete

- [ ] **E-mail**: `SMTP_URL` (SES, Resend, SendGrid, Postmark...) e `MAIL_FROM` com domínio verificado (SPF/DKIM/DMARC).
- [ ] **SMS**: Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`). Para o Brasil, verificar o remetente e o registro exigido.
- [ ] **WhatsApp**: Twilio WhatsApp Business (`TWILIO_WHATSAPP_FROM`). Mensagens iniciadas pela empresa exigem **template aprovado**: defina `TWILIO_WHATSAPP_CONTENT_SID`, com as variáveis `{{1}}` título e `{{2}}` mensagem.
- [ ] **Push**: projeto no EAS (`EAS_PROJECT_ID`), credenciais APNs e FCM configuradas no EAS; `EXPO_ACCESS_TOKEN` é opcional.
- [ ] Testar cada canal no admin, em **Lembretes e envios → Testar canal**.

## Contas e serviços

- [ ] **Apple Developer** e **Google Play Console** (bundle e package em `brand.json`).
- [ ] **Login social**: `APPLE_BUNDLE_IDS` e `GOOGLE_CLIENT_IDS` na API; `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` no app.
- [ ] **RevenueCat**: produtos `pro_monthly` e `pro_annual`, entitlement `pro`; webhook apontando para `https://<api>/v1/webhooks/revenuecat` com `Authorization: Bearer <REVENUECAT_WEBHOOK_AUTH>`.
- [ ] **AdMob**: apps e blocos, e mensagem UMP (GDPR + LGPD). IDs dos blocos no admin, em Anúncios.
- [ ] **Sentry** e **PostHog** (opcionais).

## Antes de cada versão

- [ ] `pnpm check`, pgTAP e E2E do admin verdes (CI).
- [ ] Maestro em iOS e Android (`maestro test apps/mobile/.maestro`).
- [ ] Compra sandbox, restauração, cancelamento e expiração (o webhook atualiza o plano).
- [ ] Lembrete criado → push, e-mail, SMS e WhatsApp entregues; pago/recebido cancela os pendentes.
- [ ] Revisar `docs/store/privacy.md` se algum SDK ou provedor mudou.
- [ ] `eas build --profile production --platform all`, depois `eas submit`.
