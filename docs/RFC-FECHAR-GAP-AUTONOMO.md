# RFC — Fechar o gap do IFP Connect (execução autônoma / ralphinho pipeline)

> **Gerado em 2026-06-22 23:1x** para a esteira autônoma (skill `ralphinho-rfc-pipeline`).
> Fonte do escopo: `docs/COMPARATIVO-100.md`. Branch de trabalho/entrega:
> `claude/continue-projetoifp-section-10-RKC1n` (commit direto + push, com `git fetch`+rebase antes).

## Objetivo
Levar o sistema de **~48% → ~80-85%** construindo o **conjunto seguro** das telas que faltam:
áreas testáveis por regressão backend que **reusam o padrão CASA + API existentes**.

## Fora de escopo (NÃO automatizar — exigem humano/dados/infra)
Features de IA (triagem-ia, resumo-ia, histórias-ia, áudio), Site Público (design), telas
sem dados (custo/beneficiário, CRM doadores, mapa territorial, saúde populacional),
recuperar-senha (SMTP), e tudo de produção (rotação de segredos, cutover da `ifp-app`).

## Ambiente (provado em runtime, 2026-06-22)
- Postgres dev: `ifp-postgres` @ `127.0.0.1:5444` (healthy). API dist em `:3333` (health 200).
- Helper único: `…\scratchpad\ifp-ci.ps1` — subcomandos `restart | valida -Name <x> | migrate -Name <x> | seed | typecheck | health`.
- Aceite por unidade: `valida-<area>.mjs` (backend, **14/14 verde** no smoke `triagem`) + `typecheck` api+web + `lint`/`build`.
- ⚠ UI **não** é validada no browser (forward 5444 decai por idle na workstation) → telas saem "compila + padrão CASA + backend testado"; verificação visual fica pro servidor.

## Unidades (DAG — ordem baixo→alto risco; schema serializado)

| # | Unidade | Telas | Aceite (valida) | Schema? | Tier |
|---|---------|-------|-----------------|---------|------|
| U1 | Comum: perfil + busca global | comum-perfil, comum-busca | usuarios + typecheck | não | 1 |
| U2 | Esportivo: dashboards | esp-indicadores, esp-painel, esp-turmas | esportivo | não (agregação) | 2 |
| U3 | Educacional: indicadores + diário em lote | edu-indicadores, edu-diario-lote | educacional / gestao-educacional | leve | 2 |
| U4 | Capacitação: curso detalhe + matrículas | cap-curso, cap-matriculas | cursos / matriculas-certificados | SIM (ementa/módulos) | 3 |
| U5 | Família: recebido + certificados | familia-recebido, familia-certificados | familia (novo) | não (reusa) | 2 |
| U6 | Família: agenda + presença | familia-agenda, familia-presenca | familia (estende) | SIM (Evento, Presenca) | 3 |
| U7 | Médico F2: recepção + triagem enfermagem | medico-fila-chegada, medico-triagem-enfermagem, medico-triagem | medico-recepcao | SIM (vitais/risco) | 3 |
| U8 | Médico F2: atestado/PDF + odontograma | medico-atestado, medico-odonto | medico (estende) | SIM (odontograma) | 3 |
| U9 | Admin/governança LGPD | admin-auditoria (viewer), admin-unidades (CRUD), entrega-comunicados | admin (novo) + usuarios | leve | 3 |

## Quality pipeline por unidade
`research → plano → schema(migrate via helper) → API → web(CASA) → valida-*.mjs (escreve/estende) → typecheck → green? commit+fetch+rebase+push : evict+snapshot(.patch)+tree limpo`.

## Merge queue / recovery
- Unidades **sequenciais** (working tree + DB únicos). Nunca paraleliza build.
- `git fetch` + rebase em `origin/<branch>` antes de cada push (branch compartilhada avança no servidor).
- Unidade que não fica verde após esforço razoável: **não commita**; salva `.patch` em scratchpad, limpa a árvore, segue. Não bloqueia a fila.
- Migrations **aditivas**; reseed após cada migration (baseline). Reset bloqueado.

## Saídas
Scorecard por unidade (green/failed/partial) + commits + lista de pendências pro humano.

---

## ✅ RESULTADO (2026-06-23) — esteira concluída e VERIFICADA
9/9 unidades verdes e empurradas: commits `7f4e9dd`→`6ec878e` (+ `d496a29` = fix de typecheck do seed que o gate por-unidade não pegou). **Verificação cumulativa em runtime:** `pnpm typecheck` do repo inteiro VERDE + **13/13 scripts `valida-*` verdes** (usuarios 51 · esportivo 52 · cursos 34 · familia 40 · medico-recepcao 22 · medico-triagem 18 · medico-atestado 30 · medico-odonto 22 · admin 49 · + regressões triagem/tenant/prescrição/educacional). Estado da branch ao parar: `d496a29`, working tree limpo, em sincronia com a origin.

## ▶️ RETOMAR AQUI — "passo natural" (levar pra produção)
A entrega é **backend + compilação**; falta o que precisa de Linux/navegador. Ordem ao retomar:
1. **Pull da branch** `claude/continue-projetoifp-section-10-RKC1n` (`d496a29`) numa máquina Linux (ou no próprio servidor).
2. **`pnpm i && pnpm --filter @ifp/web build`** — deve completar o `output:standalone` (no Windows falhava só por EPERM de symlink; no Linux passa). Se falhar por outro motivo, é bug real a investigar.
3. **Smoke no NAVEGADOR** das telas novas (login por perfil) via Tailscale, idealmente já no ambiente do servidor — a UI nunca foi vista rodando (a workstation não sustenta sessão interativa).
4. **Deploy na `ifp-final`** seguindo a receita já provada (ver memória `ifp-vm-cutover-decision`): SSH `ifp@100.118.69.57` → `cd /opt/ifp-connect` → `pg_dump` backup (`~/ifp-backups/`) → `git checkout -- packages/database/schema.prisma` → `git pull --ff-only` → reaplica `binaryTargets` (`["native","debian-openssl-3.0.x"]`) → **`docker compose -f docker-compose.prod.yml -f docker-compose.tailscale.yml --env-file .env.production build api web migrate`** (⚠ INCLUIR `migrate` — senão a imagem migrate fica velha e diz "No pending") → `--profile tools run --rm migrate` (só `migrate deploy`, não seeda) → `up -d` → smoke HTTPS. **São 5 migrations novas** desta entrega (capacitacao_curso_ementa, familia_evento_presenca, medico_triagem_enfermagem, medico_odontograma, admin_auditlog_index_acao) — todas aditivas.

> Fora do escopo desta esteira (continua humano+IA supervisionado): features de IA, site público, telas sem dados, recuperar-senha (SMTP). Ver `COMPARATIVO-100.md`.
