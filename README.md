# [NOME_DO_APP] — Gestão financeira pessoal

App de finanças pessoais (iOS/Android) com plano Free (com anúncios) e Pro (assinatura). Feito para funcionar offline primeiro (local-first). As funcionalidades de cada plano vêm de uma matriz controlada por um painel admin.

> Para trocar nome, slug, bundle id e cores, edite **somente** [`packages/shared/src/brand.ts`](packages/shared/src/brand.ts).

## Estrutura

| Pasta             | Conteúdo                                                                      |
| ----------------- | ----------------------------------------------------------------------------- |
| `apps/mobile`     | Expo (SDK 58) + Expo Router, TypeScript strict                                |
| `apps/admin`      | Next.js (App Router) + Tailwind + shadcn/ui                                   |
| `packages/shared` | Tipos, schemas Zod, catálogo de features, formatação BRL/datas, design tokens |
| `supabase`        | Migrations, seed, testes pgTAP, Edge Functions                                |

## Primeiros passos

```bash
pnpm install
cp .env.example apps/mobile/.env      # preencha as chaves
npx supabase start                    # Postgres + Auth locais (Docker)
pnpm --filter @app/mobile dev         # requer dev build (EAS) para módulos nativos
```

## Qualidade

```bash
pnpm lint && pnpm typecheck && pnpm test   # todos os pacotes (Turborepo)
npx supabase test db                       # testes SQL (RLS, entitlements)
```

## Convenções

- Dinheiro sempre em **centavos inteiros**; exibição via `formatBRL` (`R$ 1.234,56`, `−R$ 10,00`).
- Datas civis `YYYY-MM-DD`; exibição `21 nov`, `Hoje · 21 nov`.
- Nada de `isPro`: use `useFeature('export.pdf')`, `useLimit('budgets.max')`, `<FeatureGate>`.
- Use apenas os tokens de `packages/shared/src/theme.ts`.
