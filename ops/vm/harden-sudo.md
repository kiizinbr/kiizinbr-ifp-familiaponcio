# Hardening do sudo — reduzir `NOPASSWD:ALL`

**Hoje:** `erickramos ALL=(ALL) NOPASSWD:ALL` — qualquer comando sem senha. Comprometer o usuário = root. Objetivo: docker sem sudo (pro deploy/backup) e o resto pedindo senha.

> ⚠️ Risco de **trancar o sudo** se editar errado. Sempre use `visudo` (valida antes de salvar) e mantenha um **2º terminal aberto** durante o teste. O console Hyper-V tem root se algo travar.

## Procedimento (RODE NA VM)

```bash
# 1) docker sem sudo (deploy/backup deixam de precisar de sudo)
sudo usermod -aG docker erickramos
#    saia e entre de novo (nova sessao SSH) pra valer o grupo; teste:
docker ps

# 2) backup passa a usar docker sem sudo
sed -i 's/sudo docker/docker/' /opt/ifp-connect/ops/vm/backup.sh

# 3) escopar o sudo (visudo valida a sintaxe antes de salvar)
sudo visudo -f /etc/sudoers.d/erickramos
#    troque a linha unica por estas duas:
#      erickramos ALL=(ALL) NOPASSWD: /usr/bin/tailscale, /usr/sbin/ufw
#      erickramos ALL=(ALL) ALL
#    (tailscale/ufw sem senha pra automacao; o resto pede senha)
```

## Depois (importante)

- O **deploy** (`ops/vm/deploy.sh` e o update via tarball) usa `sudo docker compose`. Após o passo 1, troque `sudo docker` por `docker` nesses scripts (já no grupo docker) — senão o deploy passa a pedir senha.
- Confirme num 2º terminal: `sudo -l` mostra só o escopo esperado, e `docker ps` funciona sem sudo. Só então feche o terminal antigo.
