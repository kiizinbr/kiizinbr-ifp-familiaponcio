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

## ⏳ Pendências imediatas

- [ ] **Validação visual humana** das telas novas (Erick estava começando quando paramos).
- [ ] Tela da gestora para CRIAR comunicado (API pronta: `POST /educacional/comunicados`; falta UI).
- [ ] UI de cadastro/revogação de autorizados e autorização de imagem (API pronta; gestora usa Swagger por ora).
- [ ] Tarefa de logon do keep-alive do WSL na workstation (classifier bloqueou; criar manualmente).
- [ ] Decidir reconciliação com a `main` (314 commits divergentes — ver DOSSIE; estratégia A = main como base).

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
