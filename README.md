# [NOME_DO_APP] — Gestão financeira pessoal

App de finanças pessoais para iOS e Android, que funciona offline (local-first). O plano Free tem
anúncios e o Pro é por assinatura. O que cada plano libera vem de uma **matriz controlada por um
painel admin**, sem nova versão na loja.

> Para trocar nome, slug, bundle id e cores, edite **somente**
> [`packages/shared/src/brand.json`](packages/shared/src/brand.json).

## Estrutura

| Pasta             | Conteúdo                                                                              |
| ----------------- | ------------------------------------------------------------------------------------- |
| `apps/mobile`     | Expo SDK 58 + Expo Router, TypeScript strict, SQLite/Drizzle, TanStack Query, Zustand |
| `apps/admin`      | Next.js 16 (App Router) + Tailwind 4 + shadcn/ui                                      |
| `packages/shared` | Marca, tokens de tema, formatação BRL/datas, catálogo de features, schemas Zod        |
| `supabase`        | Migrations, RLS, funções SQL, testes pgTAP e Edge Functions                           |
| `docs`            | Ficha das lojas, privacidade e checklist de publicação                                |

## Como funciona

- **Local-first:** os dados ficam no SQLite do aparelho, com valores em centavos inteiros. No Pro
  (`sync.cloud`), há sincronização bidirecional com Last-Write-Wins e tombstones.
- **Entitlements:** `get_entitlements(user)` resolve no servidor, nesta ordem: override do usuário →
  plano efetivo (concessão manual > assinatura > padrão) → matriz → default do catálogo. O app usa
  `useFeature` / `useLimit` / `<FeatureGate>` / `<LimitGate>` (nunca `isPro`). Limites também são
  impostos no servidor por triggers. Reduzir um limite nunca apaga dados: o excedente fica somente
  leitura.
- **Assinatura:** RevenueCat (`pro_monthly`, `pro_annual`, entitlement `pro`) com
  `Purchases.logIn(supabaseUserId)`. O webhook valida o segredo e atualiza `subscriptions`. No app,
  o Pro é liberado na hora da compra.
- **Anúncios:** AdMob com UMP → ATT → SDK; só no Free e com IDs de teste em dev. Cada posição e a
  frequência são controladas pelo admin.
- **Mudanças no admin** chegam aos apps em até ~1 minuto (polling + ao voltar ao app).

## Desenvolvimento

```bash
pnpm install
npx supabase start                         # Docker; portas 563xx
cp .env.example apps/mobile/.env           # preencha com `npx supabase status -o env`
cp .env.example apps/admin/.env.local
pnpm --filter @app/mobile dev              # requer dev build: eas build --profile development
pnpm --filter @app/admin dev               # http://localhost:3001
```

## Qualidade

```bash
pnpm check                                 # lint + typecheck + testes (Turborepo)
npx supabase test db                       # pgTAP: RLS, entitlements, sync, admin
pnpm --filter @app/admin exec playwright test   # E2E do admin (Supabase local)
maestro test apps/mobile/.maestro          # E2E mobile (dev build instalado)
```

O CI (GitHub Actions) roda checks, pgTAP e o E2E do admin.

## Convenções

- Dinheiro sempre em centavos; exibição via `formatBRL` (`R$ 1.234,56`, `−R$ 10,00`) com números tabulares.
- Datas civis `YYYY-MM-DD`; exibição `21 nov`, `Hoje · 21 nov`.
- Use apenas os tokens de `packages/shared/src/theme.ts`; dark mode e AA em todas as telas.
- Analytics sem PII: `analytics.track()` descarta valores, descrições, nomes e e-mail.

Para publicar, veja [`docs/release-checklist.md`](docs/release-checklist.md).
