# F1.B.2 — Prontuário Médico (3 colunas, estilo Elation Health)

**Data:** 2026-05-31
**Status:** DRAFT — aguardando revisão/aprovação do Erick (especialmente o §0). NÃO é spec final.
**Roadmap pai:** `docs/superpowers/roadmap/2026-05-28-roadmap-produto.md` (F1.B Médico, sub-módulo 2)
**Spec irmã (base):** `docs/superpowers/specs/2026-05-28-medico-agenda-fila-design.md` (F1.B.1, entregue em `c86b5a8`)
**Referência visual:** Elation Health (prontuário 3 colunas) + Doctolib (já usado em F1.B.1)

> Este documento estrutura o problema e expõe as decisões que só o Erick pode tomar (§0).
> Depois que ele escolher as direções, vira plano de implementação TDD detalhado.
> **Toda suposição está marcada com `[SUPOSIÇÃO]`.**

---

## §0 — DECISÕES EM ABERTO (precisam do Erick)

Esta é a parte mais importante. Cada item tem opções reais, o trade-off e a minha **recomendação** (que ele confirma — não é decisão tomada). A escolha aqui muda o modelo de dados e a UI da coluna central, então quero fechar antes de codar.

### 0.1 — FORMATO DA NOTA DE EVOLUÇÃO

- **Opção A — SOAP estruturado:** 4 campos separados (Subjetivo / Objetivo / Avaliação / Plano). Padrão clínico clássico, dados consultáveis, ajuda médico iniciante.
- **Opção B — Texto livre único:** um campo rich-text. Mais rápido pra quem já tem ritmo, menos "engessado", mas vira caixa-preta (difícil extrair indicador, difícil padronizar).
- **Opção C — Híbrido:** um campo de texto livre principal + campos estruturados opcionais (sinais vitais, CID) ao redor. Não força SOAP, mas captura o que é estruturável.
- **Trade-off:** A favorece padronização/relatório futuro e ensino; B favorece velocidade e adesão; C tenta os dois mas tem mais UI.
- **recomendação:** **Opção C (híbrido)** — campo de evolução livre (`texto`) + blocos estruturados opcionais (sinais vitais §0.5, CID §0.6) na mesma nota. Equipe é voluntária e multi-especialidade (odonto/psicologia/fisio não usam SOAP igual ao clínico); forçar SOAP nessa população reduz adesão. Se ele quiser SOAP, viro o campo `texto` em 4 campos `subjetivo/objetivo/avaliacao/plano` — é só trocar a forma do model `NotaEvolucao`.

### 0.2 — GRANULARIDADE (o que a coluna "histórico" puxa)

- **Opção A — Evolução 1:1 por Consulta:** cada Consulta tem no máximo uma nota. Coluna histórico = lista de consultas anteriores do cidadão (cross-profissional).
- **Opção B — Prontuário longitudinal por Cidadao:** entidade `Prontuario` por cidadão; cada atendimento adiciona uma `NotaEvolucao` datada; coluna histórico = timeline de todas as notas independente de consulta.
- **Trade-off:** A é mais simples e casa direto com a Consulta que já existe; B é o modelo "de verdade" de prontuário longitudinal (Elation), mas exige uma entidade-raiz a mais e re-pensar notas sem consulta (ex.: anotação avulsa).
- **recomendação:** **Híbrido pragmático** — `NotaEvolucao` é a unidade, **ligada à Consulta** (`consultaId`, herda `cidadaoId/profissionalId`). A coluna histórico consulta por `cidadaoId` (longitudinal, cross-profissional) ordenando por data. Ganhamos a visão longitudinal do B sem criar um model `Prontuario` separado agora. `[SUPOSIÇÃO]` Nota avulsa sem consulta fica fora do F1.B.2 (toda nota nasce de um atendimento agendado).

### 0.3 — QUEM EDITA / ASSINA / IMUTABILIDADE

- **Opção A — Dono + gestor editam sempre:** profissional dono e gestor (Raquel) editam a qualquer hora. Simples, mas fere o princípio de prontuário (registro não pode ser silenciosamente reescrito).
- **Opção B — Editável só em `em_atendimento`, congela ao "assinar"/`realizada`:** profissional escreve durante o atendimento; ao marcar `realizada` (= assinar) a nota vira imutável; correções viram **addendo** (§0.4). Gestor NÃO edita conteúdo clínico (só lê + audita).
- **Opção C — Janela de graça:** como B mas com janela curta (ex. 24h) pra corrigir antes de congelar.
- **Trade-off:** A é frágil pro CFM; B é o correto clinicamente e o mais defensável; C alivia erro de digitação mas adiciona estado temporal.
- **recomendação:** **Opção B**. Só o profissional **dono** edita, e só enquanto a consulta está `em_atendimento` (rascunho). Marcar `realizada` = ato de assinatura → nota fica `assinada` e imutável. Correção depois = addendo append-only. Gestor/super_admin têm leitura + audit, nunca edição de conteúdo. Recepção (Maria) nunca vê conteúdo clínico. Isso amarra a state machine de Consulta de F1.B.1 (a transição `em_atendimento → realizada` ganha a semântica "assinar prontuário").

### 0.4 — VERSIONAMENTO / AUDITORIA CFM

- **Opção A — Versões com diff:** cada save mantém versão anterior, UI mostra diffs. Poderoso, mas caro de construir e de explicar.
- **Opção B — Append-only com addendos:** nota assinada é imutável; correção/complemento = novo registro `AddendoNota` carimbado (autor + timestamp + texto), nunca reescreve o original. É o modelo padrão de prontuário eletrônico.
- **Trade-off:** A dá histórico fino mas é overkill pro estágio; B é o suficiente pro CFM e bem mais barato.
- **recomendação:** **Opção B (append-only + addendos)**. Novas `AuditAction`: **`prontuario_criado`**, **`prontuario_assinado`**, **`prontuario_addendo`**, e o **`medical_data_accessed`** (que já existe sem caller — §0.8) passa a ser disparado em toda abertura. Sem diffs/versões agora. `[SUPOSIÇÃO]` Assinatura é "lógica" (carimbo userId+timestamp), não certificado ICP-Brasil/A3 — assinatura digital qualificada fica pra um plano futuro (relaciona com Memed/Plano 8).

### 0.5 — SINAIS VITAIS / ANTROPOMETRIA

- **Opção A — Campos numéricos estruturados:** PA sistólica/diastólica, FC, FR, Temp, Peso, Altura, SatO2 — todos numéricos; IMC calculado. Permite gráfico de evolução, validação de range.
- **Opção B — Texto livre:** um campo "sinais vitais". Rápido, zero gráfico, zero validação.
- **Trade-off:** A habilita evolução de peso/PA ao longo do tempo (valor clínico real) ao custo de mais campos; B é trivial mas joga fora o dado.
- **recomendação:** **Opção A estruturada, mas todos opcionais** — bloco `SinaisVitais` embutido na `NotaEvolucao` (campos nullable: `paSistolica`, `paDiastolica`, `fcBpm`, `frIrpm`, `tempC`, `pesoKg`, `alturaCm`, `spo2`). IMC **derivado** (não persistido) de peso/altura. Validação de range só como warning (não bloqueia). `[SUPOSIÇÃO]` Não fazemos curva de crescimento pediátrica (percentil OMS) agora — adiada.

### 0.6 — DIAGNÓSTICO / PROBLEMAS (CID-10)

- **Opção A — CID-10 com autocomplete:** tabela de referência CID-10 importada; campo `diagnosticos` com código + descrição. Profissional + relatório futuro ganham padronização.
- **Opção B — Texto livre:** médico escreve o diagnóstico em prosa.
- **Opção C — Problem list longitudinal:** lista de problemas do cidadão (ativo/resolvido) que persiste entre consultas (estilo Elation "Problem List").
- **Trade-off:** A precisa carregar a tabela CID-10 (~14k linhas, dado público DATASUS) e UI de busca; B é trivial mas inútil pra indicador; C é o ideal de prontuário longitudinal mas é um sub-módulo por si só.
- **recomendação:** **Opção A no F1.B.2** (CID-10 por nota, autocomplete, múltiplos por nota, com `principal: boolean`), **Problem list longitudinal (C) ADIADA** pra um F1.B.x futuro. CID por nota já dá padronização sem o peso de gerenciar ciclo de vida de problema. `[SUPOSIÇÃO]` Importar CID-10 do CSV público DATASUS num seed; sem CID, o campo aceita texto livre como fallback pra não travar atendimento.

### 0.7 — RELAÇÃO COM OS CAMPOS DE SAÚDE DO CIDADÃO

Hoje `Cidadao` tem `tipoSanguineo`, `alergias`, `medicamentosEmUso`, `condicoesCronicas` (Text), editáveis **só** pelo form genérico `/app/cidadaos`.

- **Opção A — Read-only no prontuário:** coluna "contexto" mostra esses campos só pra leitura; pra editar, o médico vai ao form genérico. Sem retrabalho, mas fricção (sai do prontuário).
- **Opção B — Editável a partir do prontuário:** o profissional atualiza alergias/condições/medicamentos direto da coluna esquerda; gera audit (`ficha_updated` ou nova action). É o fluxo Elation (o médico mantém o "contexto" do paciente).
- **Trade-off:** A é menos código e menos risco; B é o fluxo clínico correto (médico é quem sabe a alergia), mas precisa de permissão + audit + cuidado de concorrência com o form genérico.
- **recomendação:** **Opção B, restrita ao profissional** — coluna esquerda mostra os 4 campos de saúde + (read-only) os socioeconômicos relevantes; o **profissional** pode editar os 4 campos clínicos inline, gerando audit `cidadao_saude_atualizada` (nova action, `rootEntityType: 'cidadao'`). Recepção/social não editam. `[SUPOSIÇÃO]` Mantemos os campos como Text no Cidadao por ora (não migramos alergias pra tabela estruturada) — estruturar vira item futuro junto da problem list (§0.6 C).

### 0.8 — LGPD: DADO DE SAÚDE (categoria especial)

Prontuário é **dado sensível de saúde** (LGPD art. 11) — exige tratamento reforçado.

- **Base legal:** `[SUPOSIÇÃO]` tutela da saúde por profissional de saúde (art. 11, II, "f") + execução de política pública de assistência (IFP é instituto social). **Erick confirma** que o IFP enquadra como prestação de serviço de saúde sem fins lucrativos.
- **Acesso registrado:** toda abertura de prontuário dispara **`medical_data_accessed`** (tipo já existe em `audit.ts` sem caller) com `userId + cidadaoId + consultaId`. Isto materializa o "quem leu o prontuário de quem".
- **Retenção:** prontuário tem **retenção legal LONGA** (CFM Res. 1.821/2007: mínimo 20 anos do último registro) — **diferente** da retenção do audit log (que pode ser mais curta) e do soft-delete/anonimização do Cidadao. O direito ao esquecimento LGPD **não** apaga prontuário dentro do prazo legal de guarda (exceção legal).
- **recomendação a confirmar:** (1) registrar `medical_data_accessed` em toda leitura; (2) anonimização do Cidadao (`anonimizadoEm`) **NÃO** apaga `NotaEvolucao` — só desvincula PII do cabeçalho, preservando o registro clínico pelo prazo legal; (3) documentar a base legal no ROPA (F3.A LGPD operacional). **Decisão de Erick:** confirmar base legal e a regra "anonimizar cidadão ≠ apagar prontuário".

### 0.9 — FRONTEIRA F1.B.2 × F1.B.3 (coluna direita)

- **Opção A — Coluna direita = placeholder inerte:** no F1.B.2 a coluna direita ("ações") mostra só cabeçalhos desabilitados "Prescrição (em breve)" / "Encaminhamento (em breve)" / "Atestado (em breve)". Prescrição PDF + encaminhamento + atestado = 100% F1.B.3.
- **Opção B — Botões já funcionais simples:** entregar já um "encaminhar pra outra unidade/profissional" básico no F1.B.2.
- **Trade-off:** A mantém o escopo enxuto e o módulo focado em registrar a evolução (o que tem valor sozinho); B antecipa valor mas infla o módulo e mistura com F1.B.3.
- **recomendação:** **Opção A** — coluna direita é placeholder inerte no F1.B.2, confirmando que **prescrição PDF + encaminhamento + atestado = F1.B.3** e **Memed = Plano 8**. Mantém o padrão de F1.B.1 (que já deixou o prontuário como placeholder anunciado).

---

## 1. Contexto e objetivo

O Centro Médico do IFP (público vulnerável em Duque de Caxias, ambição "primeiro mundo") já tem, desde F1.B.1: profissionais, especialidades, agenda multi-profissional, fila do dia e a state machine de Consulta (`agendada → confirmada → em_atendimento → realizada/faltou/cancelada`). O **registro clínico do que aconteceu no atendimento ainda não existe** — `Consulta` tem ZERO campo clínico e não há nenhum model de nota/evolução.

**Objetivo do F1.B.2:** dar ao profissional, dentro de `/medico/consultas/[id]`, um **prontuário em 3 colunas estilo Elation Health**:

- **Esquerda — Contexto/Histórico:** dados de saúde do cidadão (alergias, condições, medicamentos, tipo sanguíneo) + timeline longitudinal de atendimentos anteriores (cross-profissional).
- **Centro — Evolução:** a nota do atendimento atual (formato definido em §0.1), com sinais vitais (§0.5) e CID (§0.6); editável em rascunho, assinada ao concluir (§0.3/§0.4).
- **Direita — Ações:** placeholder inerte de prescrição/encaminhamento/atestado (§0.9 → F1.B.3).

**UI hook existente:** `src/app/medico/consultas/[id]/page.tsx:143-158` já tem o card "Prontuário · Em breve" e o layout já é 2-col (`grid lg:grid-cols-[1.5fr_1fr]`); este módulo o substitui pelo layout 3-col real.

**Valor isolado:** mesmo sem prescrição (F1.B.3), registrar evolução já substitui a parte mais sensível do Amplimed externo e cria o histórico longitudinal que dá contexto ao próximo atendimento.

---

## 2. Modelo de dados PROPOSTO (Prisma — PROVISÓRIO, ramifica no §0)

> Marcado provisório: a forma exata depende de §0.1 (SOAP vs híbrido), §0.5, §0.6. O sketch abaixo assume as recomendações (híbrido + vitais estruturados + CID por nota + append-only).

```prisma
/// Nota clínica de evolução. 1:1 com Consulta (§0.2). Unidade do prontuário.
/// Imutável após assinatura (§0.3/§0.4); correções via AddendoNota.
model NotaEvolucao {
  id             String        @id @default(cuid())
  consultaId     String        @unique          // §0.2: nasce de um atendimento
  cidadaoId      String                          // desnormalizado p/ query longitudinal
  profissionalId String                          // autor (dono da consulta)

  // §0.1 recomendação C (híbrido). Se Erick escolher SOAP, trocar `texto`
  // por subjetivo/objetivo/avaliacao/plano (4 @db.Text).
  texto          String?       @db.Text

  // §0.5 sinais vitais (todos opcionais; IMC derivado, não persistido)
  paSistolica    Int?
  paDiastolica   Int?
  fcBpm          Int?
  frIrpm         Int?
  tempC          Decimal?      @db.Decimal(4, 1)
  pesoKg         Decimal?      @db.Decimal(5, 2)
  alturaCm       Int?
  spo2           Int?

  // §0.3/§0.4 ciclo de vida da assinatura
  status         StatusNota    @default(rascunho) // rascunho | assinada
  assinadaEm     DateTime?
  assinadaPor    String?                          // userId (= profissional dono)

  consulta       Consulta      @relation(fields: [consultaId], references: [id], onDelete: Restrict)
  cidadao        Cidadao       @relation(fields: [cidadaoId], references: [id], onDelete: Restrict)
  profissional   Profissional  @relation(fields: [profissionalId], references: [id], onDelete: Restrict)
  diagnosticos   DiagnosticoNota[]
  addendos       AddendoNota[]

  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  @@index([cidadaoId, createdAt])   // coluna histórico (longitudinal)
  @@index([profissionalId])
}

enum StatusNota {
  rascunho
  assinada
}

/// §0.4 — correção/complemento append-only de nota assinada. Nunca reescreve.
model AddendoNota {
  id        String        @id @default(cuid())
  notaId    String
  autorId   String                            // userId
  texto     String        @db.Text
  nota      NotaEvolucao  @relation(fields: [notaId], references: [id], onDelete: Restrict)
  createdAt DateTime      @default(now())

  @@index([notaId, createdAt])
}

/// §0.6 — CID-10 por nota. `principal` marca o diagnóstico principal.
/// codigo aceita texto livre como fallback se CID não importado.
model DiagnosticoNota {
  id         String        @id @default(cuid())
  notaId     String
  codigoCid  String?                          // ex. "J06.9"
  descricao  String                           // texto livre OU descrição do CID
  principal  Boolean       @default(false)
  nota       NotaEvolucao  @relation(fields: [notaId], references: [id], onDelete: Cascade)
  createdAt  DateTime      @default(now())

  @@index([notaId])
  @@index([codigoCid])
}

/// §0.6 — tabela de referência CID-10 (seed do CSV DATASUS). Read-only.
model Cid10 {
  codigo    String  @id          // "J06.9"
  descricao String
  capitulo  String?

  @@index([descricao])
}
```

**Relações a adicionar nos models existentes:**

- `Consulta` → `notaEvolucao NotaEvolucao?` (0..1).
- `Cidadao` → `notasEvolucao NotaEvolucao[]`.
- `Profissional` → `notasEvolucao NotaEvolucao[]`.

**Campos de saúde do Cidadão (§0.7):** mantidos como estão (`alergias/medicamentosEmUso/condicoesCronicas/tipoSanguineo` Text). Sem migração estrutural agora.

---

## 3. Rotas / Telas

Sem rota nova: o prontuário **vive dentro** de `/medico/consultas/[id]` (substitui o placeholder atual). Layout muda de 2-col para 3-col.

```
src/app/medico/consultas/[id]/page.tsx        # EDITA: 3 colunas (contexto · evolução · ações)
src/app/medico/consultas/[id]/prontuario-actions.ts  # NOVO: salvar rascunho, assinar, addendo, atualizar saúde cidadão
src/components/medico/prontuario/
  contexto-coluna.tsx        # esquerda: saúde do cidadão (editável §0.7) + timeline histórico
  evolucao-coluna.tsx        # centro: form da nota + sinais vitais + CID
  acoes-coluna.tsx           # direita: placeholders inertes (§0.9)
  sinais-vitais-fields.tsx   # bloco numérico §0.5 (IMC derivado client-side)
  cid-autocomplete.tsx       # §0.6
  timeline-atendimentos.tsx  # lista longitudinal de NotaEvolucao por cidadaoId
src/lib/medico/prontuario.ts # NOVO: lib pura + transacional (espelha agenda.ts)
```

**Layout da `/medico/consultas/[id]` (3 colunas):**

- Header: igual ao atual (cidadão + slot + badge de status).
- Linha de ações de transição: igual (já existe). A transição `em_atendimento → realizada` ganha gate: **só conclui se a nota foi assinada** `[SUPOSIÇÃO]` (ou aceita "concluir sem nota" com confirmação — decisão menor pra §3 do plano).
- Grid `lg:grid-cols-[1fr_1.6fr_1fr]`:
  - **Esquerda (contexto):** Card saúde (4 campos, editável inline se profissional) + Card timeline de atendimentos anteriores (data, profissional, especialidade, snippet; clicável → abre nota).
  - **Centro (evolução):** Card form. Em `em_atendimento` = editável (textarea + vitais + CID + botão "Assinar e concluir"). Em `realizada` = read-only assinada + lista de addendos + botão "Adicionar addendo".
  - **Direita (ações):** Cards desabilitados "Prescrição / Encaminhamento / Atestado — chega no F1.B.3".

---

## 4. RBAC

Reusa `src/lib/medico/rbac.ts` (padrão de F1.B.1). Novas capabilities:

| Capability                        | super_admin | gestor_unidade | profissional (dono) | profissional (outro) | recepcao | social |
| --------------------------------- | :---------: | :------------: | :-----------------: | :------------------: | :------: | :----: |
| Ver prontuário (conteúdo clínico) |      ✓      |       ✓        |          ✓          |      ✓ leitura       |    —     |   —    |
| Criar/editar nota (rascunho)      |      —      |       —        |          ✓          |          —           |    —     |   —    |
| Assinar nota                      |      —      |       —        |          ✓          |          —           |    —     |   —    |
| Adicionar addendo                 |      —      |       —        |      ✓ (autor)      | ✓ (próprio addendo)  |    —     |   —    |
| Editar saúde do cidadão (§0.7)    |      —      |       —        |          ✓          |          —           |    —     |   —    |
| Ver timeline histórico            |      ✓      |       ✓        |          ✓          |          ✓           |    —     |   —    |

Notas (a confirmar no §0): **conteúdo clínico fica oculto pra recepcao e social** — eles só veem o card de status/horário da consulta, não a nota. Gestor lê + audita mas **não edita** conteúdo clínico (§0.3). Novas funções: `podeVerProntuario`, `podeEditarNota`, `podeAssinarNota`, `podeAtualizarSaudeCidadao`.

---

## 5. Fluxos principais

**Fluxo A — Atendimento com evolução:**

1. Maria faz check-in → consulta `em_atendimento`.
2. Dr. João abre `/medico/consultas/[id]` → dispara `medical_data_accessed` (§0.8).
3. Lê contexto (alergias/condições) na esquerda; vê últimas 3 notas na timeline.
4. Escreve evolução no centro, preenche PA/peso, adiciona CID "J06.9".
5. "Assinar e concluir" → transação: cria/atualiza `NotaEvolucao` `status=assinada` + assinadaEm/Por + transiciona consulta `realizada` + audit `prontuario_assinado`.
6. Nota vira read-only.

**Fluxo B — Correção pós-assinatura (addendo):**

1. Dr. João reabre a consulta `realizada`.
2. Nota aparece read-only; clica "Adicionar addendo" → escreve correção → salva.
3. `AddendoNota` criado (append-only); audit `prontuario_addendo`. Nota original intacta.

**Fluxo C — Próximo atendimento usa histórico:**

1. Semanas depois, outra consulta do mesmo cidadão (mesmo ou outro profissional).
2. Coluna esquerda já mostra a nota anterior na timeline → contexto longitudinal (valor central do Elation).

**Fluxo D — Médico atualiza alergia (§0.7):**

1. Durante atendimento, paciente relata nova alergia.
2. Dr. João edita o campo `alergias` inline na coluna esquerda → salva → audit `cidadao_saude_atualizada` (rootEntity `cidadao`).

---

## 6. Auditoria / lib (espelha `agenda.ts`)

`src/lib/medico/prontuario.ts` — funções puras + transacionais, com `logEvent` chamado nas server actions (mesmo padrão de `consultas/[id]/actions.ts`):

- `salvarRascunho(consultaId, dados)` — upsert da nota enquanto `em_atendimento`; rejeita se já `assinada` (`NotaAssinadaError`).
- `assinarNota(notaId, userId)` — transação: valida dono + consulta `em_atendimento`, seta `assinada`, transiciona consulta → `realizada`.
- `adicionarAddendo(notaId, autorId, texto)` — só em nota `assinada`.
- `registrarAcessoProntuario(userId, cidadaoId, consultaId)` — wrapper de `medical_data_accessed`.

**Novas `AuditAction`** (adicionar em `audit.ts`): `prontuario_criado`, `prontuario_assinado`, `prontuario_addendo`, `cidadao_saude_atualizada`. O `medical_data_accessed` (já definido) ganha seu primeiro caller.

---

## 7. Sub-tasks (alto nível — TDD detalhado vem após §0)

1. Migration Prisma: `NotaEvolucao` + `AddendoNota` + `DiagnosticoNota` + `Cid10` + enum `StatusNota` + relações nos models existentes.
2. Seed CID-10 do CSV DATASUS (`Cid10`) + 2 notas demo assinadas pra cidadão demo.
3. `lib/medico/prontuario.ts` puro: validação de vitais (range warning), cálculo IMC, regras de transição de `StatusNota` (~8 unit tests).
4. `lib/medico/prontuario.ts` transacional: `salvarRascunho`, `assinarNota` (amarra `transicionarConsulta`), `adicionarAddendo`, erros (`NotaAssinadaError`) (~8 unit tests).
5. `lib/medico/rbac.ts`: `podeVerProntuario`, `podeEditarNota`, `podeAssinarNota`, `podeAtualizarSaudeCidadao` (~10 unit tests).
6. Novas `AuditAction` + caller de `medical_data_accessed` no load da página.
7. Componente `sinais-vitais-fields.tsx` (IMC derivado client-side).
8. Componente `cid-autocomplete.tsx` (busca em `Cid10`, fallback texto livre).
9. Componente `evolucao-coluna.tsx` (form rascunho / read-only assinada + addendos).
10. Componente `contexto-coluna.tsx` (saúde editável §0.7 + timeline).
11. Componente `timeline-atendimentos.tsx` (query longitudinal por `cidadaoId`).
12. Componente `acoes-coluna.tsx` (placeholders inertes §0.9).
13. Reescrever `consultas/[id]/page.tsx` pra layout 3-col + `prontuario-actions.ts`.
14. Gate na transição `realizada` (exige nota assinada ou confirma sem nota).
15. E2e: escrever+assinar evolução; addendo append-only; histórico longitudinal aparece; recepção NÃO vê conteúdo clínico; `medical_data_accessed` logado.
16. Verificação: `pnpm typecheck && pnpm lint && pnpm test` + build prod limpos.

---

## 8. Não-objetivos (F1.B.2 NÃO entrega)

- **Prescrição (PDF), encaminhamento, atestado** → F1.B.3 (coluna direita é placeholder inerte, §0.9).
- **Integração Memed** → Plano 8.
- **Assinatura digital qualificada (ICP-Brasil/A3)** → futuro; assinatura aqui é lógica (carimbo userId+timestamp).
- **Problem list longitudinal** (lista de problemas ativo/resolvido por cidadão) → F1.B.x futuro (§0.6 C).
- **Curva de crescimento pediátrica / percentil OMS** → futuro (§0.5).
- **Versionamento com diff** das notas → fora; usamos append-only/addendo (§0.4).
- **Estruturar alergias/medicamentos em tabela própria** → fora; ficam Text no Cidadao (§0.7).
- **Nota avulsa sem consulta** → fora; toda nota nasce de um atendimento (§0.2).
- **LGPD operacional completo (ROPA, consentimento versionado)** → F3.A; aqui só base legal + `medical_data_accessed` + regra de retenção.
- **Templates de evolução / texto pronto por especialidade** → futuro.

---

## 9. LGPD / compliance (resumo — detalhe em §0.8)

- Prontuário = dado sensível de saúde (LGPD art. 11). Base legal a confirmar pelo Erick: tutela da saúde (art. 11, II "f") + política pública de assistência social.
- Toda abertura registra `medical_data_accessed` (rastreabilidade de acesso a dado clínico).
- Retenção legal longa (CFM Res. 1.821/2007: ≥20 anos) — independente da retenção do audit log e do soft-delete do Cidadao.
- Anonimização do Cidadao (`anonimizadoEm`) **não** apaga `NotaEvolucao` dentro do prazo legal (exceção LGPD por obrigação legal de guarda) — só desvincula PII de cabeçalho.
- Conteúdo clínico oculto de recepção/social via RBAC (§4).

---

## 10. Critérios de sucesso (provisório — depende do §0)

- [ ] Profissional escreve evolução em `em_atendimento` e assina → nota imutável.
- [ ] Após assinar, só addendo (append-only); original nunca muda.
- [ ] Coluna esquerda mostra histórico longitudinal cross-profissional do cidadão.
- [ ] Sinais vitais numéricos + IMC derivado; CID via autocomplete com fallback texto.
- [ ] Profissional atualiza alergia inline → audit `cidadao_saude_atualizada`.
- [ ] `medical_data_accessed` logado em toda abertura.
- [ ] Recepção/social NÃO veem conteúdo clínico.
- [ ] Coluna direita é placeholder inerte (prescrição/encaminhamento = F1.B.3).
- [ ] `pnpm typecheck && pnpm lint && pnpm test` + build prod verdes; E2e cenários acima verdes.

---

## 11. Dependências

- F1.B.1 entregue (`c86b5a8`): Consulta + state machine + `transicionarConsulta` + `medico/rbac.ts` + `medico/ui.ts`.
- `audit.ts` (`logEvent` + `medical_data_accessed` já tipado).
- Campos de saúde do Cidadao já existentes.
- DS v2 (Card/Badge/Input). Layout 3-col precisa caber responsivo (mobile = empilha; tablet recepção = pode esconder coluna clínica).
- CSV CID-10 público DATASUS pro seed `[SUPOSIÇÃO]`.
- **frontend-design** para a coluna central (densidade de prontuário é o coração da sensação "Elation").
