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
