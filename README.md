# [NOME_DO_APP] — Gestão financeira pessoal

App de finanças pessoais (iOS/Android) local-first, com plano Free (anúncios) e Pro (assinatura),
lembretes de pagamento e cobrança por **push, e-mail, SMS e WhatsApp** e um painel admin que
controla o que cada plano libera — sem nova versão na loja.

> Para trocar nome, slug, bundle id e cores, edite **somente**
> [`packages/shared/src/brand.json`](packages/shared/src/brand.json).

## Arquitetura

| Pasta             | Conteúdo                                                                           |
| ----------------- | ---------------------------------------------------------------------------------- |
| `apps/mobile`     | Expo SDK 58 + Expo Router, SQLite/Drizzle (local-first), TanStack Query, Zustand   |
| `apps/api`        | API Node (Hono) + worker de lembretes; Postgres via `pg`; JWT com refresh rotativo |
| `apps/admin`      | Next.js 16 + Tailwind 4 + shadcn/ui; fala só com a API                             |
| `packages/shared` | Marca, tokens, BRL/datas, catálogo de features, schemas Zod (app, API e admin)     |
| `db`              | Migrations SQL (Postgres puro), testes pgTAP e imagem Docker de desenvolvimento    |
| `docs`            | Ficha das lojas, privacidade e checklist de publicação                             |

**Banco: Postgres puro.** Nada de Supabase. A API conecta com dois papéis:

- `app_api`: sujeito a **RLS**. Cada requisição roda `SET LOCAL app.user_id`, lido pelas policies via `app.uid()`.
- `app_service`: `BYPASSRLS`, usado apenas por código confiável (login, webhook e worker).

### Como funciona

- **Entitlements:** a resolução é feita no servidor (`get_entitlements`), nesta ordem: override do usuário → concessão manual → assinatura → plano padrão → catálogo. O app usa `useFeature` e `useLimit` (nunca `isPro`). Os limites também são impostos no banco por triggers.
- **Sync (Pro):** LWW por `updated_at`, tombstones e cursor `server_updated_at`. Na família, os dados são compartilhados automaticamente entre os membros.
- **Lembretes:**
  - Pagamento ("vou pagar") ou cobrança ("vou receber", podendo avisar também o devedor).
  - O worker agenda os envios por antecedência (na hora, 1 h, 1 dia, 3 dias, 1 semana), envia por push (Expo), e-mail (SMTP), SMS e WhatsApp (Twilio) e tenta de novo com backoff.
  - Recorrências respeitam o dia original: 31 → 28 fev → 31 mar.
  - SMS e WhatsApp são Pro. Sem credenciais de um provedor, aquele canal roda em **modo simulado**: o envio é registrado, mas não é entregue.
- **Assinatura:** RevenueCat, com o webhook em `/v1/webhooks/revenuecat`. **Anúncios:** AdMob, com consentimento UMP, depois ATT.

## Rodando localmente

```bash
pnpm install
docker compose up -d                       # Postgres (56432) + Mailpit (http://localhost:56025)
cp apps/api/.env.example apps/api/.env     # já funciona em dev
pnpm --filter @app/api migrate
pnpm --filter @app/api seed:demo           # usuários de teste (abaixo)
pnpm --filter @app/api dev                 # API + worker em http://localhost:56080
pnpm --filter @app/admin dev               # painel em http://localhost:3001
pnpm --filter @app/mobile dev              # app (dev build) — EXPO_PUBLIC_API_URL no apps/mobile/.env
```

### Usuários de teste (somente ambiente local/dev)

| Onde  | Usuário              | Acesso                                         |
| ----- | -------------------- | ---------------------------------------------- |
| Admin | `admin@gestao.local` | senha `Admin@123456` (papel owner)             |
| App   | `pro@gestao.local`   | código `123456` · plano Pro, dados e lembretes |
| App   | `free@gestao.local`  | código `123456` · plano Free                   |

Os códigos fixos vêm de `FIXED_OTP_ACCOUNTS` no `.env` da API. Use isso apenas em dev ou em contas
de revisão das lojas, nunca em contas reais. Os outros e-mails recebem o código de verdade, que em dev
aparece no Mailpit.

## Qualidade

```bash
pnpm check                                             # lint + typecheck + testes (API usa Postgres real)
docker compose exec db sh -c 'pg_prove -U postgres -d gestao /tests/*.sql'   # pgTAP
pnpm --filter @app/admin exec playwright test e2e/admin.spec.ts               # E2E do admin
maestro test apps/mobile/.maestro                      # E2E mobile (dev build instalado)
```

## Convenções

- Dinheiro sempre em centavos; exibição via `formatBRL` (`R$ 1.234,56`, `−R$ 10,00`) com números tabulares.
- Datas civis `YYYY-MM-DD`; exibição `21 nov`, `Hoje · 21 nov`. Lembretes usam o fuso de Brasília (UTC−3).
- Somente tokens de `packages/shared/src/theme.ts`; dark mode e contraste AA.
- Analytics sem PII (`analytics.track()` descarta valores, descrições, nomes e e-mail).

Para publicar, veja [`docs/release-checklist.md`](docs/release-checklist.md).
