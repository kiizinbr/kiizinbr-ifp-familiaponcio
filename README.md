# IFP Connect

Plataforma única para operação do Instituto Família Pôncio (IFP) — Núcleo Transversal (Ficha Cidadã, Triagem Social, RBAC, LGPD).

## Stack

Next.js 16 · TypeScript · Tailwind · shadcn/ui · Prisma · PostgreSQL 16 (RLS) · Auth.js v5 · Docker

## Setup local

```bash
# 1. Pré-requisitos
node --version   # 24.x (ou 22 LTS+)
pnpm --version   # 9.x+
docker --version

# 2. Instalar deps
pnpm install

# 3. Subir banco + storage de dev
docker compose -f docker-compose.dev.yml up -d

# 4. Copiar env
cp .env.example .env.local
# editar .env.local com segredos

# 5. Migrations do banco
pnpm prisma migrate dev

# 6. Rodar dev server
pnpm dev
```

App em http://localhost:3000.

## Comandos

- `pnpm dev` — Next.js em modo dev
- `pnpm build` — build de produção
- `pnpm test` — Vitest (unit)
- `pnpm test:e2e` — Playwright (e2e)
- `pnpm lint` — ESLint
- `pnpm typecheck` — TypeScript estrito
- `pnpm format` — Prettier write
- `pnpm db:migrate` — Prisma migrate dev
- `pnpm db:studio` — Prisma Studio
- `pnpm db:seed` — Seed inicial

## Documentação

- Spec do MVP: `docs/superpowers/specs/2026-05-23-ifp-connect-mvp-design.md`
- Planos de implementação: `docs/superpowers/plans/`

## Licença

Uso interno do Instituto Família Pôncio. Não distribuir publicamente sem autorização da Diretoria.
