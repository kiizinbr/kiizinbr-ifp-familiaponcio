# IFP Connect

Plataforma única para operação do Instituto Família Pôncio (IFP) — Núcleo Transversal (Ficha Cidadã, Triagem Social, RBAC, LGPD).

## Stack

Next.js 16 · TypeScript · Tailwind · shadcn/ui · Prisma 6 · PostgreSQL 16 · Auth.js v5 · Docker

## Setup local (Windows + WSL2 Ubuntu)

> Por que WSL? Postgres roda em container Docker dentro do WSL. Rodar Node no host
> Windows atravessa o `wslrelay`, que tem bug intermitente com handshake Postgres
> em Win Server 2022 (sem mirrored networking). Rodar Node DENTRO do WSL elimina o
> relay e dá paridade 1:1 com produção Linux.

### Pré-requisitos

- WSL2 com distro Ubuntu 24.04+ (`wsl --install -d Ubuntu`)
- Docker CE instalado dentro do Ubuntu (`curl -fsSL https://get.docker.com | sh`)
- Node 22+ e pnpm 9+ instalados dentro do Ubuntu (via `corepack enable && corepack prepare pnpm@latest --activate`)

### Setup

```bash
# Tudo daqui pra baixo roda DENTRO do WSL Ubuntu
cd /mnt/c/Users/Administrador/ifp-connect   # ou onde clonou

# 1. Subir Postgres + MinIO em Docker
docker compose -f docker-compose.dev.yml up -d

# 2. Validar Postgres respondendo
docker exec ifp_postgres_dev pg_isready -U ifp -d ifp_connect

# 3. Instalar deps Node (binarios Linux)
pnpm install

# 4. Copiar .env exemplo e gerar AUTH_SECRET
cp .env.example .env.local
node -e "console.log('AUTH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))" >> .env.local
# revisar .env.local

# 5. Aplicar migrations + seed do user erick
pnpm db:migrate
pnpm db:seed

# 6. Subir dev server
pnpm dev
```

## URLs (dev)

| O que             | URL                                   | Como entrar                                                                |
| ----------------- | ------------------------------------- | -------------------------------------------------------------------------- |
| Landing pública   | http://localhost:3000                 | sem login — escolha de unidade                                             |
| Login por unidade | http://localhost:3000/<unidade>/login | ex.: `/medico/login` · `erick.ramos@familiaponcio.org.br` / `ifp-dev-2026` |
| Painel da unidade | http://localhost:3000/medico          | redireciona pro `/<unidade>/login` se sem sessão                           |
| Prisma Studio     | http://localhost:5555                 | `pnpm db:studio`                                                           |
| MinIO console     | http://localhost:9001                 | `ifp_minio` / `ifp_minio_dev_pw`                                           |

## Scripts pnpm

| Comando                    | O que faz                             |
| -------------------------- | ------------------------------------- |
| `pnpm dev`                 | Next.js dev server (Turbopack)        |
| `pnpm build`               | Build de produção                     |
| `pnpm start`               | Servir build de produção              |
| `pnpm typecheck`           | `tsc --noEmit`                        |
| `pnpm lint`                | ESLint                                |
| `pnpm format`              | Prettier write (formata)              |
| `pnpm format:check`        | Prettier check (CI usa)               |
| `pnpm test`                | Vitest (unit)                         |
| `pnpm test:e2e`            | Playwright (e2e login flow)           |
| `pnpm db:migrate --name X` | Cria + aplica migration nova          |
| `pnpm db:deploy`           | Aplica migrations existentes (CI usa) |
| `pnpm db:studio`           | UI Prisma Studio                      |
| `pnpm db:seed`             | Cria/atualiza user erick              |
| `pnpm db:generate`         | Regenera Prisma Client                |

## Troubleshooting

### `Can't reach database server at localhost:5433`

Sintoma do `wslrelay` flapando. Reinicia o WSL e tenta de novo:

```bash
# Do PowerShell:
wsl --shutdown
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && docker compose -f docker-compose.dev.yml up -d"
```

Se persistir, considere mover o workspace pra `~/ifp-connect` dentro do WSL
(filesystem nativo, fora do `/mnt/c`) — elimina o relay completamente.

### Porta 5432 ocupada

Server CLEAN tem Postgres 9.6 nativo do Alterdata/Bimer em 5432. Por isso o
container dev usa **5433**. Não tente trocar — Alterdata depende do 9.6.

### Playwright em Ubuntu 26.04+

Playwright pode reclamar de OS não suportado. Spoofar `/etc/os-release` pra
`24.04` (LTS noble) durante o `playwright install`, depois restaurar.

### `git push` de dentro do WSL trava

Mesmo `wslrelay` do Postgres: o upload de pack do `git push` (HTTPS) fica preso
em I/O de rede e não completa, mesmo com `wsl --shutdown`. Um `curl https://github.com`
funciona (GET simples passa), então "parece" que a rede está ok — mas o push trava.

**Workaround (atual):** pushar pelo git NATIVO do Windows (o repo vive no FS Windows):

```powershell
git -C "C:\Users\Administrador\ifp-connect" push origin main
```

**Correção definitiva (recomendada):** configurar uma chave SSH pro GitHub. O SSH
(porta 22) **conecta normal** pelo relay — só falta a chave registrada na conta.
Com a chave, troca o remote pra SSH e o `git push` roda direto do WSL:

```bash
ssh-keygen -t ed25519 -C "ifp-dev"      # gera a chave
# adicionar a pública em github.com/settings/keys
git remote set-url origin git@github.com:kiizinbr/kiizinbr-ifp-familiaponcio.git
```

## Documentação

- Spec do MVP: `docs/superpowers/specs/2026-05-23-ifp-connect-mvp-design.md`
- Planos de implementação: `docs/superpowers/plans/`
- Plano 1 Foundation: `docs/superpowers/plans/2026-05-23-ifp-connect-mvp-01-foundation.md` (✅ 12/12 done em 2026-05-24)

## Licença

Uso interno do Instituto Família Pôncio. Não distribuir publicamente sem autorização da Diretoria.
