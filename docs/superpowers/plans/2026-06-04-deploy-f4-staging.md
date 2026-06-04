# Deploy IFP Connect (F4) — STAGING — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colocar o IFP Connect acessível por uma URL pública HTTPS (staging, dados de demo) numa VM Ubuntu dedicada, via Docker + Tailscale Funnel.

**Architecture:** Imagem Docker do Next (standalone) + Postgres 16 + MinIO num `docker-compose.prod.yml`; migrations/seed via serviço `migrate` one-shot (stage de build, tem o toolchain Prisma). Tailscale Funnel (TCP) publica só o `:3000` do app; Postgres/MinIO ficam na rede interna. Banner "STAGING" gated por env de runtime.

**Tech Stack:** Next.js 16 (output standalone), Prisma 6, Postgres 16, MinIO, Docker Compose, Tailscale Funnel, node:22-alpine.

**Spec:** `docs/superpowers/specs/2026-06-04-deploy-f4-design.md`

---

## Convenções

- **Build/verify do app** roda no WSL Ubuntu: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm …"`. **Docker** está disponível no WSL (o `dev:up` usa `docker compose`).
- **git push** pelo git nativo do Windows. Commit **sem aspas duplas**.
- As Tasks **T1–T7 são código no repo** (executo eu, verificáveis localmente). As **T8–T11 são runbook de infra na VM** — `ops/vm/README.md` — executadas pelo Erick (ou por mim **com o OK explícito dele**, pois `tailscale funnel` é exposição pública).
- ⚠️ **Não há suíte de teste pra Dockerfile/compose** — a verificação é o **smoke local** (T7): buildar e subir a stack de prod localmente antes da VM. É o gate que pega o problema clássico do **engine do Prisma no standalone**.

---

## File Structure

**Criar:**

- `src/components/staging-banner.tsx` — banner "STAGING", server component, gated em `process.env.STAGING_BANNER`.
- `ops/vm/Dockerfile` — multi-stage do Next (deps → build → runner standalone); o stage `build` também serve o `migrate`.
- `ops/vm/docker-compose.prod.yml` — serviços `postgres` + `minio` + `migrate` (one-shot) + `app`.
- `ops/vm/deploy.sh` — orquestra build → up dados → migrate → up app.
- `ops/vm/.env.prod.example` — template das envs (sem segredos).
- `ops/vm/README.md` — runbook de provisionamento da VM + deploy (T8–T11).
- `ops/vm/.dockerignore` — enxuga o context do build.

**Modificar:**

- `next.config.ts` — adicionar `output: "standalone"`.
- `src/components/app-shell.tsx` — renderizar `<StagingBanner />` no topo.
- `.gitignore` — ignorar `ops/vm/.env.prod`.

---

## Task 1: `output: standalone` no Next

**Files:**

- Modify: `next.config.ts`

- [ ] **Step 1: Adicionar a opção**

```ts
import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  typedRoutes: true,
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
```

- [ ] **Step 2: Verificar que o build standalone gera `server.js`**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && rm -rf .next && pnpm build && ls .next/standalone/server.js"`
Expected: build OK + o arquivo `.next/standalone/server.js` existe.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "build: output standalone p/ empacotamento Docker (deploy F4)"
```

---

## Task 2: Banner STAGING

**Files:**

- Create: `src/components/staging-banner.tsx`
- Modify: `src/components/app-shell.tsx`

- [ ] **Step 1: Criar o componente** (server component — lê env em runtime)

```tsx
/**
 * Faixa "STAGING" no topo das telas autenticadas. Server component: lê a env
 * de RUNTIME `STAGING_BANNER` (não NEXT_PUBLIC → liga/desliga sem rebuild).
 * Em produção a env fica desligada e o banner some.
 */
export function StagingBanner() {
  if (process.env.STAGING_BANNER !== "1") return null;
  return (
    <div
      style={{
        background: "var(--live)",
        color: "#fff",
        textAlign: "center",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.02em",
        padding: "5px 12px",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      ⚠ STAGING · DADOS DE DEMONSTRAÇÃO — não usar com dados reais de paciente
    </div>
  );
}
```

- [ ] **Step 2: Renderizar no topo do AppShell** (`src/components/app-shell.tsx`)

Importar no topo:

```ts
import { StagingBanner } from "@/components/staging-banner";
```

Envolver o retorno: trocar `return (\n    <div className="shell ifp-kit" …>` por um fragment com o banner ANTES do shell:

```tsx
return (
  <>
    <StagingBanner />
    <div className="shell ifp-kit" data-unit={unit} {...(unit ? { "data-unit-accent": "" } : {})}>
      {/* …conteúdo atual do shell… */}
    </div>
  </>
);
```

> O `</div>` de fechamento do `.shell` passa a ser seguido de `</>`. Não muda mais nada do shell.

- [ ] **Step 3: Verificar localmente que o banner aparece só com a env**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm typecheck && pnpm lint"`
Expected: PASS. (O render condicional é validado de fato no smoke da T7 com `STAGING_BANNER=1`.)

- [ ] **Step 4: Commit**

```bash
git add src/components/staging-banner.tsx src/components/app-shell.tsx
git commit -m "feat: banner STAGING gated em env de runtime no AppShell"
```

---

## Task 3: Dockerfile (Next standalone)

**Files:**

- Create: `ops/vm/Dockerfile`
- Create: `ops/vm/.dockerignore`

- [ ] **Step 1: `.dockerignore`** (enxuga o context)

```
node_modules
.next
.git
docs
tests
*.md
ops/vm/.env*
public/lab/_verify-*
```

- [ ] **Step 2: Dockerfile multi-stage**

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# --- deps: instala todas as deps (com lockfile) ---
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- build: gera o Prisma Client + o build standalone do Next ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate
RUN pnpm build

# --- runner: imagem enxuta com o servidor standalone ---
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
# server.js + node_modules mínimo (traçado pelo Next standalone)
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Defensivo: garante o engine do Prisma na imagem (o standalone às vezes não traça o .so)
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

> O stage `build` é reusado pelo serviço `migrate` (tem `prisma` CLI + `tsx` + schema + migrations). O `runner` é a imagem do app.

- [ ] **Step 3: Commit** (o build de verdade é validado na T7)

```bash
git add ops/vm/Dockerfile ops/vm/.dockerignore
git commit -m "ops: Dockerfile multi-stage do Next standalone (deploy F4)"
```

---

## Task 4: docker-compose.prod.yml

**Files:**

- Create: `ops/vm/docker-compose.prod.yml`

- [ ] **Step 1: Escrever o compose**

```yaml
name: ifp-prod

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - ifp_pg_prod:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped
    # SEM `ports:` — só acessível na rede interna do compose.

  minio:
    image: minio/minio:latest
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    command: server /data --console-address ":9001"
    volumes:
      - ifp_minio_prod:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      timeout: 5s
      retries: 10
    restart: unless-stopped
    # SEM `ports:` — o app cria o bucket sozinho (lib/minio.ts ensureBucketExists).

  migrate:
    build:
      context: ../..
      dockerfile: ops/vm/Dockerfile
      target: build
    env_file: .env.prod
    depends_on:
      postgres:
        condition: service_healthy
    command: sh -c "pnpm prisma migrate deploy"
    restart: "no"

  app:
    build:
      context: ../..
      dockerfile: ops/vm/Dockerfile
      target: runner
    env_file: .env.prod
    depends_on:
      postgres:
        condition: service_healthy
      minio:
        condition: service_healthy
    ports:
      - "127.0.0.1:3000:3000" # só localhost da VM → o Tailscale Funnel aponta aqui
    restart: unless-stopped

volumes:
  ifp_pg_prod:
  ifp_minio_prod:
```

> `context: ../..` = raiz do repo (o compose vive em `ops/vm/`). `ports` em `127.0.0.1` garante que o `:3000` **não** fica exposto na LAN da VM — só o Funnel (local) alcança.

- [ ] **Step 2: Commit**

```bash
git add ops/vm/docker-compose.prod.yml
git commit -m "ops: docker-compose.prod (postgres+minio+migrate+app, sem expor dados)"
```

---

## Task 5: deploy.sh + .env.prod.example + .gitignore

**Files:**

- Create: `ops/vm/deploy.sh`
- Create: `ops/vm/.env.prod.example`
- Modify: `.gitignore`

- [ ] **Step 1: `deploy.sh`** (idempotente)

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"            # ops/vm
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.prod"

echo "==> git pull (raiz do repo)"
git -C ../.. pull --ff-only

echo "==> build das imagens"
$COMPOSE build

echo "==> sobe Postgres + MinIO"
$COMPOSE up -d postgres minio

echo "==> migrations (prisma migrate deploy)"
$COMPOSE run --rm migrate

echo "==> sobe o app"
$COMPOSE up -d app

echo "==> status"
$COMPOSE ps
echo "OK. Primeira vez? rode o seed: $COMPOSE run --rm migrate pnpm tsx prisma/seed.ts"
```

- [ ] **Step 2: `.env.prod.example`** (template — copie p/ `.env.prod` na VM e preencha)

```bash
# ===== App (Next/Prisma/Auth) =====
NODE_ENV=production
# host = nome do serviço Postgres no compose
DATABASE_URL=postgresql://ifp:TROQUE_SENHA_PG@postgres:5432/ifp_connect
# openssl rand -base64 48
AUTH_SECRET=TROQUE_por_string_aleatoria_min_32_chars
# A URL PÚBLICA do Tailscale Funnel (https). Obrigatória p/ cookies do NextAuth.
AUTH_URL=https://ifp-app.SEU-TAILNET.ts.net

# ===== MinIO (interno) =====
MINIO_HOST=minio
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=ifp_minio_prod
MINIO_SECRET_KEY=TROQUE_senha_minio
MINIO_BUCKET_CIDADAO=ifp-cidadao-anexos

# ===== Banner staging (1 = mostra; remover/0 = some) =====
STAGING_BANNER=1

# ===== Postgres container (consumido pelo serviço postgres do compose) =====
POSTGRES_USER=ifp
POSTGRES_PASSWORD=TROQUE_SENHA_PG
POSTGRES_DB=ifp_connect
```

> ⚠️ A senha em `POSTGRES_PASSWORD` e a de `DATABASE_URL` **têm que bater**.

- [ ] **Step 3: `.gitignore`** — adicionar:

```
# segredos do deploy (ficam só na VM)
ops/vm/.env.prod
```

- [ ] **Step 4: Tornar o deploy.sh executável + commit**

Run: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && chmod +x ops/vm/deploy.sh"`

```bash
git add ops/vm/deploy.sh ops/vm/.env.prod.example .gitignore
git commit -m "ops: deploy.sh + .env.prod.example + gitignore do .env.prod"
```

---

## Task 6: Runbook da VM (`ops/vm/README.md`)

**Files:**

- Create: `ops/vm/README.md`

- [ ] **Step 1: Escrever o runbook** (passos T8–T11, com comandos exatos)

````markdown
# Deploy IFP Connect — STAGING (VM Ubuntu + Tailscale Funnel)

Ambiente de **demonstração** (dados de seed). Não usar com paciente real.

## 1. Provisionar a VM (host Hyper-V)

- Criar VM **IFP-APP**: Ubuntu Server 24.04 LTS, **≥4 GB RAM / 2 vCPU / ~40 GB disco**, rede com saída à internet.
  - PowerShell (host), ajuste o caminho do ISO/switch:
    ```powershell
    New-VM -Name IFP-APP -MemoryStartupBytes 4GB -Generation 2 -NewVHDPath "D:\VMs\IFP-APP.vhdx" -NewVHDSizeBytes 40GB -SwitchName "Default Switch"
    Set-VMProcessor IFP-APP -Count 2
    Set-VMDvdDrive IFP-APP -Path "C:\ISO\ubuntu-24.04-live-server-amd64.iso"
    Start-VM IFP-APP
    ```
  - Instalar o Ubuntu pelo console (usuário `erickramos`, OpenSSH server marcado).

## 2. Na VM: Docker + git + Tailscale

```bash
sudo apt update && sudo apt install -y git ca-certificates curl
# Docker (script oficial)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
# Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up    # autentica no tailnet do grupo
```

## 3. Código + segredos

```bash
sudo mkdir -p /opt/ifp-connect && sudo chown $USER /opt/ifp-connect
git clone <REPO_URL> /opt/ifp-connect        # deploy key read-only
cd /opt/ifp-connect/ops/vm
cp .env.prod.example .env.prod
openssl rand -base64 48                       # cole em AUTH_SECRET
nano .env.prod                                # preencher senhas + AUTH_URL (passo 5)
```

## 4. Subir a stack

```bash
cd /opt/ifp-connect/ops/vm
./deploy.sh
# primeira vez (popular demo):
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm migrate pnpm tsx prisma/seed.ts
```

## 5. Publicar com Tailscale Funnel (TCP)

```bash
sudo tailscale funnel --bg 3000
sudo tailscale funnel status        # mostra a URL https://ifp-app.<tailnet>.ts.net
```

- Pegue a URL e coloque em `AUTH_URL` no `.env.prod`, depois `./deploy.sh` de novo (o app precisa da URL pública certa pros cookies).

## 6. Verificar

- Abrir a URL `https://…ts.net` de **fora da rede** (celular em 4G) → cadeado TLS válido.
- Login demo: `raquel.barros@familiaponcio.org.br` / `ifp-demo-2026` → `/medico`.
- Banner laranja "STAGING" no topo.
- `docker compose -f docker-compose.prod.yml --env-file .env.prod ps` → 3 serviços `Up/healthy`.
- `curl http://<IP-LAN-da-VM>:3000` de outra máquina **falha/recusa** (só `127.0.0.1` + funnel) — confirma que não vazou.

## Atualizar (deploys seguintes)

```bash
cd /opt/ifp-connect/ops/vm && ./deploy.sh
```

## Parar / logs

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f app
docker compose -f docker-compose.prod.yml --env-file .env.prod down       # mantém volumes
```
````

- [ ] **Step 2: Commit**

```bash
git add ops/vm/README.md
git commit -m "docs(ops): runbook de provisionamento + deploy da VM staging"
```

---

## Task 7: Smoke LOCAL da stack de prod (gate antes da VM)

> Valida Dockerfile + compose + **engine do Prisma no standalone** + o banner, ANTES de tocar na VM. Roda no Docker do WSL, em portas separadas pra não bater com o dev.

**Files:**

- (nenhum novo; usa um `.env.prod` temporário local, gitignored)

- [ ] **Step 1: `.env.prod` local de teste** (em `ops/vm/.env.prod`, já gitignored)

```bash
NODE_ENV=production
DATABASE_URL=postgresql://ifp:smoke_pg@postgres:5432/ifp_connect
AUTH_SECRET=smoke_smoke_smoke_smoke_smoke_smoke_32x
AUTH_URL=http://localhost:3001
MINIO_HOST=minio
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=ifp_minio_prod
MINIO_SECRET_KEY=smoke_minio
MINIO_BUCKET_CIDADAO=ifp-cidadao-anexos
STAGING_BANNER=1
POSTGRES_USER=ifp
POSTGRES_PASSWORD=smoke_pg
POSTGRES_DB=ifp_connect
```

- [ ] **Step 2: Build + up com o app na porta 3001** (override só do smoke)

Run:

```bash
wsl -d Ubuntu -- bash -lc 'cd /mnt/c/Users/Administrador/ifp-connect/ops/vm && \
  C="docker compose -f docker-compose.prod.yml --env-file .env.prod" && \
  $C build && $C up -d postgres minio && sleep 8 && \
  $C run --rm migrate && \
  $C run --rm migrate pnpm tsx prisma/seed.ts && \
  $C run -d --service-ports -p 127.0.0.1:3001:3000 app && sleep 6 && \
  curl -fsS -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3001/medico/login'
```

Expected: build OK; migrate OK; seed OK; `HTTP 200` no `/medico/login`. **Se o engine do Prisma faltar**, o app loga erro de query no `logs app` — aí o `COPY` defensivo do Dockerfile (T3) é o que resolve.

- [ ] **Step 3: Conferir o banner + login no browser local** (opcional, visual)

Abrir `http://localhost:3001/medico/login`, logar `raquel.barros@familiaponcio.org.br` / `ifp-demo-2026`, confirmar a **faixa laranja STAGING** no topo do `/medico`.

- [ ] **Step 4: Derrubar a stack de smoke**

Run:

```bash
wsl -d Ubuntu -- bash -lc 'cd /mnt/c/Users/Administrador/ifp-connect/ops/vm && \
  docker compose -f docker-compose.prod.yml --env-file .env.prod down -v && rm -f .env.prod'
```

Expected: stack derrubada + volumes de smoke removidos + `.env.prod` de teste apagado.

- [ ] **Step 5: Push de tudo** (T1–T7 já commitados localmente)

```bash
git -C "C:\Users\Administrador\ifp-connect" push origin main
```

---

## Task 8–11: Infra na VM (runbook — Erick executa, ou eu com OK explícito)

> ⚠️ `tailscale funnel` é **exposição pública** — só rodar com o go-ahead do Erick. Os passos são o `ops/vm/README.md` (T6). Resumo dos gates:

- [ ] **T8 — Provisionar a VM** `IFP-APP` (Hyper-V, Ubuntu 24.04, ≥4GB). → README §1
- [ ] **T9 — Instalar** Docker + git + Tailscale; `tailscale up`. → README §2
- [ ] **T10 — Clonar** o repo em `/opt/ifp-connect`, criar `.env.prod`, `./deploy.sh`, seed 1ª vez, `tailscale funnel 3000`, ajustar `AUTH_URL` e redeploy. → README §3–5
- [ ] **T11 — Verificar** acesso público HTTPS de fora + login demo + banner STAGING + 3 serviços healthy + `:3000` não exposto na LAN. → README §6

---

## Self-Review (preenchido)

**Cobertura da spec:**

- §D1 staging/demo → seed na T7/runbook; §D2 Tailscale Funnel TCP → README §5; §D3 VM dedicada IFP-APP → README §1; §D4 Docker 3 serviços → T3/T4; §D5 ≥4GB → README §1; §D6 banner STAGING → T2. ✓
- Topologia (só :3000 exposto, dados internos) → compose sem `ports` em postgres/minio + app em `127.0.0.1` (T4). ✓
- Build/deploy (`ops/vm/`, Dockerfile standalone, deploy.sh, migrate one-shot) → T3–T6. ✓
- Segredos (`.env.prod` gitignored, AUTH_URL=funnel) → T5. ✓
- Migrations sem dotenv (env do compose) → serviço `migrate` roda `prisma migrate deploy` cru, não o script `db:deploy` (que usa dotenv `.env.local`). ✓
- Verificação → T7 (smoke local) + README §6 (na VM). ✓
- Fora-de-escopo (domínio/backup/hardening/LGPD/CD) → permanece fora; não há task pra eles. ✓ (intencional)

**Placeholders:** os `TROQUE_*` no `.env.prod.example` e `<REPO_URL>`/`<tailnet>` são valores preenchidos no deploy, não lacunas do plano. Sem "TBD/TODO" de lógica.

**Consistência:** nomes de env batem entre `env.ts` (Zod) ↔ `.env.prod.example` ↔ compose (`POSTGRES_*` p/ o container, `DATABASE_URL`/`AUTH_*`/`MINIO_*` p/ o app). `STAGING_BANNER` lido em `staging-banner.tsx` = setado no `.env.prod`. `output:"standalone"` (T1) é o que o Dockerfile runner copia (T3). O serviço `migrate` usa o stage `build` (tem prisma+tsx) — coerente com o Dockerfile.
