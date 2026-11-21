# Privacidade: o que o app coleta

Base para o "App Privacy" (Apple), a "Data safety" (Google) e a política de privacidade (LGPD).
Confira antes de cada envio, porque SDKs novos mudam as respostas.

| Dado                                     | Onde                                                  | Finalidade                               | Vinculado ao usuário | Rastreamento       |
| ---------------------------------------- | ----------------------------------------------------- | ---------------------------------------- | -------------------- | ------------------ |
| Transações, contas, orçamentos, metas    | Aparelho (SQLite); servidor só com backup Pro         | Funcionalidade do app                    | Sim, com backup      | Não                |
| E-mail / ID Apple / Google (opcional)    | Supabase Auth                                         | Conta e assinatura                       | Sim                  | Não                |
| ID do usuário (UUID)                     | Supabase, RevenueCat, Sentry, PostHog                 | Assinatura, diagnóstico, métricas de uso | Sim                  | Não                |
| Compras                                  | App Store / Google Play via RevenueCat                | Assinatura Pro                           | Sim                  | Não                |
| Identificador de publicidade (IDFA/AAID) | AdMob, **só no Free e com consentimento** (UMP + ATT) | Publicidade                              | Não                  | Sim, se autorizado |
| Diagnóstico de falhas                    | Sentry (`sendDefaultPii: false`)                      | Estabilidade                             | Sim (UUID)           | Não                |
| Eventos de uso                           | PostHog (sem valores, descrições, nomes ou e-mail)    | Melhorar o produto                       | Sim (UUID)           | Não                |

## Garantias no código

- `analytics.track()` remove propriedades com valores, descrições, nomes, notas ou e-mail (`sanitize`).
- O relatório PDF e o CSV são gerados no aparelho e só saem dele se o usuário compartilhar.
- Exclusão de conta (Edge Function `delete-account`) remove o usuário e, em cascata, perfil,
  dados sincronizados, assinaturas e overrides.
- A `service_role` existe apenas nas Edge Functions, nunca no app nem no admin.
- Usuários Pro não carregam o SDK de anúncios nem veem os formulários de consentimento.
