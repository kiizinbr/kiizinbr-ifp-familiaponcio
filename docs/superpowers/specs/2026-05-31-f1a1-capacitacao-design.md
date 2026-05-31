# F1.A.1 — Capacitação: Catálogo + Turma + Matrícula

**Data:** 2026-05-31
**Status:** 🟡 DRAFT — aguardando aprovação do Erick (§0 decide a direção antes de virar plano)
**Roadmap pai:** `docs/superpowers/roadmap/2026-05-28-roadmap-produto.md` (F1.A Capacitação, sub-módulo 1 — `★ recomendo começar`)
**Spec irmã (padrão arquitetural a espelhar):** `docs/superpowers/specs/2026-05-28-medico-agenda-fila-design.md` (F1.B.1 Médico, já entregue+pushado em `c86b5a8`)
**Research base:** `docs/superpowers/research/2026-05-28-saas-references-por-vertical.md` §2 (Capacitação — Disco + Hotmart Club)

---

> **Como ler este documento.** Diferente da spec do Médico (que já saiu do brainstorm com as decisões fechadas), esta é um **rascunho pré-brainstorm**. O coração é o **§0 — DECISÕES EM ABERTO**: são as escolhas de produto/regra de negócio que **só o Erick** pode fechar (algumas dependem da Luciana). Cada uma traz 2-3 opções, o trade-off e uma **recomendação** minha — mas recomendação a confirmar, não decisão tomada. As seções seguintes (modelo de dados, rotas, RBAC, fluxos) são **provisórias e ramificam** conforme o §0 for fechado: estão escritas no default recomendado, com marcações `⚠️ depende de §0.N` onde a escolha muda a estrutura.

---

## §0 — DECISÕES EM ABERTO (precisam do Erick)

> Numeradas pra referência cruzada. "recomendação:" = meu default sugerido; nada está fechado até o Erick (ou a Luciana, onde indicado) confirmar.

### §0.1 — Curso é template e Turma é instância datada? Ou curso = turma única?

- **Opção A (2 níveis — recomendado):** `Curso` = template reutilizável (nome, ementa, carga horária, área, capacidade padrão) e `Turma` = instância datada (período início→fim, sala, instrutor, vagas, lista de alunos). Um curso "Informática Básica" tem turmas 2026.1, 2026.2, etc.
- **Opção B (1 nível):** Só `Turma` (cada oferta é independente, sem template). Mais simples, mas reescreve ementa/carga toda vez e perde "histórico do curso".
- **Trade-off:** A introduz uma entidade extra (mais telas, mais joins) mas casa com a realidade ("a Luciana reabre o mesmo curso por semestre") e habilita catálogo público futuro (F1.A.3) sem refactor. B entrega mais rápido mas vira dívida na 2ª oferta.
- **recomendação: Opção A.** É o que o roadmap §2.2 já antecipa ("Catálogo de cursos" + "Turma/Cohort" como itens distintos) e o que espelha o Médico (Especialidade-template ⟶ Slot-instância). O custo extra é 1 CRUD a mais (Catálogo), barato.

### §0.2 — Aluno reusa `Cidadao` ou cria modelo `Aluno` separado?

- **Opção A (reusa `Cidadao` — recomendado):** Matrícula referencia `cidadaoId`. O beneficiário é cadastrado uma vez no instituto e é o mesmo nas 4 unidades.
- **Opção B (`Aluno` separado):** Entidade própria com subset de campos. Evita acoplar Capacitação à ficha cidadã.
- **Trade-off:** A = fonte única, zero duplicação, cruza com triagem/social, e é exatamente o que o Médico fez (`Consulta.cidadaoId`). Risco: nem todo aluno passou por triagem social → precisamos permitir matricular cidadão com `statusCadastro=rascunho` ou criar ficha no ato (ver §0.3). B duplica PII (pior pra LGPD) e cria o problema "o João da Capacitação é o mesmo João do Médico?".
- **recomendação: Opção A — reusa `Cidadao`.** Mantém a arquitetura "reusa Cidadao + modelos próprios do vertical" já validada. Modelos novos do vertical: `Curso`, `Turma`, `Matricula` (+ `Instrutor` se §0.6=User).

### §0.3 — Quem matricula? Há auto-inscrição do cidadão?

- **Opção A (recepção + gestor — recomendado p/ F1.A.1):** `recepcao:capacitacao` e `gestor_unidade:capacitacao` (Luciana) matriculam pela tela interna. Sem portal público.
- **Opção B (+ auto-inscrição):** Cidadão se inscreve por link público (estilo página de inscrição do Funil F2.B).
- **Trade-off:** B é o "WOW" de escala mas depende do Funil/F2 (página pública + slots materializados) que o roadmap colocou na **Fase 2**. Fazer agora = furar a ordem do roadmap e reabrir auth pública.
- **recomendação: Opção A.** Auto-inscrição pública vai pro **§N não-objetivos → F1.A.3 / Fase 2 (Funil)**. Em F1.A.1, quem matricula é gestor/recepção.
  - **Sub-decisão §0.3a — capacidade:** Turma tem `capacidade` (Int). Ao lotar, **recomendação:** bloqueia matrícula nova com erro claro + oferece **lista de espera** (status `lista_espera`) — barato e some o "e quando lotar?". Confirmar se lista de espera entra já no F1.A.1 ou fica pra depois.
  - **Sub-decisão §0.3b — pré-requisitos entre cursos** (ex.: "Excel Avançado" exige "Excel Básico"): **recomendação: FORA do F1.A.1** (vira complexidade de grafo). Deferir pra F1.A.3/trilhas.

### §0.4 — Instrutor é `User` com login ou campo texto?

- **Opção A (`Instrutor` ligado a `User` — espelha Médico):** instrutor faz login, vê suas turmas, futuramente lança presença (F1.A.2). Igual `Profissional`→`User`.
- **Opção B (campo texto `instrutorNome` na Turma):** zero login; só rótulo.
- **Trade-off:** A é necessário pra F1.A.2 (presença mobile lançada pelo próprio instrutor "1 toque") — sem login do instrutor, quem lança presença? A recepção/gestor. B é mais rápido agora mas vira refactor garantido em F1.A.2.
- **recomendação: Opção A, porém faseada.** Criar modelo `Instrutor` (com `userId` opcional/nullable) já no F1.A.1, mas **a presença lançada pelo instrutor logado é F1.A.2**. Assim o schema nasce certo e a UI de login do instrutor entra depois sem migration dolorosa. ⚠️ Se o Erick preferir velocidade máxima, cai pra Opção B e aceita o refactor — sinalizar.

### §0.5 — Registra presença/frequência por aula já no F1.A.1?

- **Opção A (NÃO — recomendado):** F1.A.1 entrega só Catálogo + Turma + Matrícula (CRUD + estado da matrícula). Presença é F1.A.2 (o roadmap separa explicitamente "Presença mobile-first" como sub-módulo próprio).
- **Opção B (presença simples já agora):** lista da turma com toggle presente/ausente por data.
- **Trade-off:** A respeita o fatiamento do roadmap (entrega pequena, valida o padrão em ~1-1,5 dia). B antecipa valor mas incha o escopo e a tela mobile de presença merece atenção de design própria.
- **recomendação: Opção A.** Presença = F1.A.2. Aqui só deixamos o **gancho de schema** (modelo `Aula`/`Presenca`?) decidido mas **não implementado** — ou nem isso, pra não pré-otimizar. **recomendação:** nem o gancho; F1.A.2 desenha sua própria estrutura de presença.

### §0.6 — Certificado: gerado quando e por qual critério? PDF é F1.A.1?

- **Contexto:** o roadmap marca o certificado como o **momento "WOW"** ("primeiro certificado da vida do beneficiário") e cita a **regra CapacitaSUAS: 80% de presença → PDF com QR + share WhatsApp**.
- **Opção A (FORA do F1.A.1 — recomendado):** certificado (geração de PDF + QR + critério de 80%) é **F1.A.3**. Depende de presença (F1.A.2) pra calcular frequência — sem F1.A.2 não há % de presença a checar.
- **Opção B (campo manual já agora):** gestor marca matrícula como "concluída" e anexa PDF feito à mão. Entrega o WOW antes, sem automação.
- **Trade-off:** A é a sequência tecnicamente correta (certificado precisa de frequência → precisa de presença). B dá um WOW rápido pra Luciana mostrar, mas o PDF manual não escala e some quando F1.A.3 chegar.
- **recomendação: Opção A.** Certificado automático = **F1.A.3** (depende de F1.A.2). Em F1.A.1, o **status `concluido`** da matrícula já existe na máquina de estados (§0.7) — então o "aluno concluiu" fica registrado, só o PDF/QR/critério-80% ficam pra depois. ⚠️ Se Luciana tem demo iminente e quer o PDF manual, ativar Opção B como add-on barato.

### §0.7 — Máquina de estados da Matrícula

- **Estados propostos:** `inscrito` → `confirmado` → `cursando` → (`concluido` | `desistente` | `reprovado`); + `lista_espera` (se §0.3a) e `cancelado`.
- **Opção A (completa — recomendada):** todos acima. Reprovado/desistente distinguem evasão de reprovação por nota/frequência (relevante pra relatório CapacitaSUAS).
- **Opção B (enxuta):** `inscrito` → `cursando` → `concluido` / `cancelado`. Sem distinção reprovado vs desistente.
- **Trade-off:** A dá granularidade pros relatórios sociais (taxa de evasão é métrica que o governo cobra) mas exige mais botões/regras de transição. B é mais simples mas perde nuance que a assistência social valoriza.
- **recomendação: Opção A**, com transições validadas em `lib/capacitacao/matricula.ts` (espelha `TRANSICOES` do Médico em `lib/medico/agenda.ts`). `concluido`/`reprovado` automatizam em F1.A.3 a partir da frequência; aqui são transição manual do gestor.

### §0.8 — Vínculo com o Funil legacy (`Vaga`/`Agendamento`)

- **Contexto:** já existe `Vaga` (unidade='capacitacao', `slotsTotais`) + `Agendamento`. O Médico **não** tocou nisso (criou modelos próprios). A `Turma` proposta se sobrepõe conceitualmente a `Vaga` (ambas têm "vagas/capacidade").
- **Opção A (independente — recomendado):** `Turma` é modelo novo, não toca `Vaga`. Igual o Médico fez. `Vaga`/`Agendamento` continuam servindo o funil de captação (Fase 2).
- **Opção B (Turma estende/consome Vaga):** matrícula nasce de um `Agendamento` materializado.
- **Trade-off:** A mantém o roadmap limpo (Funil é refactor da Fase 2, não mistura agora). B acopla F1.A.1 a um modelo que o próprio roadmap vai refatorar — risco de retrabalho duplo.
- **recomendação: Opção A.** Independente. Quando a Fase 2 refatorar o Funil com slots materializados, aí sim conecta-se "agendamento de entrada → matrícula em turma".

### §0.9 — LGPD: cursos para menores de idade

- **Contexto:** Capacitação pode ter cursos infantojuvenis. `Cidadao` tem `dataNascimento`; menor exige consentimento de responsável (base legal LGPD art. 14).
- **Opção A (assumir público adulto no F1.A.1 — recomendado):** F1.A.1 trata o aluno como cidadão maior já cadastrado; consentimento de responsável e ficha-de-menor robusta ficam pro **Recreativo (F1.D.1)** / **LGPD operacional (F3.A)**, que já são os módulos donos desse tema.
- **Opção B (tratar menor já agora):** adicionar campo responsável/consentimento à matrícula.
- **Trade-off:** B antecipa conformidade mas duplica o que o F1.D.1/F3.A vão construir direito (autorizações granulares, responsáveis múltiplos). A evita meia-solução de LGPD.
- **recomendação: Opção A**, com **flag de alerta na UI**: se `cidadao.dataNascimento` indica menor de 18 no ato da matrícula, mostrar aviso "Aluno menor de idade — consentimento de responsável tratado fora do escopo deste módulo" e registrar no audit. Sinaliza o gap sem fingir que resolveu. Confirmar com o Erick se isso basta ou se há curso infantil iminente que force a Opção B.

### §0.10 — Landing/rota da unidade: `/capacitacao` vs `/app/capacitacao`

- **Contexto:** `getLandingPathFor` (em `rbac-types.ts`) manda `gestor_unidade:capacitacao` pra **`/app/capacitacao`**. Mas o Médico vive em **`/medico/*`** (shell próprio, não sob `/app`). Há divergência entre o landing configurado e o padrão de rota efetivo.
- **Opção A (espelhar Médico — recomendado):** rotas em **`/capacitacao/*`** com `CapacitacaoShell` próprio; atualizar `getLandingPathFor` pra `/capacitacao` (e revisar se o Médico já tem a mesma correção pendente).
- **Opção B (sob `/app/capacitacao`):** seguir o landing atual literalmente.
- **Trade-off:** A é consistente com o vertical já entregue (Médico) e com `medicoNavItems`→`CapacitacaoShell`. B respeita o código atual mas cria 2 padrões de rota diferentes entre verticais (confuso).
- **recomendação: Opção A** + um T no plano pra alinhar `getLandingPathFor` dos dois verticais. ⚠️ Verificar como o `/medico` resolveu o login (`/medico/login`) e replicar.

---

## 1. Motivação

A Capacitação do IFP profissionaliza beneficiários em Duque de Caxias (informática, gastronomia, costura, etc.) com a ambição de **referência social** que o Erick coloca em todas as unidades. O roadmap recomenda **começar a Fase 1 por aqui** (F1.A `★`) porque:

- **Menor escopo** que o Médico (turmas + matrícula < agenda + prontuário) → valida o padrão "tela-âncora vertical" rápido.
- **Win cedo pra Luciana** (gestora `gestor_unidade:capacitacao`), construção parceira.
- **Certificado = momento "WOW"** pra famílias (primeiro certificado da vida do beneficiário) — embora o PDF em si seja F1.A.3 (§0.6).

F1.A.1 é o **primeiro sub-módulo**: a base de **Catálogo de cursos + Turmas + Matrícula**. Sem ele, presença (F1.A.2) e certificado (F1.A.3) não têm onde existir. Após F1.A.1 a unidade passa a ter: catálogo de cursos cadastrável, turmas datadas com instrutor e capacidade, e beneficiários matriculáveis com estado de matrícula auditado.

Referência visual: **Disco + Hotmart Club** (research §2) — catálogo em grade de cards, sensação de "trilha curta com fim claro". O design fino das telas passa pelo skill `frontend-design` (preferência do Erick), com lab de direções pra ele escolher de manhã.

## 2. Decisões fechadas no brainstorm

> ⚠️ **Vazio até o brainstorm rodar.** Esta tabela espelha a §2 do Médico, mas só preenche depois que o Erick fechar o §0. Mantida aqui pra continuidade de formato.

| #   | Pergunta             | Decisão |
| --- | -------------------- | ------- |
| —   | (a preencher pós-§0) | —       |

## 3. Defaults assumidos pras decisões secundárias

Documentados pra ficar explícito; refináveis sem mudar a spec:

| Item                           | Default                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| Quem cadastra curso (catálogo) | `gestor_unidade:capacitacao` (Luciana) + `super_admin`                                            |
| Quem cria turma                | `gestor_unidade:capacitacao` + `super_admin`                                                      |
| Quem matricula                 | `gestor_unidade` + `recepcao:capacitacao` (§0.3 Opção A)                                          |
| Busca de aluno na matrícula    | Reutiliza componente de busca de `Cidadao` (igual `/medico/consultas/nova`)                       |
| Cidadão sem ficha completa     | Permitido matricular `statusCadastro` ∈ {rascunho, ativo}; bloquear só `inativo`                  |
| Modalidade do curso            | Campo `modalidade` ∈ {presencial, online, hibrido} — default presencial                           |
| Carga horária                  | `cargaHorariaTotal` (Int, horas) no `Curso`; informativa em F1.A.1, base do certificado em F1.A.3 |
| Sala / local                   | Campo texto livre `local` na `Turma` (sem cadastro de salas/recursos no MVP)                      |
| Soft-delete                    | `Curso.ativo`/`Turma.ativa` booleanos (igual `Especialidade.ativa`); sem hard-delete              |

## 4. Arquitetura de dados (PROVISÓRIA)

> ⚠️ Sketch Prisma marcado provisional. Reflete o default recomendado do §0 (A na maioria). Ramifica conforme o Erick fechar.

### 4.1 Modelo Prisma (resumo) — assume §0.1=A, §0.2=A, §0.4=A, §0.7=A

```prisma
// ============================================================================
// F1.A.1 — Capacitação: Catálogo + Turma + Matrícula  (PROVISÓRIO)
// ============================================================================

model Curso {
  id                String   @id @default(cuid())
  nome              String                       // "Informática Básica"
  descricao         String?  @db.Text            // ementa curta (markdown)
  area              String                       // "Tecnologia" | "Gastronomia" | ... (texto livre por ora)
  cargaHorariaTotal Int                          // horas — base do certificado (F1.A.3)
  modalidade        String   @default("presencial") // presencial | online | hibrido
  capacidadePadrao  Int      @default(20)        // herdada pela Turma; editável por turma
  thumbUrl          String?                      // card do catálogo (MinIO) — upload é F1.A.3
  ativo             Boolean  @default(true)       // soft-delete
  turmas            Turma[]
  createdById       String
  createdBy         User     @relation("CursoCriadoPor", fields: [createdById], references: [id])
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([ativo, area])
}

// ⚠️ §0.4: Instrutor com userId NULLABLE — login do instrutor é F1.A.2.
// Se §0.4=B, este modelo some e Turma ganha `instrutorNome String`.
model Instrutor {
  id            String   @id @default(cuid())
  userId        String?  @unique               // null = ainda sem login (F1.A.1); preenchido em F1.A.2
  user          User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  nomeExibicao  String
  bio           String?
  ativo         Boolean  @default(true)
  turmas        Turma[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

enum StatusTurma {
  planejada
  inscricoes_abertas
  em_andamento
  concluida
  cancelada
}

model Turma {
  id            String       @id @default(cuid())
  cursoId       String
  curso         Curso        @relation(fields: [cursoId], references: [id], onDelete: Restrict)
  instrutorId   String?
  instrutor     Instrutor?   @relation(fields: [instrutorId], references: [id], onDelete: SetNull)
  codigo        String       @unique             // "INFO-2026.1" — legível, gerado/editável
  dataInicio    DateTime     @db.Date
  dataFim       DateTime     @db.Date
  local         String?                          // sala/endereço livre
  capacidade    Int                              // herda Curso.capacidadePadrao na criação
  status        StatusTurma  @default(planejada)
  observacoes   String?      @db.Text
  matriculas    Matricula[]
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  @@index([cursoId, status])
  @@index([status, dataInicio])
}

enum StatusMatricula {
  inscrito
  confirmado
  cursando
  concluido
  reprovado
  desistente
  lista_espera                                   // §0.3a
  cancelado
}

model Matricula {
  id            String          @id @default(cuid())
  turmaId       String
  turma         Turma           @relation(fields: [turmaId], references: [id], onDelete: Restrict)
  cidadaoId     String                            // §0.2: reusa Cidadao
  cidadao       Cidadao         @relation(fields: [cidadaoId], references: [id], onDelete: Restrict)
  status        StatusMatricula @default(inscrito)
  origemTriagemId String?                         // se veio de encaminhamento da Regina (espelha Consulta)
  observacoes   String?         @db.Text
  motivoSaida   String?                           // preenchido em desistente/reprovado/cancelado
  createdBy     String                            // userId de quem matriculou
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  @@unique([turmaId, cidadaoId])                   // 1 matrícula por cidadão por turma
  @@index([turmaId, status])
  @@index([cidadaoId])
}
```

**Relations reversas a adicionar:** em `User` → `cursosCriados Curso[] @relation("CursoCriadoPor")` e `instrutor Instrutor?`; em `Cidadao` → `matriculas Matricula[]`.

### 4.2 Lógica em `lib/capacitacao/matricula.ts` (puro + transacional)

Espelha `lib/medico/agenda.ts`:

- `matricular(turmaId, cidadaoId, ctx)` — **transacional**: conta matrículas ativas da turma; se `< capacidade` cria `inscrito`, senão cria `lista_espera` (ou lança `TurmaLotadaError` se §0.3a decidir sem lista de espera). Anti-corrida via `count` dentro de `$transaction` + `@@unique([turmaId, cidadaoId])` evita matrícula dupla.
- `transicionarMatricula(matriculaId, para)` — valida contra `TRANSICOES_MATRICULA` (mesmo padrão do `TRANSICOES` de consulta). Ex.: `inscrito → {confirmado, cancelado}`, `cursando → {concluido, reprovado, desistente}`.
- `promoverDaListaEspera(turmaId)` — ao liberar vaga (cancelado/desistente), promove o 1º `lista_espera` → `inscrito` (ou deixa manual; decidir no §0.3a). Função pura testável + wrapper transacional.

### 4.3 RBAC (assume §0.3=A)

| Capability                    | super_admin | gestor:capacitacao |        instrutor\*         |  recepcao:capacitacao  |        social        |
| ----------------------------- | :---------: | :----------------: | :------------------------: | :--------------------: | :------------------: |
| Ver catálogo / turmas         |      ✓      |         ✓          |             ✓              |           ✓            |          ✓           |
| Criar/editar curso (catálogo) |      ✓      |         ✓          |             —              |           —            |          —           |
| Criar/editar turma            |      ✓      |         ✓          |             —              |           —            |          —           |
| Cadastrar/editar instrutor    |      ✓      |         ✓          |         ✓ próprio          |           —            |          —           |
| Matricular cidadão            |      ✓      |         ✓          |             —              |           ✓            | ✓ via encaminhamento |
| Transicionar matrícula        |      ✓      |         ✓          | ✓ próprias turmas (F1.A.2) | ✓ (confirmar/cancelar) |          —           |
| Ver matrículas                |   ✓ todas   |      ✓ todas       |       ✓ suas turmas        |        ✓ todas         |    ✓ encaminhadas    |

\* `instrutor` como capability é **gancho de F1.A.2** (§0.4). Em F1.A.1 a coluna fica documentada mas o login do instrutor não é implementado. Implementação em `lib/capacitacao/rbac.ts` espelhando `lib/medico/rbac.ts` (`podeGerenciarCurso`, `podeCriarTurma`, `podeMatricular`, `podeTransicionarMatricula`). O escopo `capacitacao` já é garantido pelo gate de rota (`canAccessUnidade(session, "capacitacao")`).

## 5. Rotas / Telas (PROVISÓRIO — assume §0.10=A)

### 5.1 Estrutura de arquivos (espelha `/medico/*`)

```
src/app/capacitacao/page.tsx                  # home da unidade: turmas em andamento + KPIs + atalhos
src/app/capacitacao/cursos/page.tsx           # catálogo (grade de cards Disco-like)
src/app/capacitacao/cursos/novo/page.tsx
src/app/capacitacao/cursos/[id]/page.tsx       # detalhe do curso + suas turmas
src/app/capacitacao/turmas/page.tsx            # lista/filtro de turmas
src/app/capacitacao/turmas/nova/page.tsx
src/app/capacitacao/turmas/[id]/page.tsx       # detalhe turma + lista de matriculados + ações
src/app/capacitacao/turmas/[id]/matricular/page.tsx  # wizard de matrícula
src/app/capacitacao/instrutores/page.tsx       # CRUD instrutor (login = F1.A.2)
src/app/capacitacao/actions.ts                 # server actions (criar curso/turma, matricular, transicionar)

src/components/capacitacao/capacitacao-shell.tsx  # CapacitacaoShell + CapacitacaoHeader (espelha MedicoShell)
src/lib/capacitacao/matricula.ts               # lógica pura + transacional
src/lib/capacitacao/rbac.ts                    # capabilities
src/lib/capacitacao/nav.ts                     # nav contextual (espelha medicoNavItems)
src/lib/capacitacao/ui.ts                      # MATRICULA_VISUAL (label+variant por status, espelha CONSULTA_VISUAL)
```

`CapacitacaoShell` usa `AppShell` com `sectionLabel="Capacitação"` e `sectionColor` no laranja da unidade (`#FF772E` / `rgb(var(--ifp-orange-500))`, já em `unidades.ts`).

### 5.2 Resumo por tela

- **`/capacitacao` (home):** saudação + data; KPIs (turmas em andamento / matrículas ativas / inscrições abertas); lista de turmas em andamento; atalhos "Novo curso", "Nova turma", "Catálogo".
- **`/capacitacao/cursos` (catálogo):** grade de cards Disco-like (thumb + nome + área + carga horária + nº de turmas ativas). Filtro por área/modalidade. Botão "Novo curso" (gestor).
- **`/capacitacao/cursos/[id]`:** ementa + dados do curso + lista de turmas (passadas e futuras) + "Nova turma deste curso".
- **`/capacitacao/turmas`:** tabela filtrável por status/curso/período. Badge de ocupação (`12/20`).
- **`/capacitacao/turmas/[id]`:** cabeçalho (curso, período, instrutor, local, ocupação) + lista de matriculados com status + ações (matricular, confirmar, marcar cursando/concluído/desistente). Espaço reservado pra "Presença" (F1.A.2) e "Certificados" (F1.A.3).
- **`/capacitacao/turmas/[id]/matricular` (wizard):** Step 1 buscar cidadão (reutiliza busca) → Step 2 confirmar (mostra turma, vagas restantes, aviso de menor se §0.9) → submit `matricular` action → volta pra turma.
- **`/capacitacao/instrutores`:** lista + criar/editar (nome, bio); vínculo com User = F1.A.2.

## 6. Fluxos principais

### Fluxo A — Luciana cadastra um curso e abre turma

1. `/capacitacao/cursos/novo` → preenche "Informática Básica", área Tecnologia, 40h, capacidade 20.
2. `/capacitacao/cursos/[id]` → "Nova turma" → código INFO-2026.1, 01/jul→30/ago, instrutor (selecionável; opcional no F1.A.1), local "Sala 2".
3. Turma nasce `planejada`; gestor muda pra `inscricoes_abertas`.

### Fluxo B — Recepção matricula beneficiário

1. `/capacitacao/turmas/[id]/matricular` → busca "Maria Souza" → seleciona.
2. Sistema mostra vagas restantes; se menor de 18 → aviso §0.9.
3. Submit → `matricular()` transacional → status `inscrito` (ou `lista_espera` se lotada).
4. Volta pra turma com a lista atualizada.

### Fluxo C — Gestor toca a turma

1. Início do curso → muda turma pra `em_andamento`; matrículas `confirmado`→`cursando` (em lote ou individual).
2. Aluno some → "Desistente" + motivo. Vaga libera → promove lista de espera (§0.3a).
3. Fim do curso → matrículas elegíveis → `concluido` (manual no F1.A.1; automático por frequência em F1.A.3).

## 7. Sub-tasks — outline alto nível (NÃO é o plano TDD)

> ~12-16 tasks de uma linha. O plano TDD detalhado vem **depois** que o Erick fechar o §0.

1. Schema Prisma + migration (`Curso`, `Instrutor`, `Turma`, `Matricula` + 3 enums + índices + relations reversas). ⚠️ ramifica em §0.1/§0.2/§0.4.
2. Seed demo (3 cursos + 2 instrutores + 4 turmas em estados variados + ~15 matrículas).
3. `lib/capacitacao/matricula.ts` puro + transacional — `matricular`, `transicionarMatricula`, `promoverDaListaEspera`, `TRANSICOES_MATRICULA` (~10-12 unit tests, espelha `medico/agenda.ts`).
4. `lib/capacitacao/rbac.ts` — capabilities (`podeGerenciarCurso`, `podeCriarTurma`, `podeMatricular`, `podeTransicionarMatricula`).
5. `lib/capacitacao/nav.ts` + `lib/capacitacao/ui.ts` (`MATRICULA_VISUAL`).
6. `CapacitacaoShell` + `CapacitacaoHeader` (espelha `MedicoShell`).
7. `/capacitacao` home (KPIs + turmas em andamento).
8. `/capacitacao/cursos` catálogo (grade de cards) + `/cursos/novo` + `/cursos/[id]`.
9. `/capacitacao/turmas` lista/filtro + `/turmas/nova`.
10. `/capacitacao/turmas/[id]` detalhe + lista de matriculados + transições.
11. `/capacitacao/turmas/[id]/matricular` wizard (busca cidadão → confirma).
12. `/capacitacao/instrutores` CRUD (sem login — gancho F1.A.2).
13. `actions.ts` — server actions transacionais + audit log em cada mutação.
14. Ajuste `getLandingPathFor` → `/capacitacao` (§0.10) + login da unidade.
15. Lab de design `frontend-design`: 4-6 direções da home + catálogo pro Erick escolher de manhã.
16. E2e Playwright: cadastrar curso+turma, matricular até lotar (capacidade + lista de espera), transição de matrícula, RBAC (recepção não cria curso).

## 8. Não-objetivos (F1.A.1 NÃO entrega)

- **Presença / frequência por aula** → **F1.A.2** (mobile-first, 1 toque) — §0.5.
- **Login do instrutor** (lançar presença logado) → **F1.A.2** — §0.4.
- **Trilha do aluno** (módulos verticais, % progresso, conteúdo/apostila/vídeo) → **F1.A.3**.
- **Certificado** (critério 80% presença CapacitaSUAS + PDF + QR + share WhatsApp) → **F1.A.3** — §0.6.
- **Histórico do aluno** (cursos passados + certificados) → **F1.A.3**.
- **Auto-inscrição pública / portal do aluno** (link Instagram) → **Fase 2 (Funil F2.B)** — §0.3.
- **Pré-requisitos entre cursos** (grafo de dependência) → F1.A.3 — §0.3b.
- **Cadastro de salas/recursos** (vira só campo texto `local`) → futuro, se necessário.
- **Upload de thumb/foto via UI** → path em MinIO por ora; UI dedicada futura (igual fez o Médico com foto do profissional).
- **Consentimento robusto de menores** (responsável, autorização) → **F1.D.1 (Recreativo) / F3.A (LGPD)** — §0.9.
- **Conexão com Funil legacy** (`Vaga`/`Agendamento`) → Fase 2 — §0.8.

## 9. Riscos e mitigações

| Risco                                                    | Mitigação                                                                                    |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| §0 não fechado → impl trava                              | Esta spec existe pra fechar o §0 antes do plano; nada de código antes                        |
| Matrícula dupla / overbooking concorrente                | `@@unique([turmaId, cidadaoId])` + `count` dentro de `$transaction` (espelha `reservarSlot`) |
| Divergência de rota `/capacitacao` vs `/app/capacitacao` | §0.10 + task 14 alinha `getLandingPathFor` dos dois verticais                                |
| Curso/turma deletado com matrículas                      | `onDelete: Restrict` + soft-delete (`ativo`/`status=cancelada`)                              |
| PII de aluno duplicada                                   | §0.2=A (reusa `Cidadao`, fonte única) elimina o risco                                        |
| Menor matriculado sem consentimento                      | Aviso na UI + audit (§0.9); solução completa em F1.D.1/F3.A                                  |
| Escopo inflar pra presença/certificado                   | §0.5/§0.6 cortam explicitamente pro F1.A.2/F1.A.3                                            |

## 10. LGPD / Compliance

- **Dado sensível tocado:** `Matricula` cria vínculo "pessoa X faz curso Y" — dado pessoal (não sensível na acepção do art. 5º LGPD, mas pessoal). Reusar `Cidadao` (§0.2) mantém base legal/consentimento já modelados na ficha cidadã, sem duplicar PII.
- **Menores (§0.9):** sinalizado, não resolvido — alerta na UI + audit; solução de consentimento de responsável é do F1.D.1/F3.A.
- **Audit:** toda mutação (criar curso/turma, matricular, transicionar) grava `AuditLog` com `rootEntityType` apontando pra `cidadao` (igual o padrão do Médico/Triagem) → habilita "histórico do cidadão" indexado.
- **Minimização:** `Matricula` não copia campos do cidadão; só `cidadaoId`. Relatórios sociais (taxa de conclusão/evasão pro CapacitaSUAS) são agregados — exportação detalhada com PII fica restrita a `social`/`gestor` (F3.C).

## 11. Critérios de sucesso

- [ ] §0 revisado e fechado pelo Erick (e Luciana onde indicado) antes do plano.
- [ ] Luciana cadastra curso + abre turma via `/capacitacao/cursos` e `/capacitacao/turmas/nova`.
- [ ] Recepção matricula cidadão; ao lotar, comportamento de capacidade (§0.3a) funciona.
- [ ] Matrícula dupla bloqueada (`@@unique`) e overbooking concorrente tratado.
- [ ] Transições de matrícula respeitam a máquina de estados; inválidas dão erro claro.
- [ ] RBAC: recepção não cria curso; instrutor (gancho) documentado.
- [ ] Catálogo Disco-like renderiza cards com cor/laranja da unidade.
- [ ] Audit captura todas as mutações com `rootEntityId=cidadaoId`.
- [ ] Lab `frontend-design` com 4-6 direções pro Erick escolher de manhã.
- [ ] E2e Playwright verdes; `pnpm typecheck && pnpm lint && pnpm test && build` verdes.

## 12. Dependências

- Multi-tenant + RBAC v2 (`canAccessUnidade`, roles `gestor_unidade`/`recepcao`/`profissional` scope `capacitacao`) — já entregue.
- DS v2 + componentes universais (`Button`, `Input`, `Card`, `Badge`, `EmptyState`, `AppShell`) — já disponíveis.
- Ficha `Cidadao` + busca + `lib/cidadao.ts` — já entregue (reuso §0.2).
- Audit log + `lib/audit.ts` — já entregue.
- Padrão arquitetural do Médico (F1.B.1, `c86b5a8`) — referência viva a espelhar.
- MinIO pra thumbs (path por ora; upload UI futuro).

## 13. Estimativa grossa

~1,5-2 dias úteis de TDD focado (menor que o Médico, como o roadmap previu). Plano de implementação detalhado vem depois do §0 fechado. F1.A.2 (presença) e F1.A.3 (trilha + certificado) constroem sobre este e ganham specs próprias.
