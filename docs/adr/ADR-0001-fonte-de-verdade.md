# ADR-0001 — Fonte de verdade do IFP Connect

- **Status:** Aceito — ratificado por Erick Ramos em 2026-06-16
- **Decisores:** Erick Ramos
- **Base da decisão:** tie-break `w8k61k8b5` (evidência executada) + checagem de paridade

## Contexto

O IFP Connect existia em **3 repositórios divergentes** do mesmo produto:

- `kiizinbr-ifp-familiaponcio` (**main**) — NestJS + Next.js (monorepo Turbo).
- `ifp-main-study` (**study**) — Next.js 16 monolítico (App Router) + Auth.js v5.
- `ifp-sistema` — scaffold Next.js vazio (0 commits).

Fragmentação crítica: ninguém sabia qual clonar; testes, design e dados não transitavam entre as bases.

## Decisão

**`ifp-main-study` é a fonte de verdade única do IFP Connect.** Todo trabalho novo acontece aqui; é a base que vai para produção.

## Evidência (não foi "achismo de commits")

| Critério                           | main                                    | study                                                             |
| ---------------------------------- | --------------------------------------- | ----------------------------------------------------------------- |
| Testes unit que **rodam verde**    | **0**                                   | **387**                                                           |
| Caminho de produção                | ❌ nenhum (showroom, FichaCidadã vazia) | ✅ migração **Amplimed real** (~113k cidadãos) + import de alunas |
| Motor de agenda (anti-overbooking) | 4/5 — sólido, **sem testes**            | 5/5 — core abstraído, **concorrência testada**                    |
| Migrations / RBAC                  | 5 / legado                              | 26 / moderno (Role/UserRole)                                      |

> E2E não foi validado em nenhuma das bases (Postgres fora do ar no ambiente de teste); a decisão se sustenta nos 387 unit verdes do study contra zero do main.

## Consequências

1. `ifp-main-study` recebe todo desenvolvimento novo e os planos de design (CASA) e de generalização da agenda.
2. **`main` NÃO pode ser deprecado ainda.** A checagem de paridade encontrou um gap **crítico**: a **vertical Educacional/Infantil (creche) é exclusiva do `main`** e está **ausente** no study — schema, backend, frontend, seed e E2E. Inclui features sensíveis: responsável autorizado (com restrição judicial), consentimento de imagem (LGPD Art. 14), diário de rotina, check-in/out. → `main` vira **"legado a colher"**.
3. `ifp-sistema` (scaffold vazio, 0 commits) pode ser **arquivado/excluído** já.

## Plano de migração (gated)

### Fase A — Portar Educacional `main` → `study` (ANTES de qualquer delete)

- **Schema/migrations:** `TurmaInfantil`, `MatriculaInfantil`, `DiarioDia`, `RegistroRotina`, `CheckInOut`, `ResponsavelAutorizado`, `AutorizacaoImagem`, `Comunicado`/`ComunicadoLeitura` (+ enums `StatusDiario`, `TipoRegistroRotina`, `SentidoCheck`, `EscopoImagem`). Recriar como schema Prisma no study (não SQL bruto). Fonte: `packages/database/schema.prisma` + migration `20260611133510_educacional_fase3_e_matricula_cancelada`.
- **Backend:** `apps/api/src/educacional/` (20 arquivos NestJS) → `src/lib/educacional/` + rotas API (estilo study).
- **Frontend:** `apps/web/app/educacional/` (4 páginas) → `src/app/educacional/`.
- **Seed:** `packages/database/prisma/seed.ts:459–773` → integrar no seed do study.
- **E2E:** portar `scripts/valida-educacional.mjs` como teste Playwright do study.
- **Backup dos dados vivos** do Educacional no BD do main (turmas/matrículas/diários/check-ins/responsáveis/consentimentos) antes de qualquer DELETE.

### Fase B — Deprecar (só após Educacional validado no study)

- Arquivar o repo `kiizinbr-ifp-familiaponcio` no GitHub (não deletar; README apontando para o study).
- Arquivar/excluir `ifp-sistema`.

## Ações destrutivas / outward (exigem aprovação explícita do Erick, por base)

- Arquivar repos no GitHub e qualquer DELETE de dados — nunca automático.

---

_Recomendação de execução: a Fase A é um `ecc:orch-add-feature` (portar a vertical Educacional como uma feature, com TDD), seguido de `ecc:code-review` + `ecc:security-review` (dados de menores + LGPD)._
