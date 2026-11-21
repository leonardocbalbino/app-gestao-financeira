# Painel admin

Next.js (App Router) + Tailwind + shadcn/ui. Usa **somente a anon key**: as permissões vêm de
RLS + `is_admin()` no Supabase (papéis `owner`, `editor`, `viewer`).

```bash
cp ../../.env.example .env.local   # NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
pnpm dev                           # http://localhost:3001
```

Primeiro owner: crie o usuário no Supabase Auth e rode no SQL Editor
`insert into public.admins (user_id, role) values ('<uuid>', 'owner');`.

Telas: Dashboard, Planos, Matriz de funcionalidades (rascunho → diff → publicar), Anúncios,
Usuários (concessão de plano, overrides, CSV), Config remota, Auditoria e Administradores.
Mudanças publicadas chegam aos apps em até ~1 minuto.

Testes: `pnpm test` (unitários) e `pnpm exec playwright test` (E2E contra o Supabase local;
exige `SUPABASE_SERVICE_ROLE_KEY` no ambiente só para criar usuários de teste).
