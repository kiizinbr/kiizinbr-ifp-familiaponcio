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
