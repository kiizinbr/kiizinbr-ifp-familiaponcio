# Spec — Motor de agenda genérico + os 3 buracos (agenda do dia · agendamento dinâmico · agendar entrevista social)

**Data:** 2026-06-09
**Origem:** sub-projeto P0 #1 do roadmap `docs/produto-maturidade-mvp-2026-06-09.md` (escolhido pelo Erick). Resolve a raiz comum dos 3 buracos nomeados: o motor de agenda está acoplado ao domínio médico.
**Status:** design aprovado no brainstorming (decisões abaixo). Próximo: plano de implementação.

---

## 1. Problema

O motor de agenda (`src/lib/medico/agenda.ts`) é excelente — geração de slots por template recorrente (puro), reserva CAS anti-overbooking transacional, máquina de estados consulta↔slot — mas **soldado a `Slot.profissionalId/especialidadeId` e `Consulta`**. Consequências (auditoria de maturidade §3):
- **Buraco #1 — sem "agenda do dia":** só grade semanal + 3 listas verticais que duplicam a query do dia; nenhuma unidade fora do médico tem visão "hoje".
- **Buraco #2 — não dá pra agendar a entrevista do Serviço Social:** `Triagem.dataEntrevista` é texto digitado; o motor de slots só opera profissional médico.
- **Buraco #3 — agendamento não é dinâmico:** depende 100% de slots pré-gerados por `AgendaTemplate`; sem template → "sem horário" → impossível marcar. Sem slot ad-hoc, sem walk-in/ordem de chegada.

## 2. Princípio da solução

Extrair a **lógica** (não as tabelas) para um core resource-agnostic. **O médico que funciona não muda de tabelas** — só passa a *chamar* o core. Social usa o mesmo core com tabelas próprias. O core ganha **slots ad-hoc** (o "dinâmico"), disponível pra todos.

### Decisões aprovadas (brainstorming)
- **Estratégia:** core compartilhado (`lib/agenda/core.ts`), tabelas do médico intactas; médico migra pro core incrementalmente.
- **Assistente social:** é o próprio `User` com papel `social` (sem novo modelo de "profissional"); `SlotSocial` referencia `assistenteSocialUserId`.
- **Tabelas do social:** `SlotSocial` + `EntrevistaSocial` próprias (espelham Slot/Consulta, usam o core) — isolamento e migração aditiva segura.
- **Fora de escopo (vai pro sub-projeto beneficiário-cêntrico):** elegibilidade-com-validade e o *gate* de elegibilidade ao agendar/matricular. A entrevista agendada aqui é o **input** do intake, mas não implementamos o passe nesta etapa.
- **Fora de escopo:** `Vaga`/`Agendamento` do funil público (outro conceito — não consolidar agora). Agenda do dia **transversal** (`/inicio`) é P1.

---

## 3. Arquitetura

### 3.1 O core — `src/lib/agenda/core.ts`
Funções puras + helpers transacionais genéricos, sem conhecer médico nem social:

```ts
// Geração (puro) — generaliza gerarSlots removendo especialidadeId.
export interface JanelaDisponibilidade {
  diasSemana: readonly number[]; faixaInicio: string; faixaFim: string;
  duracaoSlotMin: number; validoDe: Date; validoAte: Date | null;
}
export interface SlotBase { dataHoraInicio: Date; duracaoMin: number; }
export function gerarSlots(janela: JanelaDisponibilidade, opts?: { limiteSuperior?: Date }): SlotBase[];

// Reserva CAS genérica (anti-overbooking). Opera sobre qualquer "slot delegate"
// com campo status. Retorna true se reservou (count===1), false se já foi pego.
export async function reservarCAS(args: {
  updateMany: (where, data) => Promise<{ count: number }>; // tx.slot.updateMany | tx.slotSocial.updateMany
  slotId: string; de?: string; para?: string;             // default 'disponivel' -> 'reservado'
}): Promise<boolean>;

// Máquina de estados genérica.
export function criarMaquinaEstados<S extends string>(
  transicoes: Record<S, ReadonlySet<S>>,
): { pode(de: S, para: S): boolean; alvos(de: S): ReadonlySet<S> };

// Slot ad-hoc (o "dinâmico"): cria um slot disponível on-demand, respeitando a
// unicidade (recurso + dataHoraInicio). Recebe o create delegate + os campos do recurso.
export async function criarSlotAdHoc<T>(args: {
  create: (data) => Promise<T>;
  recurso: Record<string, string>;  // { profissionalId } | { assistenteSocialUserId }
  dataHoraInicio: Date; duracaoMin: number;
}): Promise<T>;
```

> Nota: `reservarCAS`/`criarSlotAdHoc` recebem *delegates* (funções do `tx.<tabela>`) em vez de importar tabelas — é o que mantém o core agnóstico e o médico/social donos das suas tabelas. A unicidade `@@unique([recurso, dataHoraInicio])` (já existe no Slot médico) é o guard de corrida do ad-hoc.

### 3.2 Médico — refactor fino (sem mudar tabelas)
`src/lib/medico/agenda.ts` passa a delegar:
- `gerarSlots(médico)` = `core.gerarSlots(janela)` + anexa `especialidadeId` a cada slot.
- `reservarSlot` = `core.reservarCAS({ updateMany: tx.slot.updateMany, slotId })` → se true, cria `Consulta` (igual hoje).
- a máquina `TRANSICOES` passa por `core.criarMaquinaEstados(TRANSICOES)`.
- **Rede de segurança:** os testes existentes de `agenda`/`medico-agenda` devem passar idênticos — comportamento preservado byte-a-byte. Nenhuma migration no médico.

### 3.3 Buraco #3 — agendamento dinâmico (médico)
- **Slot ad-hoc no balcão:** em `src/app/medico/consultas/nova`, quando a especialidade não tem slot livre, ação "criar horário" → `core.criarSlotAdHoc({ create: tx.slot.create, recurso:{profissionalId, especialidadeId}, dataHoraInicio, duracaoMin })` + `reservarSlot` na MESMA transação.
- **Walk-in / ordem de chegada:** ação "atender agora" → cria slot ad-hoc com `dataHoraInicio = now` + reserva → entra na fila viva (`/medico`, `/medico/recepcao`). Sem precisar de template.

### 3.4 Buraco #2 — agendar a entrevista do Serviço Social (migration aditiva)
Novos modelos (Prisma):
```prisma
model SlotSocial {
  id                     String  @id @default(cuid())
  assistenteSocialUserId String
  assistenteSocial       User    @relation(fields: [assistenteSocialUserId], references: [id])
  dataHoraInicio         DateTime
  duracaoMin             Int     @default(30)
  status                 StatusSlot @default(disponivel)   // REUSA o enum existente
  motivoBloqueio         String?
  entrevista             EntrevistaSocial?
  @@unique([assistenteSocialUserId, dataHoraInicio])
  @@index([dataHoraInicio])
}

enum StatusEntrevista { agendada realizada faltou cancelada }  // enxuto (sem confirmada/em_atendimento)

model EntrevistaSocial {
  id          String  @id @default(cuid())
  slotSocialId String @unique
  slotSocial  SlotSocial @relation(fields: [slotSocialId], references: [id])
  cidadaoId   String
  cidadao     Cidadao @relation(fields: [cidadaoId], references: [id])
  status      StatusEntrevista @default(agendada)
  observacoes String?
  triagemId   String?  @unique           // setado quando a entrevista é REALIZADA (a triagem é preenchida)
  triagem     Triagem? @relation(fields: [triagemId], references: [id])
  createdBy   String
  createdAt   DateTime @default(now())
}
```
- **Fluxo:** assistente social define disponibilidade (template OU avulsa via ad-hoc) → `social/agenda` mostra os slots → recepção/social marca a entrevista de um cidadão (reserva CAS via core) → no dia, a entrevista é conduzida (`realizada`) e a `Triagem` existente é preenchida, com `EntrevistaSocial.triagemId` apontando pra ela. A fila de triagens pendentes (`src/lib/triagem.ts:53`) passa a vir das entrevistas agendadas.
- **Reuso:** `SlotSocial` usa `core.gerarSlots` + `core.reservarCAS` + `core.criarSlotAdHoc` (delegates do `tx.slotSocial`). Máquina de estados própria `criarMaquinaEstados(TRANSICOES_ENTREVISTA)`.
- Rota nova: `src/app/social/agenda/page.tsx` + actions de disponibilidade e de marcar/transicionar entrevista.

### 3.5 Buraco #1 — agenda do dia (médico)
- Extrair `src/lib/medico/agenda-dia.ts`: a query canônica do dia (slots+consultas de hoje), hoje duplicada em `medico/page.tsx`, `medico/recepcao/page.tsx`, `minha-fila`. As 3 telas passam a consumi-la (DRY).
- Rota `src/app/medico/agenda-dia/page.tsx`: board diário (profissionais nas colunas × horas nas linhas; célula = livre / reservado / chegou / atendendo). Entra como aba/tela no chrome.
- (P1, fora daqui) `/inicio` soma consultas + entrevistas sociais + (futuro) aulas → agenda do dia transversal.

---

## 4. Fases (entrada pro writing-plans)
1. **Core + refactor médico** — criar `lib/agenda/core.ts`; médico delega; comportamento idêntico; **todos os testes existentes verdes** + testes novos do core (gerarSlots generalizado, reservarCAS, criarSlotAdHoc, máquina). *Fundação, risco controlado pela suíte existente.*
2. **Buraco #3 — dinâmico (médico)** — slot ad-hoc no balcão + walk-in. *Primeiro valor visível ao usuário.*
3. **Buraco #2 — agendar social** — migration aditiva (SlotSocial/EntrevistaSocial/StatusEntrevista) + `social/agenda` + ligação com Triagem. *Materializa o modelo do dono.*
4. **Buraco #1 — agenda do dia (médico)** — extrair `agenda-dia.ts` + board `medico/agenda-dia`.

## 5. Critérios de sucesso
- `lib/agenda/core.ts` é resource-agnostic (não importa Prisma de médico/social); médico e social consomem o mesmo core.
- Médico: 0 regressão (suíte existente passa) + dá pra marcar consulta SEM template (ad-hoc) e atender walk-in.
- Social: dá pra **agendar uma entrevista** com a assistente social num slot real, e ela vira a `Triagem` ao ser realizada.
- Existe uma **agenda do dia** (board) no médico.
- Sem faturamento/cobrança em lugar nenhum (princípio do projeto).

## 6. Testes
- Core: testes unitários puros (`tests/unit/agenda-core.test.ts`) — geração, CAS (incl. corrida: 2 reservas concorrentes → 1 ganha), máquina de estados, ad-hoc.
- Médico: a suíte existente é a rede de não-regressão; estender `medico-agenda` com ad-hoc/walk-in.
- Social: teste de integração do fluxo agendar→realizar→triagem (mesmo padrão dos testes de integração existentes, gated pelo DB dev).

## 7. Riscos & mitigações
- **Risco:** refactor do médico introduzir regressão sutil no anti-overbooking. **Mitigação:** core mantém exatamente o `updateMany` CAS; suíte existente roda a cada fase; fase 1 não muda tabela nem comportamento.
- **Risco:** modelar assistente social como `User` exigir que toda assistente tenha papel `social` + disponibilidade cadastrada. **Mitigação:** seed + UI de disponibilidade simples; ad-hoc cobre o caso "sem template".
- **Risco:** acoplar entrevista↔triagem cedo demais. **Mitigação:** `triagemId` nullable, setado só na realização; o fluxo de triagem existente fica intacto.
