# ONDE PARAMOS — handoff do sprint (atualizado 2026-06-11)

> **Para a IA que retomar este projeto (em qualquer máquina): leia este arquivo primeiro.**
> Branch de trabalho: `claude/continue-projetoifp-section-10-RKC1n` (skin CASA + verticais).
> Contexto maior: `docs/PLANO-UNIR-CONNECT.md` · blueprints em `docs/BLUEPRINT-*.md` ·
> reconciliação com a `main` em `docs/DOSSIE-RECONCILIACAO-MAIN-X-CASA.md`.

## ✅ O que está PRONTO e VALIDADO (sprint de 10–11/06/2026)

**3 verticais funcionando de ponta a ponta** (API + telas + seed), validadas contra o
app real rodando:

1. **Médico** (Fase 1, entregue antes do sprint): agenda + prancha SOAP 5 passos.
2. **Capacitação** (Fase 3): turmas, matrícula com lock de vagas, chamada selada,
   certificado com QR público.
3. **Educacional/Creche** (Fase 3, NOVA — construída neste sprint): turmas infantis,
   matrícula com consentimento Art. 14 + autorização de imagem granular (default
   negado), check-in/out validando autorizado (revogado/vencido/restrição judicial =
   403 COM auditoria da tentativa), diário do dia com selo, portal da família
   (ownership por `User.fichaCidadaId`, 3 telas), comunicados com confirmação de leitura.

**Segurança — checklist de 23 achados do review adversarial: TODOS tratados**
(`docs/CHECKLIST-SEGURANCA-RECONCILIACAO.md`): parede de tenant por `TipoUnidade`
em `ProfissionaisService.resolverPorUser` (21 call-sites), minimização LGPD nos
selects, audit READ em toda leitura sensível, races eliminados com
transação+`FOR UPDATE`+`updateMany` condicional, timezone America/Sao_Paulo fixo,
`StatusMatricula.CANCELADA` para lista de espera no encerramento.

**Validação em runtime (scripts reutilizáveis — rodar como regressão):**
```bash
SENHA_DEV=$(grep SEED_MEDICO_PASSWORD .env | cut -d= -f2 | tr -d '"') node scripts/valida-tenant.mjs       # 7/7
SENHA_DEV=... node scripts/valida-educacional.mjs                                                          # 23/23
```

Commits do sprint (nesta ordem): `87bd58e` parede de tenant · `4606355` minimização/
timezone médico · `55fffad` races+locks capacitação · `83ae1bf` schema+seed educacional ·
`9529272` API educacional · `c499dc2` telas educacional+família.

## 🚀 Como subir o ambiente (qualquer máquina)

```bash
docker compose up -d        # Postgres 16 + Redis 7
pnpm db:migrate && pnpm db:seed   # precisa de DATABASE_URL + SEED_* no ambiente (ver .env.example)
pnpm dev                    # web :3000 + api :3333
```

Logins de teste: ver `SEED_*` no `.env` (educadora@ifp.local, familia@ifp.local,
medico@ifp.local, instrutor@ifp.local, admin@ifp.local — senha = `SEED_MEDICO_PASSWORD`,
admin usa `SEED_SUPER_ADMIN_PASSWORD`).

### ⚠ Pegadinhas de ambiente descobertas a tapa (Windows + Docker no WSL2)

O Docker Desktop foi APOSENTADO na workstation (crashes crônicos de sockets); o engine
é **docker-ce dentro do WSL2 Ubuntu-24.04** (receita completa na memória do
agente-clean-local: `_nucleo/memoria/docker-wsl2-engine.md`). Consequências para ESTE repo:

1. `C:\Users\<user>\.wslconfig` → `networkingMode=mirrored` (localhost nos 2 sentidos).
2. A bridge do Docker NÃO espelha → `docker-compose.override.yml` local (gitignored)
   põe postgres/redis em `network_mode: host`.
3. **WSL desliga a VM sem sessão ativa** → manter `wsl -d Ubuntu-24.04 --exec sleep infinity`
   vivo (tarefa de logon pendente de criação).
4. `localhost` em connection string resolve IPv6 e falha → usar `127.0.0.1`
   (DATABASE_URL, API_URL, NEXT_PUBLIC_API_URL).
5. **O Next NÃO lê o `.env` da raiz do monorepo** → `apps/web/.env.local` (gitignored)
   precisa de `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `API_URL`, `NEXT_PUBLIC_API_URL`.
   Sem isso o login "funciona" e volta pro /login sem erro (JWEDecryptionFailed no
   getServerSession — NO_SECRET no log).
6. CORS: `WEB_ORIGIN` aceita lista → `"http://localhost:3000,http://127.0.0.1:3000"`.

### ⚠ Receita do servidor CL-SRV-DC01 (retomada de 2026-06-11)

Difere da workstation — aqui o app roda no **Windows nativo** (Node 24 + pnpm 9.12.3)
e só os bancos vivem no docker-ce do WSL (distro chama-se `Ubuntu`, não `Ubuntu-24.04`;
modo espelhado não é suportado no build 20348 → NAT relay):

1. Worktree do sprint: `~/.config/superpowers/worktrees/ifp-connect/casa-sprint`
   (o checkout principal `~/ifp-connect` fica na `main`, que tem WIP próprio).
2. **Porta 5432 do Windows é de OUTRO Postgres nativo** e **3333 é do IIS (HTTP.sys)**:
   o Nest sobe, mapeia rotas e morre no bind sem erro visível no turbo. Solução:
   `docker-compose.override.yml` (gitignored) adiciona mapeamento extra `5434:5432`
   no postgres; `.env` usa `127.0.0.1:5434` e `PORT=3334` (+ `API_URL`/
   `NEXT_PUBLIC_API_URL` em 3334 nos DOIS arquivos de env).
3. Redis não precisa de porta no Windows (dev não usa `REDIS_URL`; a 6379 local é de outro serviço).
4. Containers: `ifp-postgres`/`ifp-redis` (compose do repo) — NÃO confundir com
   `ifp_postgres_dev`:5433/`ifp_minio_dev`, que são do app da `main`.
5. Prisma não lê o `.env` da raiz → exportar antes: `set -a; source .env; set +a`
   e então `pnpm db:migrate && pnpm db:seed`.
6. Regressão (com API em 3334): `API_URL_TESTE=http://127.0.0.1:3334/api/v1 SENHA_DEV=... node scripts/valida-tenant.mjs` (e `valida-educacional.mjs`).
7. Keep-alive do WSL: mesmo problema da workstation (`wsl -d Ubuntu --exec sleep infinity`);
   tarefa de logon ainda pendente também aqui.

## ⏳ Pendências imediatas

- [x] ~~Tela da gestora para CRIAR comunicado~~ → `/educacional/comunicados` (lista com nº
  de leituras + publicação geral/por turma; sprint 11/06 no servidor).
- [x] ~~UI de autorizados e autorização de imagem~~ → na ficha da criança (cadastro,
  revogação em 2 passos, toggle por escopo de imagem).
- [x] ~~Gestora no seed~~ → `gestora@ifp.local` (GESTOR_UNIDADE + Profissional ativo;
  descoberta: `resolverPorUser` exige lotação mesmo p/ gestão — sem esse user
  NINGUÉM publicava comunicado, nem via Swagger).
- [x] ~~Tema por unidade não aplicava~~ → bug de CSS vars: `--color-primary` resolvia no
  `:root`; fix re-resolve aliases em `[data-theme]` (afetava TODAS as unidades).
- [x] Validação visual das telas de gestão feita via Playwright no sprint de 11/06
  (login gestora → publicar → ficha → toggles). Telas do educador/família da F3
  seguem aguardando olhada do Erick quando quiser.
- [ ] Tarefa de logon do keep-alive do WSL (workstation E servidor; classifier bloqueou; criar manualmente).
- [ ] Decidir reconciliação com a `main` (314 commits divergentes — ver DOSSIE; estratégia A = main como base).

Regressão nova além das duas existentes:
```bash
SENHA_DEV=... node scripts/valida-gestao-educacional.mjs   # 18/18 (gestão: comunicados/autorizados/imagem + RBAC)
SENHA_DEV=... node scripts/valida-esportivo.mjs            # 23/23 (trio Esporte: vagas/espera/graduação/verificação pública)
```
O seed agora limpa o estado DO DIA do educacional — a suíte inteira é
re-rodável: `pnpm db:seed` e depois os 4 scripts, sempre verdes.

## 🥋 Vertical Esporte (4ª vertical — API entregue 11/06, telas pendentes)

Trio `Modalidade/TurmaEsportiva/Graduacao` no molde da Capacitação: mesma
parede de tenant (ESPORTIVO), regra de ouro, lock `FOR UPDATE` na matrícula
(vagas/lista de espera) e encerramento idempotente. Graduação = molde do
certificado (código de verificação público em `GET /esportivo/graduacoes/verificar/:codigo`),
com `nivel` validado contra `Modalidade.trilhaGraduacoes` e `@@unique` por
matrícula+nível. Seed: `esporte@ifp.local` (Sensei Ricardo) + Judô (6 faixas)
+ Futsal + 2 fichas aprovadas.

**Telas entregues (11/06 à noite)**: `/esportivo` (painel KPIs + turmas + nova
turma), `/esportivo/turmas/[id]` (matrícula por busca elegível, graduação pela
trilha com select filtrado, encerramento) e `/verificar-graduacao/[codigo]`
(pública). O hub da home agora lista TODAS as áreas (Educacional/Esportivo/
Família faltavam — era a causa do "Acesso restrito" ao navegar).

**Treinos entregues (11/06 à noite) — VERTICAL COMPLETA**: `TreinoEsportivo` +
`PresencaTreino` (molde Aula/Presenca), chamada em lote idempotente, selo
imutável (lock + updateMany condicional), tela de chamada mobile-first P/F/J.
Regressão da vertical: 29/29. Próximo do blueprint: **mensagem 1:1
família↔instituto** (killer feature; interino = WhatsApp Business oficial).

## 🔭 Próximas fases (ordem do blueprint Educacional §8 + Capacitação)

1. **Mensagem 1:1 família↔instituto** (killer feature ClassApp; interino = WhatsApp Business oficial).
2. Fotos no diário (exige checagem de `AutorizacaoImagem` + watermark).
3. Esporte (Modalidade/TurmaEsportiva/Graduação — molde = trio da Capacitação).
4. Banco de Modelos da Capacitação (reusa `AutorizacaoImagem`).
5. Áudio no portal família (literacia baixa — Famly).

## 🗺️ Mapa rápido do código

- API NestJS: `apps/api/src/{medico,capacitacao,educacional}/` — gabarito de módulo:
  guards `JwtAuthGuard+PerfisGuard`, tenant via `resolverPorUser(user, TipoUnidade.X)`,
  `AuditService.registrar` fire-and-forget, selos com `updateMany` condicional.
- Web Next 14 (app router): `apps/web/app/{medico,capacitacao,educacional,familia}/` —
  layout com `getServerSession` + `PERFIS_PERMITIDOS` + `data-theme`.
- Hooks react-query: `apps/web/lib/use-*.ts` · tema/tokens: `packages/design-tokens/tokens.css`.
- Schema: `packages/database/schema.prisma` · seed: `packages/database/prisma/seed.ts`.
