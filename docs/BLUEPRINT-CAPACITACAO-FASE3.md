> Gerado por workflow multi-agente (4 leitores + 1 arquiteto) e **reconciliado com a pesquisa
> de SaaS de referência feita a pedido da diretoria** (pesquisa de 2026-05-28; reconciliação em 2026-06-10).
> Plano-mãe: `docs/PLANO-UNIR-CONNECT.md` · Gabarito de código: `docs/BLUEPRINT-MEDICO-FASE1.md` + `apps/api/src/medico/`

# BLUEPRINT — FASE 3: CENTRO DE CAPACITAÇÃO (tema laranja `capacitacao`)

> **Correção de premissa do workflow:** o relatório original assumiu que o módulo médico
> não existia no checkout (`apps/api/src/medico/` "não encontrado"). **Ele existe e está
> entregue** — API em `apps/api/src/medico/` e front em `apps/web/app/medico/` (agenda +
> prancha 5 passos, `data-theme="medico"`). A anatomia real está documentada na seção 3
> e é o padrão obrigatório deste blueprint.

---

## 1. Vertical MVP: "Da matrícula ao certificado verificável" em 1 turma piloto (Barbeiro BB-2026-1)

Fluxo: elegibilidade APROVADO (já existe no Serviço Social) → matrícula na turma (vagas + lista
de espera) → instrutor faz chamada por aula **no celular** → painel da gestora mostra
frequência/risco de evasão → encerrar turma → certificados gerados só para quem atingiu a
presença mínima, com código público verificável.

**Por quê:** é o equivalente da "prancha" do médico — um caminho único que exercita TODAS as
entidades-núcleo (Curso, Turma, Matrícula, Aula, Presença, Certificado) e as 3 personas
(gestora desktop, instrutor mobile, família no portal vendo o certificado). O protótipo Connect
já validou exatamente essas telas (`cap-painel`, `cap-turma`, `cap-diario`, `cap-chamada`,
`cap-certificados`), e a regra que dá valor institucional (certificado anti-fraude usado para
emprego) fecha o loop. O **Banco de Modelos/sessões práticas fica explicitamente para a Fase 2**
— é a parte mais original do protótipo, mas não bloqueia o vertical e adiciona uma entidade fora
da Ficha Cidadã (voluntário-modelo) com termo de imagem próprio.

## 2. REFERÊNCIAS DE MERCADO (pesquisa da diretoria, 2026-05-28)

Fonte: `IFP - Research SaaS References por Vertical.md` (vault). Gatilho da pesquisa: feedback
da diretoria na 1ª apresentação ("parece software de 5 anos atrás"). Os SaaS abaixo informam
esta unidade:

| SaaS | O que aproveitar aqui |
|---|---|
| **Disco** (disco.co) | Sidebar focada, blocos modulares, white-label — referência de estrutura do painel. |
| **Thinkific Learner Hub** | 1 porta de entrada única do aluno (hub agregador, não dashboard fragmentado). |
| **Hotmart Club** | **Vocabulário BR**: "Trilhas", % de progresso — adotar o léxico, é o que aluno BR entende. |
| **Sponte by TOTVS** | O mais próximo do IFP (cursos livres, presença, certificado). **Pegar modelo de dados e fluxos — NÃO o look** (visual "ERP educacional"). |

**Padrões de UX a adotar (cross-vertical + capacitação):**

- **Densidade média-alta nas telas operacionais** (painel da gestora, frequência, diário);
  whitespace generoso só no catálogo de cursos/onboarding.
- **Mobile-first na chamada**: a tela-âncora da unidade é "trilha do aluno + presença mobile".
  A chamada nasce para o **celular do instrutor** (1 toque alterna presença), não para desktop.
  Tolerante a conexão ruim (ver §6 e §8).
- **Tom acolhedor profissional, não vendedor**: aluno é **beneficiário, não cliente** —
  botão "Quero participar" em vez de "Inscreva-se agora"; zero vocabulário de e-commerce
  (compra/oferta/upsell).
- **Matrícula leve**: grade de cards (thumb + nome + vagas + horário) + filtros leves + botão
  grande + **3 campos essenciais. Nunca 40 campos** (a Ficha Cidadã já tem o resto).
- **Trilha curta com fim claro**: "Você está na aula 12 de 20 — formatura em 12/ago".
- **Certificado com peso emocional** (pode ser o primeiro da vida do aluno): regra de presença
  do **CapacitaSUAS é 80%** → conclusão cerimonial (confete) + PDF com QR + compartilhar no
  WhatsApp em 1 clique.
- **Paleta/tipografia**: sans-serif humanista única cross-unidade (Inter/DM Sans — já coberto
  pelo `--ifp-font-family` dos tokens); identidade da unidade vem do accent laranja via
  `data-theme="capacitacao"` (já existe em `packages/design-tokens/tokens.css`). Cards raio
  8–12px, sombra suave.
- **Mascote do leão IFP**: só em momentos cerimoniais (certificado, boas-vindas) — **nunca no
  painel operacional**.

**O que a pesquisa manda NÃO copiar:**

- O **look ERP do Sponte** (denso, datado) — só o modelo de dados/fluxos.
- LMS digital pesado (vídeo-aulas, fóruns, gamificação): **presencial primeiro, digital apoia**.
- Funil comercial (carrinho, checkout, upsell) e formulários longos de matrícula.
- Fontes "arredondadas amigáveis" (Quicksand/Comic) e cor saturada como fundo.

**Ajustes que a pesquisa causou neste blueprint** (em relação à versão do workflow):

1. `presencaMinimaPct` default **75 → 80** (regra CapacitaSUAS), configurável por curso.
2. Tela de chamada rebaixada de "layout tablet" para **mobile-first (celular do instrutor)**,
   com retry otimista de rede no MVP.
3. Detalhe da turma ganha a **barra de trilha/progresso** ("aula X de Y — formatura em DD/MM")
   — barato (derivado da contagem de `Aula`) e é metade da tela-âncora da unidade.
4. Certificado: além do código verificável, **QR no PDF + botão de share WhatsApp** entram no MVP
   (a pesquisa trata a entrega do certificado como momento-chave, não como anexo).
5. Copy das telas revisada para tom beneficiário ("Quero participar", "Sua próxima aula").

## 3. GABARITO: anatomia real do módulo médico (replicar, não inventar)

Inspecionado em 2026-06-10 — `apps/api/src/medico/`:

```
apps/api/src/medico/
├── medico.module.ts            # @Module({ controllers: [...], providers: [...], exports: [AtendimentosService] })
├── agenda.controller.ts        # GET medico/agenda · GET medico/agenda/:id · POST medico/agendamentos/:id/iniciar
├── agenda.service.ts           # janelaDoDia, includes tipados (satisfies Prisma.AgendamentoInclude), $transaction
├── atendimentos.controller.ts  # PATCH soap · PUT vitais · POST encerrar
├── atendimentos.service.ts
├── profissionais.service.ts    # resolverPorUser + assertOwnership
└── dto/                        # list-agenda.query.ts, update-soap.dto.ts, upsert-vitais.dto.ts
```

Padrões confirmados a replicar no módulo `capacitacao`:

- **Guards por controller, não globais**: `@UseGuards(JwtAuthGuard, PerfisGuard)` +
  `@Perfis(Perfil.SUPER_ADMIN, Perfil.PROFISSIONAL)` **no nível da classe**, com override por
  handler quando preciso (o `PerfisGuard` usa `reflector.getAllAndOverride([handler, class])`).
  `ThrottlerGuard` é o único `APP_GUARD` global (`app.module.ts`).
- **Perfis reais do RBAC** (enum `Perfil` do schema): `SUPER_ADMIN`, `PRESIDENCIA`,
  `SERVICO_SOCIAL`, `GESTOR_UNIDADE`, `PROFISSIONAL`, `RECEPCAO`, `RESPONSAVEL_FAMILIAR`.
  **Não existem perfis "GESTOR" nem "INSTRUTOR"** — o instrutor é um `Profissional`
  (perfil `PROFISSIONAL`) lotado na unidade CAPACITACAO; a gestora é `GESTOR_UNIDADE`.
- **Identidade**: `@CurrentUser() user: AuthenticatedUser` (decorator em
  `auth/current-user.decorator.ts`).
- **Ownership**: `ProfissionaisService.resolverPorUser(user)` (403 se sem cadastro ativo) +
  `assertOwnership(donoId, profissional, user)` com bypass de `SUPER_ADMIN`. Atenção: esse
  service é **privado do `MedicoModule`** (não exportado) e tem mensagem hardcoded
  "Centro Médico" — **extrair para um módulo compartilhado** (ex.: `src/profissionais/`)
  parametrizando a mensagem, ou replicar localmente (decisão no §8).
- **Auditoria**: `AuditService.registrar(...)` é **fire-and-forget** (falha de audit nunca
  bloqueia a operação; só loga). Leitura de dado sensível registra `AcaoAuditoria.READ`
  (ex.: abrir a prancha audita a leitura do prontuário).
- **Selo de imutabilidade**: `Atendimento.encerradoEm` → escrita pós-selo responde **409**.
  Mesmo padrão para `Aula.encerradaEm` aqui.
- **Transação**: criação encadeada usa `prisma.$transaction(async (tx) => ...)`.
- **Swagger**: `@ApiTags`, `@ApiBearerAuth`, `@ApiOperation`, `@ApiParam` em tudo.
- **Front**: páginas direto em `apps/web/app/<unidade>/` (**não existe grupo `(unidades)`**),
  com `layout.tsx` fazendo guard de sessão server-side (`getServerSession` + array
  `PERFIS_PERMITIDOS`) e wrapper `<div data-theme="capacitacao">` — copiar
  `apps/web/app/medico/layout.tsx` trocando tema/perfis/título.

## 4. Modelos Prisma essenciais

Arquivo: `packages/database/schema.prisma`. O roadmap no fim do schema (linhas 548-558) já
prescreve exatamente `Curso, Turma, Matricula, AulaPlano, Presenca, Certificado`.

```prisma
// ── Capacitação ──────────────────────────────────────────────

enum ModalidadeCurso {
  PRATICO
  TEORICO
}

enum StatusTurma {
  INSCRICOES_ABERTAS
  EM_ANDAMENTO
  ENCERRADA
}

enum StatusMatricula {
  ATIVA
  LISTA_ESPERA
  TRANCADA
  EVADIDA
  CONCLUIDA
}

enum StatusPresenca {
  PRESENTE
  FALTA
  JUSTIFICADA
}

model Curso {
  id                String          @id @default(cuid())
  unidadeId         String
  unidade           Unidade         @relation(fields: [unidadeId], references: [id])
  nome              String
  modalidade        ModalidadeCurso
  cargaHorariaTotal Int             // horas planejadas
  presencaMinimaPct Int             @default(80) // CapacitaSUAS (pesquisa 2026-05-28); configurável por curso
  requerModelos     Boolean         @default(false) // gancho Fase 2 (Banco de Modelos)
  ativo             Boolean         @default(true)
  criadoEm          DateTime        @default(now())
  atualizadoEm      DateTime        @updatedAt
  turmas            Turma[]

  @@index([unidadeId])
  @@map("cursos")
}

model Turma {
  id             String       @id @default(cuid())
  unidadeId      String
  unidade        Unidade      @relation(fields: [unidadeId], references: [id])
  cursoId        String
  curso          Curso        @relation(fields: [cursoId], references: [id])
  codigo         String       @unique // "BB-2026-1"
  profissionalId String       // instrutor responsável
  instrutor      Profissional @relation(fields: [profissionalId], references: [id])
  diasHorario    String       // "Seg/Qua 14h-17h" (MVP: string; normalizar depois)
  sala           String?
  inicioEm       DateTime
  fimEm          DateTime?
  totalAulasPrevistas Int?    // alimenta a trilha "aula X de Y — formatura em DD/MM" (pesquisa)
  vagasTotais    Int
  status         StatusTurma  @default(INSCRICOES_ABERTAS)
  criadoEm       DateTime     @default(now())
  atualizadoEm   DateTime     @updatedAt
  matriculas     Matricula[]
  aulas          Aula[]

  @@index([unidadeId, status])
  @@map("turmas")
}

model Matricula {
  id            String          @id @default(cuid())
  unidadeId     String
  unidade       Unidade         @relation(fields: [unidadeId], references: [id])
  turmaId       String
  turma         Turma           @relation(fields: [turmaId], references: [id])
  fichaId       String          // família (vínculo hub, padrão Agendamento)
  ficha         FichaCidada     @relation(fields: [fichaId], references: [id])
  membroId      String?         // aluno quando é dependente; null = titular
  membro        MembroFamiliar? @relation(fields: [membroId], references: [id])
  status        StatusMatricula @default(ATIVA)
  posicaoEspera Int?            // só quando LISTA_ESPERA
  consentidoPorTitularEm DateTime? // obrigatório quando membro é menor (14–17, jovem aprendiz)
  criadoPor     String?         // userId administrativo (padrão do schema)
  criadoEm      DateTime        @default(now())
  atualizadoEm  DateTime        @updatedAt
  presencas     Presenca[]
  certificado   Certificado?

  @@unique([turmaId, fichaId, membroId]) // sem matrícula duplicada na mesma turma
  @@index([unidadeId, status])
  @@map("matriculas")
}

model Aula {
  id             String       @id @default(cuid())
  unidadeId      String
  unidade        Unidade      @relation(fields: [unidadeId], references: [id])
  turmaId        String
  turma          Turma        @relation(fields: [turmaId], references: [id])
  data           DateTime
  conteudo       String?
  profissionalId String       // quem lançou a chamada — FK forte (integridade do diário, como autoria clínica)
  instrutor      Profissional @relation(fields: [profissionalId], references: [id])
  encerradaEm    DateTime?    // "selo" — após encerrar, presenças travadas na aplicação (padrão Atendimento.encerradoEm)
  criadoEm       DateTime     @default(now())
  atualizadoEm   DateTime     @updatedAt
  presencas      Presenca[]

  @@index([turmaId, data])
  @@map("aulas")
}

model Presenca {
  id           String         @id @default(cuid())
  aulaId       String
  aula         Aula           @relation(fields: [aulaId], references: [id])
  matriculaId  String
  matricula    Matricula      @relation(fields: [matriculaId], references: [id])
  status       StatusPresenca
  criadoEm     DateTime       @default(now())
  atualizadoEm DateTime       @updatedAt

  @@unique([aulaId, matriculaId])
  @@map("presencas")
}

model Certificado {
  id                   String    @id @default(cuid())
  unidadeId            String
  unidade              Unidade   @relation(fields: [unidadeId], references: [id])
  matriculaId          String    @unique
  matricula            Matricula @relation(fields: [matriculaId], references: [id])
  codigoVerificacao    String    @unique @default(cuid()) // URL pública /verificar/:codigo (+ QR no PDF)
  cargaHorariaCumprida Int       // horas REALIZADAS, não planejadas
  presencaPct          Decimal   @db.Decimal(5, 2)
  emitidoEm            DateTime  @default(now())
  emitidoPor           String?   // userId administrativo

  @@map("certificados")
}
```

Pontos de pendura (padrões já existentes no schema):

- Matrícula referencia `FichaCidada` + `MembroFamiliar?` — **padrão exato de
  `Agendamento.fichaId/membroId`**.
- Instrutor = `Profissional` da unidade CAPACITACAO (lembrar: `Unidade.tipo` é `@unique`,
  uma unidade por tipo; slug `"capacitacao"` já previsto no comentário do schema).
- **Regra de ouro**: criar matrícula exige `ElegibilidadePorUnidade` com
  `StatusElegibilidade.APROVADO` para `(fichaId, unidade capacitacao)` — validada no service,
  nunca no front.
- A migração exige adicionar os **arrays de relação inversa** em `Unidade`, `FichaCidada`,
  `MembroFamiliar` e `Profissional` (Prisma pede os dois lados).

## 5. Endpoints do módulo `apps/api/src/capacitacao/`

Anatomia: `capacitacao.module.ts` + controllers/services/dto, espelhando `medico/`.
Classe: `@UseGuards(JwtAuthGuard, PerfisGuard)` + `@Perfis(...)` + `@Controller("capacitacao")`.

| Método/Rota | Perfis (`@Perfis`) | Observação |
|---|---|---|
| `GET /capacitacao/cursos` | SUPER_ADMIN, GESTOR_UNIDADE, PROFISSIONAL | catálogo (tela com whitespace — pesquisa) |
| `POST /capacitacao/cursos` | SUPER_ADMIN, GESTOR_UNIDADE | |
| `GET /capacitacao/turmas` · `GET /capacitacao/turmas/:id` | SUPER_ADMIN, GESTOR_UNIDADE, PROFISSIONAL | detalhe inclui freq%/evasão% derivados + progresso da trilha (aulas dadas / previstas) |
| `POST /capacitacao/turmas` | SUPER_ADMIN, GESTOR_UNIDADE | |
| `POST /capacitacao/turmas/:id/matriculas` | SUPER_ADMIN, GESTOR_UNIDADE, RECEPCAO | valida elegibilidade APROVADO; turma lotada → `LISTA_ESPERA` com `posicaoEspera`; menor exige `consentidoPorTitularEm`; grava `AuditLog` |
| `GET /capacitacao/turmas/:id/matriculas` | SUPER_ADMIN, GESTOR_UNIDADE, PROFISSIONAL | **instrutor NÃO recebe dados socioeconômicos** — DTO enxuto (nome, freq%) |
| `POST /capacitacao/turmas/:id/aulas` | PROFISSIONAL (ownership: `turma.profissionalId === profissional.id`) | abre a aula do dia |
| `PUT /capacitacao/aulas/:id/presencas` | PROFISSIONAL da turma | lote `[{matriculaId, status}]`; **idempotente** (suporta retry da chamada mobile); rejeita se `encerradaEm` → 409 |
| `PATCH /capacitacao/aulas/:id/encerrar` | PROFISSIONAL da turma | sela a chamada; `AuditLog` |
| `GET /capacitacao/turmas/:id/frequencia` | SUPER_ADMIN, GESTOR_UNIDADE | painel: freq% por aluno + flag risco (3 faltas seguidas OU >25% faltas) — **calculado no GET, sem job** |
| `POST /capacitacao/turmas/:id/encerrar` | SUPER_ADMIN, GESTOR_UNIDADE | `$transaction`: marca `ENCERRADA`, matrícula vira `CONCLUIDA`/`EVADIDA`, emite `Certificado` só p/ presença ≥ `curso.presencaMinimaPct` |
| `GET /verificar/certificados/:codigo` | **PÚBLICO (sem JwtAuthGuard)** | controller próprio `@Controller("verificar")` sem guards de auth (Throttler global cobre abuso); retorna nome + curso + CH + data, **CPF mascarado/ausente** |

Tenant: o médico resolve tenant via `Profissional.unidadeId` (ownership). Para a gestora
(que pode não ter cadastro de `Profissional`), validar vínculo via **`UsuarioUnidade`**
(user ↔ unidade capacitacao) no service — usuário de outra unidade recebe 403.

## 6. Telas web mínimas (`apps/web/app/capacitacao/`, `data-theme="capacitacao"` → laranja)

O tema `capacitacao` **já existe** em `packages/design-tokens/tokens.css`
(`--unidade: var(--ifp-orange-primary)`). Copiar o `layout.tsx` do médico
(guard de sessão + `PERFIS_PERMITIDOS = ["SUPER_ADMIN", "GESTOR_UNIDADE", "PROFISSIONAL"]`).

- `apps/web/app/capacitacao/layout.tsx` — guard + tema + header "Centro de Capacitação"
- `apps/web/app/capacitacao/page.tsx` — painel da gestora: KPIs + grade "saúde das turmas"
  (porta do protótipo `cap-painel`; **densidade média-alta** — pesquisa)
- `apps/web/app/capacitacao/turmas/page.tsx` — tabela de turmas (`cap-turmas`)
- `apps/web/app/capacitacao/turmas/[id]/page.tsx` — detalhe com abas Alunos / Frequência /
  Risco + **barra de trilha "aula X de Y — formatura em DD/MM"** (`cap-turma` + pesquisa)
- `apps/web/app/capacitacao/turmas/[id]/matriculas/page.tsx` — matrícula + lista de espera:
  grade de cards de turmas, botão grande **"Quero participar"**, 3 campos essenciais
  (`cap-matriculas` + pesquisa — nunca 40 campos)
- `apps/web/app/capacitacao/chamada/[turmaId]/page.tsx` — **tela do instrutor, mobile-first**
  (celular; funciona bem em tablet por consequência): lista com toggle de presença em
  **1 toque**, contador, encerrar; envio com **retry otimista** (fila local de PUTs pendentes
  re-tentados; PUT idempotente no back) — porta de `cap-chamada` ajustada pela pesquisa
- `apps/web/app/verificar/[codigo]/page.tsx` — verificação pública do certificado (fora do
  grupo autenticado), com peso visual cerimonial; o PDF do certificado leva **QR** apontando
  para esta URL + botão de **compartilhar no WhatsApp** (pesquisa)

## 7. Seed dev mínimo

```
1 Unidade tipo CAPACITACAO (slug "capacitacao")
1 User+Profissional instrutor "Rafael Dias" (unidade capacitacao) — perfil PROFISSIONAL
1 User gestora "Tânia Moraes" — perfil GESTOR_UNIDADE + UsuarioUnidade(capacitacao)
1 Curso "Barbeiro" PRATICO 160h, presencaMinimaPct 80
1 Turma "BB-2026-1", 6 vagas, Seg/Qua 14h-17h, totalAulasPrevistas 20, EM_ANDAMENTO
6 FichaCidada (ou reusar do seed médico) com ElegibilidadePorUnidade APROVADO na capacitacao
   + 1 ficha SEM elegibilidade (para testar o bloqueio de matrícula)
6 Matriculas ATIVA + 1 LISTA_ESPERA (7ª tentativa em turma de 6)
4 Aulas com Presencas variadas — 1 aluno com 3 faltas seguidas (dispara o flag de risco)
   e 1 aluno com presença < 80% (para testar a negativa de certificado)
```

## 8. Riscos / decisões

- **`Profissional.registroConselho` é obrigatório** no schema atual (`String`, linha ~417) —
  instrutor não tem conselho de classe. **Decisão necessária: migração tornando
  `registroConselho String?`**. Verificado no código do médico: `ProfissionaisService` e os
  services de agenda/atendimento **não validam** esse campo — impacto baixo, mas confirmar
  DTOs/telas que o exibem.
- **`ProfissionaisService` é privado do `MedicoModule`** (o módulo só exporta
  `AtendimentosService`) e a mensagem de erro cita "Centro Médico". Decisão: **extrair para
  módulo compartilhado** `src/profissionais/` (mensagem parametrizada por unidade) — preferível
  a duplicar; tocar o módulo médico só nesse import.
- **Dados socioeconômicos**: ficam no Serviço Social (módulo existente); capacitação só lê o
  STATUS da elegibilidade, nunca o parecer. DTO do instrutor não expõe nada da ficha além do nome.
- **Certificado público**: nunca expor CPF completo na rota `/verificar`; código `cuid`
  não-sequencial evita enumeração; Throttler global já cobre força bruta.
- **Menores (14–17, jovem aprendiz)**: matrícula de `MembroFamiliar` menor exige consentimento
  do titular — campo `consentidoPorTitularEm` na `Matricula` (promovido de "boolean ou AuditLog"
  para coluna, coerente com a linha de privacidade da pesquisa) + `AuditLog`.
- **Chamada em rede ruim** (pesquisa: "offline-tolerante"): MVP = retry otimista no client com
  PUT idempotente; **offline real (service worker/fila persistente) fica para a Fase 2** —
  registrar a limitação com a equipe.
- **Imutabilidade da chamada**: `Aula.encerradaEm` é selo de aplicação (mesmo padrão de
  `Atendimento.encerradoEm` → 409); retroativo só em janela curta com `AuditLog`.
- **Fora do MVP (Fase 2)**: Banco de Modelos/sessões práticas (termo de imagem revogável —
  reutilizar o módulo transversal `AutorizacaoImagem` do blueprint Educacional), trilha "metrô"
  completa da ementa, fila de interesse, notificações WhatsApp, Ponte da Corte automática na
  evasão (no MVP o flag de risco aparece no painel; o encaminhamento é manual).

## 9. Ordem de construção

1. **Migração Prisma** (modelos do §4 + `registroConselho` opcional + relações inversas) →
   validar: `prisma migrate dev` limpo + `prisma studio` mostra
   `cursos/turmas/matriculas/aulas/presencas/certificados`.
2. **Seed** → validar: rodar seed 2× sem erro (idempotente), studio mostra BB-2026-1 populada.
3. **Extração do `ProfissionaisService` compartilhado** + **Service+Controller de Curso/Turma
   (CRUD lean)** copiando a anatomia de `apps/api/src/medico/` → validar: `curl` autenticado
   listando turmas; usuário de outra unidade recebe 403; médico continua passando (regressão).
4. **Matrícula com regra de elegibilidade + lista de espera** → validar: ficha sem
   elegibilidade → 422; 7ª matrícula → `LISTA_ESPERA` posição 1; menor sem consentimento → 422.
5. **Aula + chamada + selo** (ownership do instrutor) → validar: instrutor B tenta lançar
   presença na turma do Rafael → 403; lançar após `encerradaEm` → 409; PUT repetido não duplica.
6. **Encerrar turma + certificados + rota pública de verificação** → validar: aluno com 60% NÃO
   recebe certificado; `GET /verificar/:codigo` sem token retorna dados mascarados.
7. **Telas web** (painel → turma com trilha → chamada mobile → verificação cerimonial) →
   validar: fluxo completo manual no navegador com o seed; flag de risco aparece para o aluno
   com 3 faltas; chamada usável em viewport de celular (375px).
