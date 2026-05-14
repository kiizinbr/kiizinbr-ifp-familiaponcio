# Deploy on-prem em Hyper-V — IFP Connect

Walkthrough do zero pra rodar o IFP Connect numa VM Ubuntu hospedada no
Hyper-V de um Windows Server 2022 Datacenter, com acesso pela LAN interna do
Instituto (sem expor pra internet).

Resultado final: qualquer máquina da rede acessa `http://ifp.lan` e
`http://api.ifp.lan` (ou os hostnames que você definir).

---

## 1. Criar a VM no Hyper-V

### Specs recomendadas (mínimas pro piloto)

| Recurso | Valor |
|---|---|
| Geração | **Generation 2** (UEFI) |
| CPU | 2 vCPU (4 se sobrar) |
| RAM | 4 GB (8 GB se sobrar) |
| Disco | 60 GB (dinâmico) |
| Rede | **External Switch** (bridge no NIC físico do host) |
| ISO | Ubuntu Server 22.04 LTS |

### Criando o External Switch (se ainda não existir)

No Hyper-V Manager:

1. **Action → Virtual Switch Manager → New virtual network switch → External**
2. Nome: `IFP-External-Switch`
3. External network: selecione a placa de rede física do servidor (a que está conectada na LAN)
4. Marcar **Allow management operating system to share this network adapter**
5. **OK** — o host pode perder rede por alguns segundos durante a criação

### Criando a VM

1. **Action → New → Virtual Machine**
2. Nome: `ifp-connect-prod`
3. **Specify Generation → Generation 2**
4. RAM: 4096 MB (sem dynamic memory pra DB ficar estável)
5. Network: `IFP-External-Switch`
6. Disco: 60 GB dinâmico
7. Bootar a partir da ISO do Ubuntu Server 22.04 LTS

### Antes de ligar a VM — desabilitar Secure Boot

Ubuntu Generation 2 precisa disso:

1. Botão direito na VM → **Settings → Security**
2. Desmarque **Enable Secure Boot** _ou_ troque o template para **Microsoft UEFI Certificate Authority**

Liga a VM.

## 2. Instalar Ubuntu Server 22.04 LTS

No assistente do Ubuntu:

- **Language**: English (mais compatível com mensagens de erro do Docker)
- **Network**: a interface deve pegar IP via DHCP — anote o IP que aparece, mas vamos fixar depois.
- **Server name**: `ifp-prod`
- **Username**: `ifp` (ou outro de sua preferência)
- **OpenSSH server**: marque **Install OpenSSH server** (sem isso você não acessa via Putty/Terminal).
- **Featured server snaps**: pular tudo (vamos instalar Docker manualmente).

Reboot, retire o ISO do drive virtual.

## 3. Acessar via SSH e configurar IP estático

Do seu Windows, abra um PowerShell ou Windows Terminal:

```powershell
ssh ifp@<ip-da-vm>
```

(O `<ip-da-vm>` apareceu na tela do Ubuntu quando ele bootou.)

Dentro da VM, fixe o IP via Netplan (substitua os valores conforme sua rede):

```bash
sudo nano /etc/netplan/00-installer-config.yaml
```

Conteúdo (exemplo — adapte ao seu range):

```yaml
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: no
      addresses: [192.168.0.50/24]
      routes:
        - to: default
          via: 192.168.0.1
      nameservers:
        addresses: [192.168.0.1, 8.8.8.8]
```

> O nome da interface pode ser `eth0`, `ens33`, `enp0s3`… veja com `ip a`.

Aplicar:

```bash
sudo netplan apply
```

A sessão SSH vai cair se o IP mudou — reconecte pelo novo IP.

## 4. Atualizar o sistema e instalar Docker

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg git ufw

# Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
sudo systemctl enable --now docker
```

**Logout/login** (ou reboot) pra aplicar a permissão do docker no usuário:

```bash
exit
ssh ifp@192.168.0.50
docker ps     # deve responder sem "permission denied"
```

### Firewall mínimo

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
# sudo ufw allow 443/tcp     # so' se for ligar HTTPS interno depois
sudo ufw enable
```

## 5. Clonar o repo e preencher o .env.production

```bash
cd /opt
sudo mkdir -p ifp-connect && sudo chown $USER:$USER ifp-connect
git clone https://github.com/kiizinbr/kiizinbr-ifp-familiaponcio.git ifp-connect
cd ifp-connect

# usa a branch da feature ate o merge acontecer
git checkout claude/continue-projetoifp-section-10-RKC1n

cp .env.onprem.example .env.production
chmod 600 .env.production
nano .env.production
```

Preencha no `.env.production`:

- `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET`, `NEXTAUTH_SECRET` — gerar cada um com `openssl rand -base64 32` num terminal separado.
- `WEB_DOMAIN=ifp.lan`, `API_DOMAIN=api.ifp.lan`, `WEB_ORIGIN=http://ifp.lan`
- `SEED_SUPER_ADMIN_PASSWORD` — senha que você vai usar pra logar a primeira vez (depois pode remover).

## 6. Build, migrate, seed e up

Sempre rodando com os DOIS arquivos de compose:

```bash
COMPOSE_FILES="-f docker-compose.prod.yml -f docker-compose.onprem.yml"

docker compose $COMPOSE_FILES --env-file .env.production build
docker compose $COMPOSE_FILES --env-file .env.production --profile tools run --rm migrate

# Seed do Super Admin (precisa ter SEED_SUPER_ADMIN_PASSWORD no .env)
docker compose $COMPOSE_FILES --env-file .env.production --profile tools run --rm migrate \
  pnpm --filter @ifp/database seed

# Sobe tudo
docker compose $COMPOSE_FILES --env-file .env.production up -d
```

Conferir:

```bash
docker compose $COMPOSE_FILES --env-file .env.production ps
docker compose $COMPOSE_FILES --env-file .env.production logs -f caddy
```

## 7. Configurar DNS interno (escolha 1 das 2 opções)

### Opção A — Hosts file em cada PC cliente (mais simples, baixa frota)

No Windows, abre o **Bloco de Notas como Administrador** e edita
`C:\Windows\System32\drivers\etc\hosts`. Adicione no final:

```
192.168.0.50 ifp.lan api.ifp.lan
```

Salve. Cada PC do Instituto que precisar acessar precisa receber essa entrada.

### Opção B — DNS interno (mais escalável)

Se você tem AD/DNS no Windows Server, crie dois A records apontando
`ifp.lan` e `api.ifp.lan` para `192.168.0.50`. Aí todos os PCs do domínio
acessam direto sem mexer no hosts.

## 8. Testar

De qualquer PC da rede (que já tenha a entrada DNS/hosts):

- **`http://ifp.lan/`** → homepage IFP Connect com as 4 unidades
- **`http://ifp.lan/login`** → form de login (usa email/senha que você botou no seed)
- **`http://api.ifp.lan/api/v1/health`** → `{ "status": "ok", ... }`
- **`http://api.ifp.lan/api/docs`** → Swagger da API

Logue no `/login` com:
- Email: o `SEED_SUPER_ADMIN_EMAIL` (default `admin@ifp.local`)
- Senha: o `SEED_SUPER_ADMIN_PASSWORD` que você setou

Você cai no dashboard `/servico-social`.

## 9. Operação do dia-a-dia

### Atualizar pra uma nova versão

```bash
cd /opt/ifp-connect
git pull
docker compose $COMPOSE_FILES --env-file .env.production build
docker compose $COMPOSE_FILES --env-file .env.production --profile tools run --rm migrate
docker compose $COMPOSE_FILES --env-file .env.production up -d
```

### Backup diário do Postgres

Crie `/opt/ifp-connect/backup.sh`:

```bash
#!/bin/bash
set -e
cd /opt/ifp-connect
DATE=$(date -u +%F)
mkdir -p /var/backups/ifp
docker compose -f docker-compose.prod.yml -f docker-compose.onprem.yml \
  --env-file .env.production exec -T postgres \
  pg_dump -U ifp ifp_connect | gzip > /var/backups/ifp/$DATE.sql.gz
# manter ultimos 30 dias
find /var/backups/ifp -name '*.sql.gz' -mtime +30 -delete
```

```bash
sudo chmod +x /opt/ifp-connect/backup.sh
sudo crontab -e
# Adicionar:
30 3 * * * /opt/ifp-connect/backup.sh
```

Para restaurar:

```bash
gunzip < /var/backups/ifp/2026-05-14.sql.gz | \
  docker compose $COMPOSE_FILES --env-file .env.production exec -T postgres psql -U ifp ifp_connect
```

### Snapshots da VM (recomendado)

No Hyper-V Manager: **botão direito na VM → Checkpoint**. Faça antes de cada
upgrade grande. Restaura em segundos.

## 10. (Opcional) Ligar HTTPS interno mais tarde

Quando quiser HTTPS dentro da LAN (recomendado pra LGPD em dados sensíveis):

1. Edite `caddy/Caddyfile.internal` e troque `http://{$WEB_DOMAIN}` por `{$WEB_DOMAIN}` (idem para api), e descomente as linhas com `tls internal`.
2. No `docker-compose.onprem.yml`, descomente a porta 443.
3. Restart: `docker compose $COMPOSE_FILES --env-file .env.production up -d`.
4. Caddy gera um root CA local. Copie o cert pra cada PC cliente:

   ```bash
   docker compose $COMPOSE_FILES --env-file .env.production exec caddy \
     cat /data/caddy/pki/authorities/local/root.crt
   ```

   Cole num arquivo `.crt`, distribua via GPO (Active Directory) ou
   importe manualmente em cada PC: **Win+R → certmgr.msc → Trusted Root
   Certification Authorities → Import**.

5. Depois disso, `https://ifp.lan` fica com cadeado verde nos PCs com a CA instalada.

## 11. Troubleshooting rápido

| Sintoma | Verificar |
|---|---|
| `ifp.lan` não resolve no navegador | Hosts file do cliente / DNS interno |
| Conecta mas dá 502 | `docker compose ... logs -f caddy api web` |
| API não conecta no Postgres | `docker compose ... logs postgres` — checar `POSTGRES_PASSWORD` |
| Erro de permissão no `docker` | `usermod -aG docker $USER` + logout |
| VM sem internet | Conferir Netplan e External Switch no Hyper-V |

## 12. Quando crescer

Esse setup aguenta tranquilo o piloto e os primeiros milhares de Fichas
Cidadãs. Se chegar a hora de escalar:

- **Banco com PITR (point-in-time-recovery)** → trocar Postgres do compose por
  uma instância dedicada (na própria infra com replicação, ou um Neon/Supabase
  externo). Só mexer no `DATABASE_URL`.
- **Alta disponibilidade** → ter duas VMs com keepalived/load balancer.
- **Múltiplas unidades remotas acessando** → expor via VPN (Wireguard) ou
  proxy reverso público.

Nada do código precisa mudar — só a infra.
