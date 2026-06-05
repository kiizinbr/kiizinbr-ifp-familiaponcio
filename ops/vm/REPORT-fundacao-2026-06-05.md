# Relatório — Fundação de produção (madrugada 2026-06-05)

Trabalho autônomo na **fundação** (você escolheu "sem ralph"). Disciplina num servidor **público de prod sem isolamento**: executei só o **reversível + verificável**; o que tem risco de te trancar fora ficou **pronto pra 1 clique**. **Não fiz deploy autônomo** nem mexi em rede/sudo sozinho.

---

## ✅ Executado e VERIFICADO

### 1. Disco liberado
`docker system prune` (cache de build + imagens órfãs; **não tocou o volume do banco**). **83% → 69%** (recuperei 2.7 GB).

### 2. Backup do banco (F0) — no ar e testado
- Script: `ops/vm/backup.sh` (na VM em `/opt/ifp-connect/ops/vm/backup.sh`). `pg_dump` comprimido + rotação de 7 dias.
- **Cron diário às 03:30** instalado (`crontab -l` confirma).
- **Evidência do teste:** rodei 1x → `ifp_connect-20260605-111116.sql.gz` (18 KB), **gzip válido**, **104 statements CREATE** (banco real, não vazio).
- **Como desfazer:** `crontab -r` (remove o cron) + `rm /opt/ifp-connect/ops/vm/backup.sh`.

### 3. Security headers (código)
`next.config.ts` ganhou `headers()` com **HSTS, X-Frame-Options=SAMEORIGIN, X-Content-Type-Options=nosniff, Referrer-Policy, Permissions-Policy**. Gates **verdes** (format/types/lint/build). Commit **`f62dd37`** (pushado). ⚠️ **Só valem após o próximo deploy** (ver §pronto-pra-1-clique).

### 4. Revisão LGPD leve (doc)
`docs/seguranca/2026-06-05-lgpd-revisao-leve.md`. Resumo: **arquitetura num bom ponto** (superfície pública mínima, RBAC com unit-scope, API de anexos com auth+presigned+soft-delete, auditoria, TLS). Gaps são **operacionais** (cripto de backup, firewall, sudo, repouso) e **de processo** (base legal, consentimento, retenção, DPO) — nenhum bloqueia o demo; todos antes de **dado real**.

---

## 🟡 PRONTO PRA 1 CLIQUE (você aplica — toca prod/rede/sudo)

1. **Firewall** — na VM: `bash /opt/ifp-connect/ops/vm/harden-firewall.sh` (libera SSH **antes** de ativar; seguro). *Precisa do arquivo na VM — entra no próximo deploy, ou copio na hora.*
2. **Escopar o sudo** — procedimento com `visudo` em `ops/vm/harden-sudo.md` (docker sem sudo + sudo com senha pro resto). Faça com 2º terminal aberto.
3. **Cópia off-VM do backup** — `ops/vm/pull-ifp-backup.ps1` no host + agendar (`schtasks`, comando no topo do script). Puxa o dump da VM pro host (`C:\Backups\ifp`) — foi sua escolha "VM + host".
4. **Deploy** (pra os headers §3 + qualquer commit valerem em produção):
   ```powershell
   # no host:
   git -C C:\Users\Administrador\ifp-connect archive --format=tar.gz -o C:\Users\Administrador\ifp-deploy.tgz HEAD
   scp -i C:\Users\Administrador\.ssh\ifp_app C:\Users\Administrador\ifp-deploy.tgz erickramos@192.168.1.162:/tmp/ifp-deploy.tgz
   ssh -i C:\Users\Administrador\.ssh\ifp_app erickramos@192.168.1.162 'tar -xzf /tmp/ifp-deploy.tgz -C /opt/ifp-connect && cd /opt/ifp-connect/ops/vm && sudo docker compose -f docker-compose.prod.yml --env-file .env.prod build && sudo docker compose -f docker-compose.prod.yml --env-file .env.prod up -d app'
   ```
   *(Eu posso fazer isso com você acordado — deploy não é autônomo.)*

---

## ⏸️ Tentado e revertido
Nada revertido. (Pequeno tropeço de quoting ao setar o cron — corrigido via arquivo + `crontab <arquivo>`; estado final correto.)

---

## 📋 Pendências / próximos (ranqueado)
1. **Aplicar os 🟡 acima** (firewall + sudo + host-pull + deploy dos headers).
2. **CSP** — adicionar Content-Security-Policy (alto valor), mas precisa **teste página-a-página** (fontes Google + imagens Wix do site) — não fiz sozinho. Fazemos juntos.
3. **Cripto do backup** (dump tem dado sensível) — cifrar (`age`/`gpg`) antes de dado real.
4. **Trocar fotos do site** (você traz hoje) + otimizar (~2-3MB cada) + fotos externas Wix → locais.
5. **Base legal LGPD + consentimento + retenção + DPO** (processo do instituto).
6. **Features deferidas** (Prescrição/Atestado, etc.) — quando a gente planejar, viram ralph.

## Commits desta sessão
`06de4d8` site no `/` · `b17d206` leão sob reduced-motion · `f62dd37` backup + headers · (+ este report/docs no próximo commit).

## Notas
- Dev server local está **parado** (parei pro build). Pra retomar: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm dev"`. O que importa (URL pública) segue no ar.
- Gotcha confirmada: dev no WSL não vê edição compilada em `/mnt/c` (inotify) → reiniciar `pnpm dev`; verify/build via `wsl ... bash /mnt/c/.../x.sh` **pelo PowerShell**.
