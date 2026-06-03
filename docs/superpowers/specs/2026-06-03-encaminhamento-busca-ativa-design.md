# Spec — Encaminhamento + Busca Ativa no Callcenter (Médico, Fase 1)

**Data:** 2026-06-03
**Módulo:** `/medico` (Centro Médico, F1.B)
**Status:** design aprovado por Erick (3 seções), pronto para plano de implementação.

## Objetivo

Hoje o fluxo de especialista tem um buraco: o clínico geral atende, decide que o paciente
precisa de um especialista (ex.: Psiquiatria), e o paciente **tem que voltar ao callcenter por
conta própria** para marcar. Quem esquece de voltar **some** entre o GP e o especialista — e o
sistema não enxerga isso hoje.

A Fase 1 fecha esse buraco com **busca ativa**: o pedido do GP vira um **Encaminhamento**
rastreável que cai numa **fila no callcenter**. A instituição passa a _puxar_ o paciente em vez de
esperar ele lembrar de ligar. Sem WhatsApp (Fase 2), sem urgência (o centro só faz rotina).

### Fluxo-alvo

```
GP atende → registra o PEDIDO "encaminhar para [especialidade]" (+ motivo)
          → Encaminhamento(status=aguardando_agendamento)
Callcenter → vê a fila "A agendar" (mais antigo primeiro, "esperando há N dias")
          → "Agendar" reaproveita o wizard de nova consulta (cidadão+especialidade pré-preenchidos)
          → escolhe profissional + slot (a data mais próxima/melhor, seg–sex)
          → reserva: Consulta nasce ligada ao encaminhamento; encaminhamento → agendado (some da fila)
```

**Quem faz o quê:** o **profissional/GP** cria o pedido; a **atendente do callcenter/recepção**
escolhe a data e agenda. O clínico NÃO define data nem prazo.

## Modelo de dados

### Enum

```prisma
enum StatusEncaminhamento {
  aguardando_agendamento
  agendado
  cancelado
}
```

### Modelo `Encaminhamento`

| Campo                     | Tipo                                                    | Nota                                |
| ------------------------- | ------------------------------------------------------- | ----------------------------------- |
| `id`                      | String cuid                                             |                                     |
| `cidadaoId`               | String (FK Cidadao, Restrict)                           | o paciente                          |
| `consultaOrigemId`        | String (FK Consulta, Restrict)                          | consulta do GP onde nasceu          |
| `especialidadeId`         | String (FK Especialidade, Restrict)                     | especialidade-alvo                  |
| `motivo`                  | String? `@db.Text`                                      | livre, ex.: "ansiedade e depressão" |
| `status`                  | StatusEncaminhamento `@default(aguardando_agendamento)` |                                     |
| `createdBy`               | String                                                  | userId do profissional que pediu    |
| `canceladoMotivo`         | String?                                                 |                                     |
| `createdAt` / `updatedAt` | DateTime                                                |                                     |

Índices: `@@index([status, createdAt])` (a fila), `@@index([cidadaoId])`.
Relações reversas novas: `Cidadao.encaminhamentos`, `Consulta.encaminhamentosOrigem`,
`Especialidade.encaminhamentos`.

### Ligação com a consulta agendada

Adicionar em `Consulta`: `origemEncaminhamentoId String?` **com relação FK** para
`Encaminhamento` (espelha o `origemTriagemId` já existente, mas como FK de verdade). Reverso:
`Encaminhamento.consultasAgendadas Consulta[]` (na prática 0 ou 1 ativa; lista evita travar
re-agendamento futuro). **Sem campo de prazo** — a data sai da disponibilidade de slots.

## Máquina de estados

Espelha o padrão `TRANSICOES_MATRICULA` de `lib/capacitacao/matricula.ts`:

```
aguardando_agendamento → { agendado, cancelado }
agendado               → {}   (terminal)
cancelado              → {}   (terminal)
```

`agendado` é setado pela transação de agendamento; `cancelado` pelo GP/gestor.

## Núcleo lógico — `src/lib/medico/encaminhamento.ts` (puro + transacional)

Espelha `lib/capacitacao/matricula.ts` (erros tipados + funções transacionais):

- `TRANSICOES_ENCAMINHAMENTO: Record<StatusEncaminhamento, ReadonlySet<...>>`
- `podeTransicionarEncaminhamento(de, para): boolean` (puro)
- `criarEncaminhamento({ cidadaoId, consultaOrigemId, especialidadeId, motivo, createdBy })` →
  cria com `aguardando_agendamento`. Valida que a consulta de origem existe e é do cidadão.
- `cancelarEncaminhamento(id, motivo?)` → transição para `cancelado`.
- `agendarEncaminhamento(tx, encaminhamentoId, consultaId)` — **tx-aware** (igual
  `aplicarTransicaoMatricula`): valida `aguardando_agendamento`, seta `agendado`. Chamado DENTRO da
  transação de reserva do slot, junto do `reservarSlot`.
- Erros tipados: `EncaminhamentoNaoPendenteError`, `TransicaoEncaminhamentoInvalidaError`.

## RBAC — `src/lib/medico/rbac.ts` (novas funções)

Todas as **server actions** chamam `canAccessUnidade(session, "medico")` na borda (regra fixada —
ver memória `reference-server-action-unit-gate`), além do papel:

- `podeEncaminhar(session)` → `super_admin | gestor_unidade | profissional`. (Criar/cancelar pedido.)
- `podeAgendarEncaminhamento(session)` → reaproveita a regra de marcar consulta:
  `super_admin | gestor_unidade | recepcao` (callcenter). (Trabalhar a fila + agendar.)
- Ver a fila: leitura para os dois grupos acima.

## Telas / fluxo

### 1. GP cria o pedido — na tela da consulta `/medico/consultas/[id]`

A coluna 3 (hoje placeholder "Encaminhamento") vira funcional: form `especialidade` + `motivo` →
`criarEncaminhamentoAction`. Permite N pedidos por consulta; lista os existentes com status. Não
exige nota assinada. Visual no kit (accent teal do médico, padrão do prontuário).

### 2. Fila do callcenter — tela nova `/medico/encaminhamentos`

Lista `aguardando_agendamento`, `orderBy createdAt asc`, cada linha: cidadão · especialidade ·
motivo · pedido por · **"esperando há N dias"**. Entra na sidebar do médico (visível p/
recepção/gestor). Botão **"Agendar"** por linha + ação **"Cancelar"** (gestor/profissional).

### 3. Agendar — reaproveita o wizard

"Agendar" → `/medico/consultas/nova?encaminhamentoId=X`. O wizard detecta o param, **pré-preenche e
trava** cidadão + especialidade (pula passos 1–2), vai direto para profissional + slot. Ao
**reservar**, dentro da MESMA transação do `reservarSlot`: cria a `Consulta` com
`origemEncaminhamentoId=X` e chama `agendarEncaminhamento(tx, X, consulta.id)` → `agendado`. Some da
fila. Redireciona para o detalhe da consulta.

### 4. Rastro

Na consulta de origem e na ficha do cidadão: "encaminhado para [especialidade] · agendado em
[data] / aguardando". `logEvent`: `encaminhamento_criado` / `encaminhamento_agendado` /
`encaminhamento_cancelado` (novas `AuditAction`).

## Casos de borda

- **Especialidade sem profissional/slot** → o pedido entra na fila do mesmo jeito (disponibilidade
  é problema de agendamento, não de pedido). A atendente vê "sem horários" no wizard; o pedido
  segue visível na fila.
- **Pedido duplicado** (mesmo cidadão + especialidade já `aguardando_agendamento`) → **avisa, não
  bloqueia** (pode haver razão clínica; atendente decide).
- **Consulta agendada é cancelada depois** → o encaminhamento **permanece `agendado`** na Fase 1
  (não reabre automático). Limitação anotada.
- **Concorrência** (duplo "Agendar") → transação + checagem de status barram dupla marcação (mesmo
  princípio anti-overbooking do slot).

## Testes

- **Unit (puro + mock db)** espelhando `tests/unit/capacitacao-matricula-*`: `TRANSICOES_*` +
  `podeTransicionarEncaminhamento` + `criar/cancelar/agendar` (mock).
- **Unit RBAC**: `podeEncaminhar` / `podeAgendarEncaminhamento` + gate de unidade.
- **e2e smoke** (`tests/e2e/encaminhamento.spec.ts`): GP cria pedido → aparece na fila →
  callcenter agenda → some da fila + consulta com `origemEncaminhamentoId`. Seed precisa de 1
  consulta `em_atendimento` + slots.

## Fora de escopo (Fase 1)

- WhatsApp (confirmação/lembrete/auto-agendamento) — **Fase 2**.
- Encaminhamento para **exame** (só consulta de especialista por ora).
- Reabertura automática quando a consulta agendada é cancelada.
- Encaminhamento externo (fora do IFP).

## Decisões fechadas (com Erick, 2026-06-02/03)

- **§D1** Sem prioridade/urgência — o centro só faz rotina; fila ordena por antiguidade (mais antigo
  primeiro), destacando tempo de espera.
- **§D2** Sem prazo definido pelo clínico — a atendente do callcenter escolhe a data na
  disponibilidade (seg–sex). Encaminhamento NÃO tem campo de prazo.
- **§D3** GP cria o pedido; callcenter/recepção agenda. `agendado`/`cancelado` terminais.
- **§D4** "Agendar" reaproveita o wizard pré-preenchido (não agenda inline). Booking transacional
  liga consulta↔encaminhamento e flipa para `agendado`.
- **§D5** Abordagem A (entidade de 1ª classe + reuso do wizard), aprovada sobre B (inline) e C
  (relatório sem entidade).
