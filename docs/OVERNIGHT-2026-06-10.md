# Diário de bordo — turno autônomo (madrugada de 2026-06-10)

> Erick foi dormir e autorizou seguir com o projeto de forma automática,
> "sempre anotando e deixando claro o que foi feito". Este arquivo é o registro.
> Regras do turno: commits locais (SEM push), nada de produção, cada etapa verificada
> antes da próxima. Plano-mãe: `PLANO-UNIR-CONNECT.md` · ordem aprovada:
> Médico ✅ → **Capacitação** → Educacional.

## Plano do turno

| # | Etapa | Status | Verificação |
|---|---|---|---|
| 1 | Blueprints F3 (Capacitação/Educacional) reconciliados com a pesquisa SaaS da diretoria | ✅ | docs gravados + commit |
| 2 | Capacitação: schema Prisma (Curso/Turma/Matricula/Aula/Presenca/Certificado) + migration | ⏳ | `prisma validate` + tabelas no Postgres |
| 3 | Capacitação: seed dev (instrutor, curso Barbeiro, turma BB-2026-1, 3 alunos, aulas) | ⏳ | seed roda verde + dados no banco |
| 4 | Capacitação: módulo API (turmas, chamada com selo, certificados + verificação pública) | ⏳ | typecheck + smoke E2E via curl |
| 5 | Capacitação: UI (tema laranja, turmas → chamada mobile-first → certificados) | ⏳ | typecheck + rotas compilando |
| 6 | Atualizar memória + este diário com o resultado final | ⏳ | — |

## Registro do que foi feito

_(preenchido conforme as etapas fecham)_

- **00:4x** — Diário criado; etapa 1 (reconciliação) já estava em andamento desde antes;
  disparada a etapa 2-3 (schema + seed) em agente paralelo.
- **Etapa 1 ✅** — `BLUEPRINT-CAPACITACAO-FASE3.md` e `BLUEPRINT-EDUCACIONAL-FASE3.md` gravados.
  Destaques da reconciliação com a pesquisa da diretoria:
  - Capacitação: presença mínima 75→**80%** (CapacitaSUAS); chamada **mobile-first** no celular
    do instrutor; trilha de progresso da turma ("aula X de Y"); certificado com **QR + share
    WhatsApp** no MVP; consentimento de menor 14-17 vira coluna própria.
  - Educacional: booleans de foto viraram modelo transversal **`AutorizacaoImagem`**
    (escopos, revogável, default NEGADO — reutilizável pelo Esportivo); mensagem 1:1
    família↔instituto promovida a item nº 1 da Fase 2; portal da família em 3 telas.
  - Corrigida a premissa errada do workflow (módulo médico existe e virou seção "Gabarito"
    nos dois docs); perfis corrigidos pro RBAC real (GESTOR_UNIDADE/PROFISSIONAL/RESPONSAVEL_FAMILIAR).
  - Recomendação mantida e reforçada: **Capacitação primeiro**.
