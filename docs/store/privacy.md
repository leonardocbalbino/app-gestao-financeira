# Privacidade: o que o app coleta

Base para o "App Privacy" (Apple), a "Data safety" (Google) e a política de privacidade (LGPD).
Confira antes de cada envio, porque SDKs novos mudam as respostas.

| Dado                                                      | Onde                                                  | Finalidade                                                       | Vinculado ao usuário | Rastreamento       |
| --------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------- | -------------------- | ------------------ |
| Transações, contas, orçamentos, metas                     | Aparelho (SQLite); servidor só com backup Pro         | Funcionalidade do app                                            | Sim, com backup      | Não                |
| E-mail / ID Apple / Google (opcional)                     | API própria (Postgres)                                | Conta e assinatura                                               | Sim                  | Não                |
| ID do usuário (UUID)                                      | API própria (Postgres), RevenueCat, Sentry, PostHog   | Assinatura, diagnóstico, métricas de uso                         | Sim                  | Não                |
| Compras                                                   | App Store / Google Play via RevenueCat                | Assinatura Pro                                                   | Sim                  | Não                |
| Identificador de publicidade (IDFA/AAID)                  | AdMob, **só no Free e com consentimento** (UMP + ATT) | Publicidade                                                      | Não                  | Sim, se autorizado |
| Celular (opcional) e consentimento SMS/WhatsApp           | API própria; envio via Twilio                         | Lembretes por SMS/WhatsApp                                       | Sim                  | Não                |
| Contato de terceiros em cobranças (nome, celular, e-mail) | API própria; envio via Twilio/SMTP                    | Lembrete ao devedor, só com consentimento declarado pelo usuário | Sim                  | Não                |
| Token de push do aparelho                                 | API própria; envio via Expo Push                      | Notificações de lembretes                                        | Sim                  | Não                |
| Diagnóstico de falhas                                     | Sentry (`sendDefaultPii: false`)                      | Estabilidade                                                     | Sim (UUID)           | Não                |
| Eventos de uso                                            | PostHog (sem valores, descrições, nomes ou e-mail)    | Melhorar o produto                                               | Sim (UUID)           | Não                |

## Garantias no código

- `analytics.track()` remove propriedades com valores, descrições, nomes, notas ou e-mail (`sanitize`).
- O relatório PDF e o CSV são gerados no aparelho e só saem dele se o usuário compartilhar.
- Exclusão de conta (`DELETE /v1/me`) remove o usuário e, em cascata, perfil,
  dados sincronizados, assinaturas e overrides.
- O papel `app_service` (que ignora RLS) é usado só pela API em código confiável; o app e o admin nunca falam com o banco.
- SMS/WhatsApp só são enviados com opt-in explícito do usuário (Canais de contato) e, para terceiros, com confirmação de consentimento na cobrança.
- Usuários Pro não carregam o SDK de anúncios nem veem os formulários de consentimento.
