# Deploy em VPS único — IFP Connect

Walkthrough para subir o IFP Connect em um VPS único (Hetzner / DigitalOcean /
Contabo etc.) com Docker Compose, HTTPS automático via Caddy/Let's Encrypt e
backups simples do Postgres.

Esse modelo aguenta tranquilamente o piloto e os primeiros milhares de Fichas
Cidadãs por mês. Quando crescer, basta migrar peças (banco vai pra Neon/Supabase,
imagens pra registry, etc.) sem refatorar o app.

---

## 1. Pré-requisitos

- VPS Linux (recomendado Ubuntu 22.04+ ou Debian 12+) com 2 vCPU / 4 GB RAM /
  40 GB disco. Para o piloto, Hetzner CX22 (~€5/mês) basta.
- Domínio (ex.: `ifp.exemplo.org.br`) com dois A records apontando para o IP
  do VPS:
  - `ifp.exemplo.org.br` (frontend)
  - `api.ifp.exemplo.org.br` (API)
- Acesso SSH como usuário não-root com `sudo`.

## 2. Preparar o servidor

```bash
# No VPS, como usuário com sudo:
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg ufw

# Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER     # logout/login para aplicar
sudo systemctl enable --now docker

# Firewall mínimo
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 3. Clonar o repo e preencher o .env.production

```bash
cd /opt
sudo mkdir -p ifp-connect && sudo chown $USER:$USER ifp-connect
git clone https://github.com/kiizinbr/kiizinbr-ifp-familiaponcio.git ifp-connect
cd ifp-connect

cp .env.production.example .env.production
chmod 600 .env.production
# Editar .env.production e preencher:
#   POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET, NEXTAUTH_SECRET
#     (gerar cada um com: openssl rand -base64 32)
#   WEB_DOMAIN, API_DOMAIN, WEB_ORIGIN, ACME_EMAIL
nano .env.production
```

## 4. Build, migrar e subir

```bash
# Build das imagens (web, api, migrator)
docker compose -f docker-compose.prod.yml --env-file .env.production build

# Roda migrations uma vez (cria todas as tabelas do schema.prisma)
docker compose -f docker-compose.prod.yml --env-file .env.production \
  --profile tools run --rm migrate

# Seed inicial (4 Unidades + Super Admin, se SEED_SUPER_ADMIN_PASSWORD setado)
# Defina temporariamente SEED_SUPER_ADMIN_PASSWORD no .env.production e:
docker compose -f docker-compose.prod.yml --env-file .env.production \
  run --rm -e SEED_SUPER_ADMIN_PASSWORD migrate \
  pnpm --filter @ifp/database seed
# Depois remova SEED_SUPER_ADMIN_PASSWORD do .env.production por segurança.

# Sobe tudo (postgres, redis, api, web, caddy)
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

Em ~30 segundos o Caddy negocia o certificado TLS com a Let's Encrypt e os
domínios ficam disponíveis em HTTPS.

## 5. Smoke tests

```bash
curl -fsS https://$WEB_DOMAIN/                       # 200 OK
curl -fsS https://$API_DOMAIN/api/v1/health          # { status: "ok", ... }
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f
```

Acessar `https://$WEB_DOMAIN/login` e entrar com o Super Admin do seed.

## 6. Atualizar para uma nova versão

```bash
cd /opt/ifp-connect
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production \
  --profile tools run --rm migrate
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

## 7. Backups do Postgres

Quick-and-dirty diário via cronjob, copiando o dump para um bucket
S3-compatível (R2/Spaces/Wasabi). Adicione ao crontab do usuário (`crontab -e`):

```cron
30 3 * * * cd /opt/ifp-connect && docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres pg_dump -U ifp ifp_connect | gzip | aws s3 cp - s3://ifp-backups/postgres/$(date -u +\%F).sql.gz
```

(Configurar `aws` CLI antes com as credenciais do R2/S3.)

Restore: `gunzip < backup.sql.gz | docker compose exec -T postgres psql -U ifp ifp_connect`.

## 8. Observabilidade mínima

- `docker compose logs -f api` / `web` para tail.
- `docker stats` para CPU/memória.
- Para metrics de longo prazo, adicione um Uptime Kuma na mesma rede docker
  (`docker run -d --name kuma -p 3001:3001 -v kuma-data:/app/data louislam/uptime-kuma`).

## 9. Quando migrar pra algo maior

Se o piloto crescer a ponto de:
- O Postgres precisar de PITR (point-in-time recovery) → mover para Neon ou
  Supabase. Só trocar `DATABASE_URL`.
- Múltiplas réplicas da API → usar Render/Fly/AWS ECS. As imagens deste repo
  funcionam sem alterações; só precisa colocar atrás de um load balancer.
- Tráfego internacional → CDN na frente do `web` (Cloudflare na frente do
  Caddy resolve).

Nada do código precisa mudar — só a infra. Por isso fica plug-and-play.
