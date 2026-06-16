# Onde paramos — Fase A IFP (handoff)

> Fim da sessão no **notebook** em 16/06/2026. Continuação no **servidor**.
> Branch: `feat/port-casa-design` (tudo pushed no GitHub). Plano completo: `docs/CONCLUIR-MEDICO-CAPACITACAO.md`.

## Estado atual
- **472 testes UNIT verdes** (ritual `format/typecheck/lint/test` passou). **E2E ainda NÃO rodado** nesta rodada.
- **Creche (Educacional):** Slices 1–3 FEITOS (schema+seed no banco dev, segurança check-in/out com os 4 bloqueios + teste de ouro, diário+selo). Slices 4–6 **PAUSADOS** por decisão (focar Médico+Capacitação primeiro). NÃO deployar — o "staging" do IFP é **produção real**.
- **Capacitação (Tier 1):** edição de turma FEITA (regra `podeEditarTurma` + `atualizarTurmaAction` + painel). Badge de evasão já existia. **Falta:** E2E dos fluxos reais (matricular→lista de espera→presença→certificado).
- **Médico (Tier 1):** busca de cidadão refatorada (combobox incremental) + "novo paciente" no wizard FEITOS. **Falta:** E2E do prontuário + transições; mobile do prontuário (3-col quebra no celular).

## Próximos passos (ordem)
1. ⚠️ **Rodar E2E primeiro** — `pnpm test:e2e`. CRÍTICO: o refactor do passo 1 do wizard médico (290 linhas) pode ter quebrado `tests/e2e/medico-agenda.spec.ts`. É onde isso apareceria.
2. **Médico:** mobile do prontuário (tabs/colapso em < 768px); depois E2E do prontuário fim-a-fim e das transições.
3. **Capacitação:** E2E dos fluxos reais.
4. **Plataforma (gate de prod, vale pros 2):** admin/users real, base LGPD (consentimento), deploy.

## Como retomar no servidor
```bash
# 1) atualizar o repo (a branch com tudo)
cd <repo IFP no servidor>        # ex.: C:\Users\Administrador\ifp-connect
git fetch origin && git checkout feat/port-casa-design && git pull --ff-only

# 2) subir o ambiente de dev (Postgres local) + gerar client
pnpm dev:up                       # docker compose (Postgres :5433)
pnpm prisma generate              # clone fresco precisa
# .env.local: DATABASE_URL com senha ifp_dev_pw (igual ao docker-compose.dev.yml)
pnpm db:migrate                   # aplica migrations (incl. add_educacional_creche) se faltar
pnpm db:seed                      # popula seed (creche-exemplo etc.)

# 3) validar e seguir
pnpm format:check && pnpm typecheck && pnpm lint && pnpm test   # deve dar 472 verdes
pnpm test:e2e                     # o passo 1 dos proximos passos
```
> Obs.: no servidor o pnpm pode rodar dentro do **WSL Ubuntu** (ver `CLAUDE.md` do repo). Se o ambiente de dev não estiver de pé lá, montar primeiro (Docker/Postgres) antes de rodar testes/E2E.

## Contexto
Memória/decisões compartilhadas vivem no cérebro `poncio-brain` (importado no `~/.claude/CLAUDE.md` do servidor). LEDGER de achados lá. Plano: `docs/CONCLUIR-MEDICO-CAPACITACAO.md`. ADR da fonte de verdade: `docs/adr/ADR-0001-fonte-de-verdade.md`.
