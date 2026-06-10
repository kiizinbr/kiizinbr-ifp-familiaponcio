> Gerado por workflow multi-agente (5 leitores + arquiteto) em 2026-06-10, read-only sobre a worktree da main.
> Companheiro: PLANO-PORTABILIDADE-CASA-PARA-MAIN.md · decisao: DOSSIE-RECONCILIACAO-MAIN-X-CASA.md

# DOCUMENTO A — ESTUDO DEFINITIVO DA MAIN (`ifp-connect`)

> Linha de produção do IFP Connect. Decisão tomada (Estratégia A): **a `main` é a base**; o design CASA + E2E + dashboards serão portados PARA ela, sem arriscar o prazo de produção (cutover Amplimed em HOLD).
> Base factual: relatórios R1–R5 + checklist de 23 achados do review da branch CASA.

---

## 0. Veredito em uma frase

A `main` é um **monolito Next.js 16 (App Router) maduro, multi-tenant, com o Centro Médico "além de MVP"**, motor de agenda genérico provado contra concorrência, RBAC em camadas e auditoria LGPD real. O que falta é **largura** (outras unidades ainda são stub) e **acabamento visual canônico** (o kit existe e roda, mas há telas a retrofitar) — exatamente os dois eixos que o port da CASA endereça.

---

## 1. Stack exata (o terreno onde vamos pisar)

| Camada | Tecnologia (versão) | Observação load-bearing |
|---|---|---|
| Runtime | Node **>=22**, pnpm **>=9** (`pnpm@11.2.2`), Docker `node:22-alpine` | **Não** é monorepo de workspaces — `pnpm-workspace.yaml` só declara `allowBuilds`. Pacote único. |
| Framework | Next.js **^16.2.6** (App Router, Turbopack), React **^19.2.6** | `output: "standalone"`, `typedRoutes: true`, `serverExternalPackages: ["@react-pdf/renderer"]` |
| Linguagem | TypeScript **^6.0.3** | `pnpm typecheck` = `tsc --noEmit` |
| Estilo | Tailwind **^4.3.0** (só reset/base) + **CSS-kit semântico** | `theme.extend` VAZIO. O visual vem de `.btn/.card/.badge/.shell` em `ifp-components.css`, não de utilitários Tailwind. shadcn configurado mas componentes são caseiros. |
| Backend | Prisma **^6.19.3** + PostgreSQL 16 | 26 migrations aplicadas |
| Auth | Auth.js / NextAuth **5.0.0-beta.31** | Estratégia **JWT** (não-database), provider **Credentials** (bcrypt) |
| Storage | MinIO **^8.0.7** (S3-compat) | Anexos da Ficha Cidadã, SHA-256 |
| PDF | `@react-pdf/renderer` **^4.5.1** + `qrcode` | Receita/atestado/certificado com QR de verificação pública |
| Validação | Zod **^4.4.3** | Inclusive valida env no boot — env inválido **derruba o processo** (`env.ts:22-27`) |
| Testes | Vitest **^4.1.7** + Playwright **^1.60.0** | ~70 specs unit, 11 specs E2E |

**Segurança já no `next.config.ts`:** HSTS, X-Frame `DENY`, `nosniff`, Referrer-Policy, Permissions-Policy, e **CSP em Report-Only** (ainda não bloqueia — só reporta; `next.config.ts:9-29`). Isso é um item de hardening pendente: virar a CSP para enforce.

---

## 2. Como roda (fluxo canônico)

Ambiente de referência do README: **Windows + WSL2 Ubuntu** (Node/pnpm DENTRO do WSL; Postgres em Docker no ext4 do WSL — evita o bug do `wslrelay` no handshake Postgres).

```bash
pnpm dev:up        # docker compose dev: Postgres (host 5433→5432) + MinIO (9000/9001) + pg_isready
pnpm install       # rodar no Linux/WSL (binários nativos sharp/prisma/esbuild)
cp .env.example .env.local   # gerar AUTH_SECRET com randomBytes(32)
pnpm db:migrate    # aplica as 26 migrations
pnpm db:seed       # idempotente: roles RBAC, super_admin, 8 demo, cidadãos, Centro Médico/Capacitação
pnpm dev           # Turbopack em http://localhost:3000
```

- Porta Postgres é **5433** de propósito (o 5432 é do Postgres 9.6 do Alterdata/Bimer na máquina).
- **Ritual pré-commit obrigatório** (CLAUDE.md): `pnpm format && pnpm format:check && pnpm typecheck && pnpm lint && pnpm test` (+ `pnpm build` antes de push). **Todo passo do DOC-B termina validando por esse ritual.**
- Seed cria `erick.ramos@familiaponcio.org.br` (senha `ifp-dev-2026`) + 8 usuários demo (`ifp-demo-2026`) — útil para testar o hub por perfil do DOC-B com papéis reais.

---

## 3. Arquitetura de acesso (defesa em camadas)

A separação de tenant **não é uma checagem só** — é defesa em profundidade, o que importa porque vários dos 23 achados da CASA são exatamente falhas dessa camada:

1. **Borda — `src/proxy.ts`** (Next 16 renomeou `middleware`→`proxy`): `export default auth(...)` + `config.matcher`. Tranca sessão ausente, força `mustChangePassword`, guarda `/admin`, `/painel`, `/<unidade>` via `canAccessUnidade`.
2. **Predicado canônico — `canAccessUnidade`** (`rbac.ts:178-196`): valida slug **antes** do bypass (slug inválido nega até super_admin); `super_admin`/`presidencia` bypassam; senão match exato `(name, unitScope)` contra `UNIDADES[slug].rolesAceitas`.
3. **Capability-based — `can(session, action, resource, ctx)`** (`rbac.ts:53-89`): matriz ação×recurso + predicados de campo sensível (`podeVerSaudeCidadao`, `podeVerSocioCidadao`).
4. **Regras de "dono" no módulo médico** (`medico/rbac.ts`): `podeEditarNota`/`podeAssinarNota` exigem `profissional` E `session.user.id === notaProfissionalUserId` E status rascunho — **assinatura sem bypass de admin**.

> **Ponto de atenção herdado (design):** o scope de unidade NÃO é rechecado nos predicados do módulo médico — o comment em `medico/rbac.ts:6-8` assume que o gate de rota `/medico/*` já garantiu a unidade. É robusto enquanto o gate roda primeiro, mas é a mesma classe de risco que os achados 🔴 da CASA (ver §6).

**RBAC concreto:** 7 roles (`super_admin, presidencia, gestor_unidade, social, profissional, recepcao, painel` — o comment "6 roles" no schema está desatualizado). Globais (sem scope) vs de unidade (`UnitScope = medico|capacitacao|esportivo|recreativo`). `social` e `poncio` são slugs de rota servidos por roles globais, **não** unit-scopes.

---

## 4. Maturidade módulo a módulo

| Módulo | Estado | Evidência |
|---|---|---|
| **Médico / Agenda** | 🟢 **Joia / além de MVP.** | Core resource-agnostic (`agenda/core.ts`, 127 linhas, ZERO import de Prisma — delegate injection). Anti-overbooking isolado em `reservarCAS` (compare-and-swap) e **provado por teste de 5 corridas concorrentes → exatamente 1 sucesso, 4 falhas** (`medico-agenda.test.ts:214-239`). Walk-in/encaixe via `reservarSlotAdHoc` com 2 guards (CAS + `@@unique`→P2002). |
| **Prontuário** | 🟢 Maduro. | `NotaEvolucao` 1:1 com Consulta, **imutável após assinatura**; `AddendoNota` append-only; CID-10 (DATASUS read-only). Receita/Atestado com snapshots (doc impresso não muda se a consulta for editada). |
| **Capacitação** | 🟢 Funcional. | Cursos→Turmas→Matrículas→Presença→Certificado. Matrícula com **teste de concorrência** existente. Certificado com snapshots + código público + QR. |
| **Serviço Social** | 🟡 **Planejado, não consumidor do core ainda.** | A spec mostra o social reusando `gerarSlots`+`reservarCAS`+`criarSlotAdHoc` com `tx.slotSocial` + `TRANSICOES_ENTREVISTA`, mas **médico é hoje o único consumidor real** (grep confirma). Triagem Social existe no schema (`Triagem`, `ElegibilidadeUnidade`). |
| **RBAC** | 🟢 Maduro (camadas, §3). | — |
| **Auditoria LGPD** | 🟢 Real e funcional. | `AuditLog` append-only com par `rootEntityType/rootEntityId` (correlaciona sub-entidades → "histórico do cidadão X" indexado). `logEvent` captura IP/UA automático e **nunca lança**. `medical_data_accessed` gravado ao abrir timeline clínica. Consentimento versionado; anonimização (soft-delete + `anonimizadoEm`). |

**Outras unidades** (esportivo, recreativo): stubs. O veredito "cru" da maturidade de produto é sobre **largura**, não sobre o Centro Médico.

---

## 5. Migração Amplimed + estado de produção

- **ETL one-shot, idempotente, auditável** (Amplimed/MariaDB → Postgres/Prisma). Pipeline Extract→Profile→Transform→Load→Validate. Funções puras com TDD; orquestradores `tsx`.
- **PRONTA e VALIDADA EM DRY-RUN LOCAL; NUNCA rodada com `--commit` em prod.** `CUTOVER-RUNBOOK.md:3`: *"em HOLD aguardando OK do Erick"*. Código commitado/pushado (`origin/main`).
- **Números do dry-run:** 47 profissionais (curados manualmente — a coluna `especialidade=0` da origem é inútil), 18.911 cidadãos, 94.424 consultas, 94.424 notas (1:1), 7.175 fotos, 10.351 anexos.
- **3 ações destrutivas/arriscadas bloqueiam o cutover:** (a) deploy do schema novo (`20260607160940` faz `DROP NOT NULL` em cpf/telefone/dataNascimento + cria `MigracaoAmplimedMap`), (b) reset destrutivo da base demo, (c) hardening de sudo com risco de lock-out (resgate só via console Hyper-V).
- **Dívidas de qualidade conscientes:** 70 CPFs nulados, ~30 nomes placeholder, validação fraca (só contagens/proveniência, sem assert de conteúdo), PHI residual em trânsito (32 GB de mídia) a apagar pós-migração.

> **Implicação para o port:** este é território "não tocar" no DOC-B. Toda a ordem de portabilidade é desenhada para **não chegar perto** de `src/lib/agenda/*`, `src/lib/medico/agenda*`, `prisma/schema.prisma` nem `scripts/migracao-amplimed/*`.

---

## 6. Segurança: o que a `main` JÁ trata dos 23 achados da CASA vs o que falta

A checklist (`CHECKLIST-SEGURANCA-RECONCILIACAO.md`) é o output de um review adversarial **da branch CASA** (backend NestJS-style, caminhos tipo `medico/agenda.service.ts`). Sob a Estratégia A, esses caminhos **não existem na main** — viram **critérios de verificação** que a main deve satisfazer. Mapa por categoria:

### Provavelmente JÁ tratado na main (verificar, não reescrever)

| Achado CASA | Por que a main provavelmente já cobre |
|---|---|
| 🔴 **Race na matrícula / overbooking** (`turmas.service.ts:178-232`) | A main usa **CAS transacional** no agendamento (`reservarCAS`) E tem **teste de concorrência de matrícula** já citado em R5. A classe do bug é a que a main mais protege. **Verificar:** que a matrícula da Capacitação use a mesma transação+lock. |
| 🔴 **`buscarFichas` enumera PII de qualquer cidadão / CPF vira oráculo** | A main tem `cidadaoScope: 'self'|'all'` por unidade (`unidades.ts`) + `canAccessUnidade` + IDOR guard (dossiê). **Verificar:** que a busca de fichas no fluxo médico respeite `cidadaoScope`. |
| 🟠 **Iniciar atendimento 2x → P2002 não tratado (500)** | A main **traduz P2002** para erro de domínio (`SlotJaExisteError`, `agenda.ts:177-182`). Padrão já existe; **verificar** se o iniciar-atendimento herda. |
| 🟠 **Prontuário/chamada editável após o selo sob concorrência** | A main torna `NotaEvolucao` **imutável após assinatura** + máquina de estados (`criarMaquinaEstados`). **Verificar** a Capacitação (selo de aula). |
| 🟠/⚪ **Leitura de dado sensível sem audit READ** | A main JÁ grava `medical_data_accessed` ao abrir timeline (`medico/pacientes/[id]/page.tsx:84-88`). **Verificar** cobertura nas demais leituras. |

### Provavelmente FALTA / a confirmar na main

| Achado CASA | Risco residual na main |
|---|---|
| 🔴 **Endpoint do médico não valida `TipoUnidade` do profissional** (instrutor da Capacitação passa pelos guards de `/medico/*`) | A nota de design (§3) confirma que o **scope de unidade não é rechecado** nos predicados médicos — depende do gate de rota. Equivalente na main: confirmar que `UserRole.unitScope='medico'` é exigido, não só o role `profissional`. **Critério #1 da checklist.** |
| 🔴 **Janela da agenda depende do TZ do servidor** (Docker UTC corta o "dia" às 21h BRT) | O core da main itera **em UTC** (`startOfUtcDay`, `addDays`) — determinístico e bom para testes, mas é preciso **confirmar** que a apresentação/faixa de negócio fixa `America/Sao_Paulo`. **Critério #4 da checklist.** |
| 🟠 **Unique de matrícula não cobre `membroId NULL`** (titular matriculável 2x) | Depende do schema da main — **verificar** o `@@unique` de `Matricula`. |
| 🟠 **Audit do EXPORT de PDF sem ip/userAgent**; verificação pública sem audit | `logEvent` capta IP/UA automático, mas **confirmar** que o export de certificado e a rota `/verificar/[codigo]` chamam `logEvent`. |
| ⚪ **Content-Disposition com filename não sanitizado**; **idade por 365.25 dias** | Itens de baixa severidade, provavelmente presentes em qualquer base que gere PDF/calcule idade no front. **Verificar** pontualmente. |

> **CSP Report-Only** (do `next.config.ts`) não está na checklist mas é dívida real: hoje só reporta. Recomendo entrar como item de hardening **depois** do port.

**Conclusão de segurança:** a main entra em vantagem — os 5 achados 🔴 mais perigosos são justamente as classes que ela melhor cobre (CAS, IDOR guard, P2002 traduzido, imutabilidade pós-selo, audit de leitura clínica). O trabalho real é **verificação dirigida pelos 4 "padrões a garantir"** (TipoUnidade, audit READ + select mínimo, transação+lock, timezone explícito), não reescrita. Esse mapa vira o critério de aceitação do port no DOC-B.
