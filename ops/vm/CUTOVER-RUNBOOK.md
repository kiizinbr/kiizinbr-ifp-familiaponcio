# Cutover Amplimed → Prod (VM IFP-APP) — RUNBOOK turnkey

**Status:** migração validada localmente; prod ainda NÃO tocado. Em HOLD aguardando OK do Erick
para o hardening (decidido 2026-06-07: hardening+backup primeiro · LGPD aceita/registrar na ROPA · ETL roda NA VM).

**Acesso:** `ssh -i C:\Users\Administrador\.ssh\ifp_app erickramos@192.168.1.162` · sudo passwordless (ainda) ·
prod stack `ifp-prod-{app,postgres,minio}-1` · URL pública `https://ifp-app.taile04c66.ts.net` · 220G livres.

**Já feito:** ✅ backup `.age` fresco (`/opt/ifp-connect/backups/ifp_connect-20260607-182908.sql.gz.age`).
**Pré-condição confirmada:** prod no schema ANTIGO (`20260606160550`); `MigracaoAmplimedMap` não existe; cpf/telefone/dataNascimento `NOT NULL` → o deploy é obrigatório antes do ETL.

> ⚠️ Cada bloco marcado **[CHECKPOINT]** é destrutivo/irreversível-ish — confirmar antes.

---

## 0. (no Windows) Regenerar o tarball do HEAD atual

```
git -C "C:\Users\Administrador\ifp-connect" archive --format=tar.gz -o "C:\Users\Administrador\ifp-cutover.tgz" HEAD
scp -i C:\Users\Administrador\.ssh\ifp_app C:\Users\Administrador\ifp-cutover.tgz erickramos@192.168.1.162:/tmp/
scp -i C:\Users\Administrador\.ssh\ifp_app C:\Users\Administrador\ifp-connect\ops\vm\_deploy-from-tarball.sh erickramos@192.168.1.162:/tmp/
```

## 1. Deploy do código + schema (build + migrate deploy)

```
ssh ... "sudo bash /tmp/_deploy-from-tarball.sh /tmp/ifp-cutover.tgz 2>&1 | tail -45"
```

Espera: `DEPLOY-OK` + os 3 serviços `ifp-prod-*` healthy. Aplica `20260607160940` (cria `MigracaoAmplimedMap` + relaxa campos).

## 2. [CHECKPOINT] Limpar demo + garantir schema (reset sem seed)

> Wipe da base demo (14 users/15 cidadãos/1 consulta) → base limpa com schema atual. Backup do §"já feito" cobre.

```
ssh ... "cd /opt/ifp-connect/ops/vm && sudo docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm migrate sh -c 'pnpm prisma migrate reset --force --skip-seed' 2>&1 | tail -20"
ssh ... "cd /opt/ifp-connect/ops/vm && sudo docker compose -f docker-compose.prod.yml --env-file .env.prod up -d app"
```

Conferir vazio: rodar `ops/vm/_inspect-prod-db.sh` (scp + bash) → contagens 0 + `tem_migracao_map = t` + cpf nullable.

## 3. [CHECKPOINT] Escopar sudo (hardening — risco de lock-out)

Seguir `ops/vm/harden-sudo.md` (docker-group + visudo: escreve em /tmp → `visudo -cf` valida → instala só se ok →
TESTAR sessão NOVA antes de fechar a atual). Resgate: console Hyper-V.

## 4. Transferir fonte (32GB) + restaurar MariaDB descartável NA VM

```
scp -i ...ssh\ifp_app "C:\Dev\ifp-connect\backup-amplimed\6a22ea018b938404430e2312_tables_2026_06_06_03_30_08.zip" erickramos@192.168.1.162:/tmp/amplimed/   # tables (91MB)
# mídia (30GB) — em background, demora:
scp -r -i ... "C:\Dev\ifp-connect\backup-amplimed\amplimed*media*.zip" erickramos@192.168.1.162:/tmp/amplimed/
ssh ... "bash /opt/ifp-connect/scripts/migracao-amplimed/00-restore-mariadb.sh /tmp/amplimed/6a22...tables...zip"
```

(`00-restore` extrai com python3 e sobe o container `amplimed-src` na porta 3399.)

## 5. [CHECKPOINT] ETL em prod (rodar DENTRO da VM, via container migrate)

Rodar a migração com o container `migrate` (tem pnpm+deps+código), apontando p/ o `amplimed-src` e os ZIPs por env:

```
# garantir amplimed-src na mesma rede do compose; rodar:
ssh ... "cd /opt/ifp-connect/ops/vm && sudo docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm \
  -e MIGRACAO_MARIADB_HOST=amplimed-src -e MIGRACAO_MARIADB_PORT=3306 \
  -e MIGRACAO_ZIPDIR=/zips -v /tmp/amplimed:/zips --network ifp-prod_default \
  migrate sh -c 'pnpm migracao:run --commit && pnpm migracao:midia --commit && pnpm migracao:validar' 2>&1 | tail -40"
```

> ⚠️ Ajustar nome da rede (`docker network ls | grep ifp-prod`) e garantir que o serviço `migrate` herda `DATABASE_URL`/`MINIO_*` do `.env.prod` (aponta pro postgres/minio de prod). `migracao:*` já existem no package.json. Idempotente/resumable — se cair, re-rodar.
> Espera (validar): cidadãos 18.911 · consultas 94.424 · notas 94.424 (== consultas) · fotos 7.175 · anexos 10.351.

## 6. Spot-check + flip do banner + cleanup

```
# browser: https://ifp-app.taile04c66.ts.net → login → Fila/Prontuário/Busca de pacientes reais + fotos
ssh ... "sed -i 's/^STAGING_BANNER=1/STAGING_BANNER=0/' /opt/ifp-connect/ops/vm/.env.prod && cd /opt/ifp-connect/ops/vm && sudo docker compose -f docker-compose.prod.yml --env-file .env.prod up -d app"   # remove banner
ssh ... "docker rm -f amplimed-src; rm -rf /tmp/amplimed /tmp/ifp-cutover.tgz"   # PHI temp + fonte fora
```

## 7. ROPA + segredos

- Atualizar `docs/seguranca/2026-06-06-ropa.md`: operação de migração Amplimed concluída + data + volume (18.911 titulares) + base legal (tutela de saúde) + retenção (prontuário ~20a).
- DPO formal = follow-up (Erick aceitou a postura agora).

## Rollback

Migration é DDL segura (NOT NULL→NULL + add table) — sem perda. Se o reset/ETL der errado: restaurar o `.age`
(`age -d` com a chave da VM → `psql` no volume) OU `migrate reset` + re-deploy. Backup em `/opt/ifp-connect/backups/`.
