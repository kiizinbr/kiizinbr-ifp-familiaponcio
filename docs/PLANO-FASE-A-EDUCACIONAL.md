# Plano Fase A — Portar a vertical Educacional/Infantil (`main` → `study`)

> Pré-requisito da deprecação do `main` (ver `docs/adr/ADR-0001-fonte-de-verdade.md`).
> **Princípio:** portar a creche **preservando comportamento**, com foco nos pontos de
> **segurança infantil e LGPD**, adaptando às convenções do `study` (Server Actions, `src/lib`,
> Zod, `logEvent`, vitest + Playwright). **Não é um clone da Capacitação** — o domínio é mais rico.
> Recomendado executar cada fatia como `ecc:orch-add-feature` (TDD) + `ecc:security-review` (menores/LGPD).

---

## 0. Mapeamento de primitivos (VERIFICAR antes de codar — maior risco)

A creche do `main` depende de primitivos que o `study` **pode ou não** ter. Confirmar cada um:

| Conceito no `main`                                              | Equivalente no `study`                                      | Status (Slice 0 — verificado 16/06)                                                                                                                                   |
| --------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FichaCidada` (responsável legal)                               | **`Cidadao`** (`schema.prisma:195`)                         | ✅ existe                                                                                                                                                             |
| `MembroFamiliar` (a criança)                                    | **`Familiar`** (`:179`) + `Familia` (`:167`)                | ✅ existe (nome diferente)                                                                                                                                            |
| `Profissional` (educador)                                       | **`Profissional`** (`:494`)                                 | ✅ existe                                                                                                                                                             |
| `ElegibilidadePorUnidade` (gate APROVADO)                       | **`ElegibilidadeUnidade`** (`:399`) + `StatusElegibilidade` | ✅ existe                                                                                                                                                             |
| `AuditLog` / auditoria                                          | **`AuditLog`** (`:136`) + `src/lib/audit.ts`                | ✅ existe                                                                                                                                                             |
| escopo de unidade                                               | `UNIT_SCOPES` (`src/lib/rbac-types.ts:18`)                  | ➕ **adicionar `"educacional"`** (hoje: medico/capacitacao/esportivo/recreativo) + atualizar comentário de `User.primaryUnitScope`                                    |
| `User.fichaCidadaId` (elo login→família, p/ **portal família**) | **não encontrado** no schema                                | ⚠️ **ÚNICO pré-trabalho real** — confirmar/criar o elo `User`↔`Familia/Cidadao`. Afeta só o **Slice 6** (portal família); as fatias de equipe (1–5) não dependem dele |

> **Resultado do Slice 0 (gate): VERDE.** Os primitivos da creche **já existem** no `study` (`Familiar`, `Profissional`, `ElegibilidadeUnidade`, `Cidadao`, `AuditLog`) — a Fase A é majoritariamente **port**, não recriação. Pré-trabalho real = (a) adicionar o scope `"educacional"` (1 linha) e (b) confirmar/criar o elo login→família (só p/ Slice 6). **As fatias 1–5 podem começar já.**
> Adaptação de nomes ao portar: `MembroFamiliar`→`Familiar`, `FichaCidada`→`Cidadao`, `ElegibilidadePorUnidade`→`ElegibilidadeUnidade`.

---

## 1. Schema Prisma — portar os modelos REAIS da creche

Adicionar ao `prisma/schema.prisma` (convenções do study: `cuid()`, `createdAt/updatedAt`, relações por id, enums inline). **Preservar invariantes** (fonte: `main` `packages/database/schema.prisma:761–922`):

- **`TurmaInfantil`** — `faixaEtariaMin/Max` (meses; min ≤ max), `capacidade`, educador (FK), `ativa`. Capacidade **nunca estoura** (lock no matricular).
- **`MatriculaInfantil`** — turma + responsável(ficha) + **criança(membro, sempre preenchido)** + `consentimentoLgpdEm` (**obrigatório**), `ativa`. `@@unique([turmaId, membroId])`.
- **`ResponsavelAutorizado`** — **por criança**: `nome, documento, parentesco, fotoUrl, restricaoJudicial, vigenteAte, revogadoEm, revogadoPor`. **NUNCA deletar** (trilha de guarda).
- **`CheckInOut`** — `membro, sentido(ENTRADA|SAIDA), ocorridoEm, autorizadoId, profissionalId`.
- **`DiarioDia`** — `membro, data, status(ABERTO|FECHADO), fechadoEm, profissional`. `@@unique([membroId, data])`. FECHADO = imutável + visível à família.
- **`RegistroRotina`** — `diario, tipo(ALIMENTACAO|SONO|HIGIENE|ATIVIDADE|OCORRENCIA), descricao, ocorridoEm, profissional`.
- **`AutorizacaoImagem`** — `membro, escopo(USO_INTERNO|REDES_IFP|IMPRENSA), concedido, versaoTermo, revogadoEm, revogadoPor`. `@@unique([membroId, escopo, versaoTermo])`. **Default = NEGADO**.
- **`Comunicado` + `ComunicadoLeitura`** — `turmaId?` (null=geral), `critico`, `enviadoPor`; leitura `@@unique([comunicadoId, fichaId])`.
- **Enums:** `StatusDiario, TipoRegistroRotina, SentidoCheck, EscopoImagem`.

Migration: `pnpm db:migrate --name add_educacional_creche`. Recriar como schema Prisma (não SQL bruto).

---

## 2. Camada `src/lib/educacional/` — preservar a lógica (o que importa)

- **`autorizado.ts` → `validarAutorizado(membroId, autorizadoId, sentido)`** — **o bloqueio central** (fonte `rotina.service.ts:44–81`). Ordem de bloqueio, cada um → erro + **auditoria da tentativa**:
  1. não existe → "não está na lista";
  2. `restricaoJudicial` → "restrição judicial vigente";
  3. `revogadoEm != null` → "autorização revogada";
  4. `vigenteAte < agora` → "autorização vencida".
     > Tentativa bloqueada **sempre** gera `logEvent(entityType: "CheckInOut.tentativaBloqueada", meta:{membroId, sentido, motivo})` — evidência para disputa de guarda. **Intransponível, mesmo logado.**
- **`rotina.ts`** — `checkin`/`checkout` (estado-do-dia: duplo check-in → 409; check-out sem entrada → 409); `registrarRotina` (upsert do diário + `FOR UPDATE`; se `FECHADO` → 409); `fecharDiario` (exige ≥1 registro; `updateMany ... WHERE status=ABERTO` com `count===1` para idempotência).
- **`matricula.ts`** — `matricular` em transação: consentimento LGPD obrigatório → elegibilidade APROVADO → criança da família → **capacidade com `FOR UPDATE`** → não-duplicada; + upsert das autorizações de imagem por escopo.
- **`familia.ts`** — portal: `resolverFichaId(user)` (**ownership via `User.fichaCidadaId`; NUNCA aceitar fichaId do cliente**); `diario` filtra `status = FECHADO` (ABERTO invisível à família); `confirmarLeitura` (upsert idempotente).
- **`rbac.ts`** — predicados `podeGerenciarTurma / podeMatricular / podeRegistrarCheck / podeRegistrarRotina / podeFecharDiario` via `hasAnyRole(...)`; gate de rota `canAccessUnidade(session, "educacional")`.
- **`schema.ts`** — Zod dos inputs (matricular exige `consentimentoLgpd:true` + `autorizacoesImagem`).

---

## 3. Server Actions + rotas (`src/app/educacional/` e `src/app/familia/educacional/`)

Fluxo padrão study (fonte: `src/app/capacitacao/actions.ts`): `auth()` → `canAccessUnidade("educacional")` → capability → Zod → `db.$transaction` → `logEvent()` → `revalidatePath`/`redirect`.

Páginas equipe: **painel** (KPIs: presentesAgora, diáriosAbertos/Fechados, críticosSemLeitura), **turma/[id]** (estado do dia + check-in/out + tags de rotina + fechar), **criancas/[membroId]** (perfil: alergias, autorizados, autorizações de imagem, últimos checks).
Portal família: minhas-crianças, diário (só FECHADO), ficha, comunicados + confirmar leitura.

---

## 4. Testes (TDD — escrever ANTES, segurança primeiro)

**Unit (vitest, lógica pura):**

- `validarAutorizado`: os **4 bloqueios** (inexistente / restrição / revogado / vencido).
- estado-do-dia: duplo check-in → erro; check-out sem entrada → erro.
- diário FECHADO → registro novo bloqueado; fechar exige ≥1 registro; idempotência do fechar.
- matrícula: consentimento LGPD obrigatório; capacidade não estoura; autorização de imagem default-NEGADO.
- família: ownership (não acessa ficha de outro).

**E2E (Playwright, portar `scripts/valida-educacional.mjs`):**

- **teste de ouro:** check-out com responsável **revogado** → 403.
- selo: registro após fechar → 409; família vê diário só quando FECHADO.
- RBAC cruzado: médico não acessa `/educacional`; família não acessa rotas de equipe.

---

## 5. Ordem de execução (fatias verticais, cada uma um `orch-add-feature`)

| Fatia                                | Entrega                                                                                                                                    | Gate                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| **0 — Pré-requisitos**               | resolver o mapeamento da §0 (MembroFamiliar, educador, elegibilidade, `User.fichaCidadaId`, scope `"educacional"`)                         | **bloqueia tudo**      |
| **1 — Schema + seed**                | modelos + migration + seed-exemplo (educadora, família Sandra+Ana, turma, autorizados incl. **revogado**, dia FECHADO, comunicado crítico) | migration aplica limpa |
| **2 — Autorizado + check-in/out**    | o **coração de segurança** — testes de ouro primeiro                                                                                       | 4 bloqueios verdes     |
| **3 — Diário + rotina + selo**       | imutabilidade do FECHADO                                                                                                                   | testes de selo verdes  |
| **4 — Matrícula + LGPD + imagem**    | consentimento + autorizações                                                                                                               | testes LGPD verdes     |
| **5 — Painel + perfil (equipe)**     | frontend equipe                                                                                                                            | E2E painel/turma       |
| **6 — Portal família + comunicados** | ownership + leitura crítica                                                                                                                | E2E família + RBAC     |
| **7 — Fechamento**                   | `valida-educacional` portado + `code-review` + **`security-review`**                                                                       | tudo verde             |

---

## 6. Riscos & guardas

- **Dados de menores + LGPD** → `ecc:security-review` obrigatório no fim; nunca logar PII sensível em `meta`.
- Os **4 bloqueios de segurança física** são intransponíveis e cobertos por teste **antes** da implementação.
- Maior risco técnico = o **mapeamento da §0**; se o study não tiver `MembroFamiliar`/educador/elegibilidade/elo-ficha, são pré-trabalho real (Slice 0).
- **Dados vivos no BD do `main`?** Verificar antes de qualquer DELETE (Fase B do ADR) — turmas/matrículas/diários/checks/responsáveis/consentimentos.

---

_Fonte-comportamento: `main` `apps/api/src/educacional/{rotina,turmas-infantis,criancas,familia,comunicados}.service.ts`, `packages/database/prisma/seed.ts:459–773`, `scripts/valida-educacional.mjs`. Convenções-alvo: `study` `src/app/capacitacao/actions.ts`, `src/lib/capacitacao/_`, `tests/{unit,e2e}/_`._
