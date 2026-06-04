# Spec — Deploy IFP Connect (F4 / Plano 8) — STAGING

**Data:** 2026-06-04
**Fase:** F4 (deploy), primeira etapa = STAGING
**Status:** design aprovado por Erick (escopo + host + VM + Docker + banner).

## Objetivo

Tirar o IFP Connect do `localhost`/dev e colocá-lo **acessível remotamente** para o time e a
diretoria testarem/homologarem, ainda com **dados de demonstração** (seed). Não é produção: sem
paciente real, sem o peso total de LGPD ainda. A promoção para produção (dado real) é uma **etapa
futura separada** (ver "Fora de escopo").

### Sucesso = 
Qualquer pessoa autorizada abre uma **URL pública HTTPS** de qualquer lugar, loga com um usuário demo,
e usa o sistema (médico/capacitação/etc.) exatamente como no dev — com um banner deixando claro que é
ambiente de demonstração.

## Decisões fechadas (com Erick, 2026-06-04)

- **§D1 Escopo:** staging com dados de seed (demo). Sem dado de paciente real.
- **§D2 Host:** VM Ubuntu on-prem + **Tailscale Funnel** (padrão provado no StockHub nesta rede;
  cloudflared/QUIC flapa aqui → usar **TCP**).
- **§D3 Máquina:** **VM nova dedicada `IFP-APP`** (isolamento; não divide host com o StockHub).
- **§D4 Empacotamento:** **Docker** (reproduzível e portável p/ qualquer host depois), via
  `docker-compose.prod.yml` com 3 serviços (app + postgres + minio).
- **§D5 VM:** dimensionar com **≥4 GB RAM** (build do Next é pesado).
- **§D6 Banner "STAGING — dados de demonstração"** visível no app, pra ninguém confundir com produção.

## Arquitetura / topologia

```
Internet ──► Tailscale Funnel (TLS automático, https://ifp-app.<tailnet>.ts.net)
              └─► VM "IFP-APP" (Ubuntu Server, Hyper-V no servidor host)
                   docker-compose.prod.yml:
                   ├─ app       Next.js 16 (output:standalone)   :3000  ◄── funnel → aqui
                   ├─ postgres  postgres:16-alpine (volume)      :5432  (rede interna do compose)
                   └─ minio     minio (volume)                   :9000/:9001 (rede interna)
```

- O Funnel publica **somente** o `:3000` do app. Postgres e MinIO ficam na rede interna do compose,
  **nunca** expostos à internet nem ao firewall do host.
- Espelha o `docker-compose.dev.yml` (mesmas imagens postgres:16-alpine + minio); diferenças: adiciona
  o serviço `app`, credenciais de produção, e os serviços de dados não publicam porta no host.

## Componentes

### App (`app`)
- **`Dockerfile`** multi-stage (deps → build → runner) baseado em `node:22-alpine` (engines: node ≥22).
- Requer adicionar **`output: "standalone"`** ao `next.config.ts` (gera servidor self-contained →
  imagem enxuta, `node server.js`). Única mudança de código de app necessária.
- `prisma generate` no build; o cliente Prisma entra na imagem.
- Sobe com as envs de produção (abaixo). `next start`/standalone na :3000.

### Postgres (`postgres`)
- `postgres:16-alpine`, volume nomeado `ifp_pg_prod`. Credenciais de produção (não as de dev).
- Migrations aplicadas via **`prisma migrate deploy`** (script `db:deploy`) no fluxo de deploy — nunca
  `migrate dev` em prod.

### MinIO (`minio`)
- `minio/minio`, volume `ifp_minio_prod`, bucket `ifp-cidadao-anexos` criado no bootstrap. Credenciais
  de produção. O código já consome `MINIO_*` (Plano 3 T4) — só muda config.

## Build & deploy (pasta nova `ops/vm/`)

Tudo versionado no repo, em `ops/vm/`:
- **`Dockerfile`** — multi-stage do Next (standalone).
- **`docker-compose.prod.yml`** — os 3 serviços + volumes + rede interna; `restart: unless-stopped`.
- **`deploy.sh`** — idempotente: `git pull` → `docker compose -f ops/vm/docker-compose.prod.yml build`
  → aplica **migrations** (`prisma migrate deploy`) e o **seed** (1ª vez) via um **serviço `migrate`
  one-shot** (`docker compose run --rm migrate`) que usa o stage de build (tem o toolchain Prisma +
  `tsx` p/ o seed) — a imagem `app` standalone é enxuta e **não** tem o CLI do Prisma → `up -d` do app.
- **`.env.prod.example`** — template das envs (sem segredos reais).
- **`README.md`** — runbook de provisionamento + deploy (passo a passo, comandos exatos).

**Deploy nesta fase = SSH na VM + rodar `deploy.sh`** (manual). CD automático (push→deploy) fica para
a fase de produção.

## Provisionamento da VM (runbook, executado por Erick com comandos do plano)

1. Hyper-V no servidor host: criar VM **`IFP-APP`**, Ubuntu Server 24.04 LTS, **≥4 GB RAM / 2 vCPU /
   ~40 GB disco**, rede que tenha saída à internet (NAT/bridge).
2. Na VM: instalar **Docker + compose plugin**, **git**, **Tailscale**.
3. `tailscale up` (autenticar no tailnet do grupo), depois **`tailscale funnel 3000`** → publica
   `https://ifp-app.<tailnet>.ts.net` (TCP, TLS automático).
4. `git clone` do repo (deploy key read-only) em `/opt/ifp-connect`.
5. Criar `/opt/ifp-connect/ops/vm/.env.prod` (gitignored) com os segredos (ver abaixo).
6. Rodar `ops/vm/deploy.sh`.

## Segredos (gerados na VM, em `.env.prod`, fora do git)

| Var | Valor |
|---|---|
| `AUTH_SECRET` | novo, `openssl rand -base64 48` |
| `AUTH_URL` | **a URL pública do funnel** (`https://ifp-app.<tailnet>.ts.net`) — NextAuth precisa pros cookies/callback |
| `DATABASE_URL` | `postgresql://ifp:<senha-prod>@postgres:5432/ifp_connect` (host = nome do serviço no compose) |
| `MINIO_HOST` | `minio` · `MINIO_PORT=9000` · `MINIO_USE_SSL=false` (interno) |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | creds prod (não as de dev) |
| `MINIO_BUCKET_CIDADAO` | `ifp-cidadao-anexos` |
| `NODE_ENV` | `production` |

`AUTH_URL` em HTTPS é **obrigatório** (cookies `__Secure-`/`SameSite` do NextAuth). `trustHost`
ativo (NextAuth v5 atrás de proxy/funnel).

## Dados (staging)

- `pnpm db:seed` roda **uma vez** no 1º deploy: 9 usuários demo (senha `ifp-demo-2026`, erick
  `ifp-dev-2026`), cidadãos, médico (especialidades/profissionais/slots), capacitação, e o
  encaminhamento demo. Tudo fictício → recriável.
- **Banner "STAGING — dados de demonstração"** fixo no topo de toda tela autenticada (componente novo
  no AppShell, controlado por env `NEXT_PUBLIC_STAGING_BANNER=1`). Em prod, a env fica desligada → some.

## Verificação (como saber que deu certo)

1. `https://ifp-app.<tailnet>.ts.net` abre de fora da rede (celular em 4G), com cadeado TLS válido.
2. Login demo (ex.: `raquel.barros@familiaponcio.org.br` / `ifp-demo-2026`) → cai no `/medico`.
3. Banner "STAGING" visível.
4. Um fluxo real funciona ponta-a-ponta (ex.: a Fila do dia carrega; criar/cancelar algo persiste).
5. `docker compose ps` mostra os 3 serviços `healthy`; Postgres e MinIO **não** acessíveis de fora.

## Fora de escopo (promoção a PRODUÇÃO — etapa futura separada)

- **Domínio próprio** (ex.: `ifpconnect.org.br`) + DNS + (possível) troca de Tailscale Funnel por
  Cloudflare Tunnel/Nginx — validar QUIC nessa rede antes.
- **Backup testado:** `pg_dump` agendado + **restore validado** (não basta agendar o dump).
- **Hardening:** rate-limit no login, security headers, rotação de segredos, revisão de exposição
  pública (reusar a checklist de segurança do StockHub).
- **LGPD operacional:** retenção do audit log (§0.4), anonimização, DPA, política de acesso.
- **Remover seed/demo** + desligar o banner STAGING.
- **CD automático** (push na main → deploy) + observabilidade/uptime.
- **Disponibilidade:** a VM/funnel caindo derruba o app; definir restart/monitor.

## Riscos / notas

- **Tailscale Funnel** tem limites de fair-use; OK p/ staging com poucos usuários. Em prod, reavaliar.
- **Build do Next na VM** consome RAM/CPU — daí os ≥4 GB; se travar, buildar via CI e só puxar a imagem.
- O servidor host já sustenta a TI de várias empresas (CLEAN prod + StockHub VM); a VM nova soma carga —
  conferir recursos livres do host antes de provisionar.
- **`output: standalone`** muda o artefato de build; rodar o ritual (build) após adicionar, pra garantir
  que nada quebrou.
