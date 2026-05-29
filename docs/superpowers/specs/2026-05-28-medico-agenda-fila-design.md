# F1.B.1 — Agenda + Fila do dia (Centro Médico)

**Data:** 2026-05-28
**Status:** spec aprovada no brainstorm, aguardando plano de implementação
**Roadmap pai:** `docs/superpowers/roadmap/2026-05-28-roadmap-produto.md` (F1.B Médico, sub-módulo 1)
**Spec irmã (DS v2):** `docs/superpowers/specs/2026-05-28-design-system-v2-design.md`
**Research base:** `docs/superpowers/research/2026-05-28-saas-references-por-vertical.md` §1 (Centro Médico)

---

## 1. Motivação

O Centro Médico do IFP atende público vulnerável em Duque de Caxias com **ambição de referência social** ("primeiro mundo", como diz Erick): atendimento médico gratuito de alta qualidade, multi-especialidade (clínico, enfermagem, pediatria, ginecologia, odontologia, psicologia, fisioterapia, fonoaudiologia, endocrinologia, neurologia + extensível). Hoje a operação usa **Amplimed externo** — a diretoria pediu trazer pra dentro do IFP Connect com visual **Doctolib-like** (referência principal da pesquisa SaaS).

F1.B.1 é o **primeiro sub-módulo** do vertical Médico: a infraestrutura de **agenda multi-profissional + fila do dia**. Sem essa base, prontuário (F1.B.2) e prescrição (F1.B.3) não fazem sentido. Após F1.B.1 a unidade médica passa a ter: profissionais cadastrados, agendas configuráveis self-service, consultas marcáveis pelo callcenter (Maria), fila do dia visível na home, transições de status auditadas.

## 2. Decisões fechadas no brainstorm

| # | Pergunta | Decisão |
|---|---|---|
| 1 | Quantos profissionais? | **Multi-especialidade** |
| 2 | Especialidades hardcoded ou cadastráveis? | **Cadastráveis** por super_admin (lista pode crescer: clínico/enfermagem/pediatria/ginecologia/odonto/psicologia/fisio/fono/endo/neuro + futuras) |
| 3 | Profissional = User? | **Sim** — faz login, vê própria agenda, vai atender (F1.B.2 prontuário) |
| 4 | Quem configura agenda do profissional? | **Self-service**: profissional configura template recorrente próprio; gestor (Raquel) e super_admin auditam |
| 5 | Duração da consulta | Profissional define no setup do template (30/45/50/60min) |
| 6 | Modelo de dados | **Novos modelos** (Especialidade, Profissional, AgendaTemplate, Slot, Consulta) — Vaga/Agendamento social legacy intactos |

## 3. Defaults assumidos pras decisões secundárias

Documentados aqui pra ficar explícito; podem ser refinados sem mudar a spec:

| Item | Default |
|---|---|
| Quem marca primeira consulta? | Callcenter Maria (`recepcao:medico`) via `/medico/consultas/nova` |
| Quem marca follow-up? | Profissional ao fim da consulta (F1.B.2 entrega isso); por ora também pela Maria |
| Página pública de auto-agendamento | Fora do escopo — Fase 2 do roadmap (Funil) |
| Confirmação automática WhatsApp | Fora do escopo — Fase 3 (depende WhatsApp Business API) |
| Encaixe/emergência | Profissional bloqueia/desbloqueia slot manualmente; sem reserva especial |
| Cancelamento | Libera slot imediatamente; sem regra de tempo mínimo no MVP |
| Telemedicina | Fora do escopo — sempre presencial |

## 4. Arquitetura de dados

### 4.1 Modelo Prisma (resumo)

```prisma
model Especialidade {
  id                String   @id @default(cuid())
  nome              String   @unique
  duracaoPadraoMin  Int      // 30, 45, 50, 60
  corDestaque       String   // hex do brandbook (ex: usa cor da paleta)
  ativa             Boolean  @default(true)
  profissionais     ProfissionalEspecialidade[]
  slots             Slot[]
  consultas         Consulta[]
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model Profissional {
  id              String   @id @default(cuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id])
  nomeExibicao    String   // "Dr. João Silva" ou "Dra. Maria Souza"
  conselho        String   // "CRM-RJ", "CRO-RJ", "CRP", "COREN", etc.
  nroConselho     String
  bio             String?  // markdown curto
  fotoUrl         String?  // path em MinIO
  ativo           Boolean  @default(true)
  especialidades  ProfissionalEspecialidade[]
  templates       AgendaTemplate[]
  slots           Slot[]
  consultas       Consulta[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model ProfissionalEspecialidade {
  profissionalId   String
  especialidadeId  String
  profissional     Profissional  @relation(fields: [profissionalId], references: [id])
  especialidade    Especialidade @relation(fields: [especialidadeId], references: [id])
  @@id([profissionalId, especialidadeId])
}

model AgendaTemplate {
  id              String        @id @default(cuid())
  profissionalId  String
  profissional    Profissional  @relation(fields: [profissionalId], references: [id])
  especialidadeId String        // template atende UMA especialidade; profissional cria outro template para outra
  diasSemana      Int[]         // 0=domingo, ..., 6=sábado
  faixaInicio     String        // "14:00"
  faixaFim        String        // "18:00"
  duracaoSlotMin  Int           // 30, 45, 50, 60
  validoDe        DateTime
  validoAte       DateTime?
  observacoes     String?
  ativo           Boolean       @default(true)
  slots           Slot[]
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}

enum StatusSlot {
  disponivel
  reservado
  bloqueado
  realizado
  faltou
  cancelado
}

model Slot {
  id              String       @id @default(cuid())
  profissionalId  String
  especialidadeId String
  templateId      String?      // null se criado manualmente
  dataHoraInicio  DateTime     // UTC
  duracaoMin      Int
  status          StatusSlot   @default(disponivel)
  motivoBloqueio  String?      // quando status=bloqueado
  profissional    Profissional  @relation(fields: [profissionalId], references: [id])
  especialidade   Especialidade @relation(fields: [especialidadeId], references: [id])
  template        AgendaTemplate? @relation(fields: [templateId], references: [id])
  consulta        Consulta?    // 0..1 (slot reservado tem 1 consulta)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  @@index([profissionalId, dataHoraInicio])
  @@index([status, dataHoraInicio])
  @@index([especialidadeId, status, dataHoraInicio])
}

enum StatusConsulta {
  agendada
  confirmada
  em_atendimento
  realizada
  faltou
  cancelada
}

model Consulta {
  id                       String          @id @default(cuid())
  slotId                   String          @unique
  cidadaoId                String
  profissionalId           String
  especialidadeId          String
  status                   StatusConsulta  @default(agendada)
  observacoesAgendamento   String?
  origemTriagemId          String?         // se veio via triagem da Regina
  createdBy                String          // userId de quem agendou
  cancelMotivo             String?
  slot                     Slot            @relation(fields: [slotId], references: [id])
  cidadao                  Cidadao         @relation(fields: [cidadaoId], references: [id])
  profissional             Profissional    @relation(fields: [profissionalId], references: [id])
  especialidade            Especialidade   @relation(fields: [especialidadeId], references: [id])
  createdAt                DateTime        @default(now())
  updatedAt                DateTime        @updatedAt
  @@index([profissionalId, status])
  @@index([cidadaoId])
  @@index([status, createdAt])
}
```

### 4.2 Geração de slots

`gerarSlots(template, ate)` em `lib/medico/agenda.ts`:
- Pega o template
- Pra cada dia entre `template.validoDe` e `ate`:
  - Se `template.diasSemana.includes(dayOfWeek)`:
    - Cria slots de `faixaInicio` até `faixaFim`, espaçados por `duracaoSlotMin`
    - Cada slot inicia com status `disponivel`
- Idempotente: não cria slot que já existe no mesmo `(profissionalId, dataHoraInicio)`

`reservarSlot(slotId, cidadaoId, ctx)` em transação:
```sql
UPDATE "Slot" SET status='reservado' WHERE id=$1 AND status='disponivel' RETURNING *;
INSERT INTO "Consulta" (slotId, cidadaoId, ...) VALUES (...);
```
Se UPDATE retorna 0 linhas → slot foi pego por outro, lança `SlotIndisponivelError`.

`liberarSlot(slotId)`:
- Atualiza `slot.status='disponivel'` (vindo de `reservado` ou `bloqueado`)
- Se havia consulta vinculada → marca `consulta.status='cancelada'`

### 4.3 RBAC

| Capability | super_admin | gestor:medico | profissional | recepcao:medico | social |
|---|:-:|:-:|:-:|:-:|:-:|
| Ver lista profissionais | ✓ | ✓ | ✓ | ✓ | ✓ |
| Cadastrar profissional | ✓ | ✓ | — | — | — |
| Editar profissional | ✓ | ✓ | ✓ próprio | — | — |
| Ver agenda da unidade | ✓ | ✓ | ✓ | ✓ | ✓ |
| Configurar AgendaTemplate | ✓ qualquer | ✓ qualquer | ✓ próprio | — | — |
| Bloquear/desbloquear slot | ✓ qualquer | ✓ qualquer | ✓ próprio | — | — |
| Marcar consulta | ✓ | ✓ | — | ✓ | ✓ via encaminhamento |
| Transicionar status consulta | ✓ | ✓ | ✓ próprio | ✓ (check-in / falhou) | — |
| Ver consultas | ✓ todas | ✓ todas | ✓ próprias | ✓ todas | ✓ encaminhadas por ela |
| Cadastrar/editar especialidade | ✓ | ✓ | — | — | — |

## 5. Rotas / Telas

### 5.1 Estrutura de arquivos

```
src/app/[unidade]/page.tsx         # já existe — vira home com fila do dia (quando unidade==medico)
                                    # OU criar src/app/medico/(unidade)/page.tsx específico

src/app/medico/agenda/page.tsx      # grid semanal Doctolib-like
src/app/medico/profissionais/page.tsx
src/app/medico/profissionais/[id]/page.tsx
src/app/medico/profissionais/novo/page.tsx
src/app/medico/minha-agenda/page.tsx
src/app/medico/consultas/nova/page.tsx
src/app/medico/consultas/[id]/page.tsx
src/app/medico/especialidades/page.tsx
src/app/medico/actions.ts          # server actions (criar template, reservar slot, transicionar)
```

> Decisão de impl: home da unidade médica deve ser dedicada (não compartilha com o catch-all `/[unidade]`) pra acomodar widgets de fila do dia + agenda. Criar `src/app/medico/(unidade)/page.tsx` com Next 16 route groups, ou condicional na home catch-all.

### 5.2 Resumo por tela

**`/medico` (home)** — substitui placeholder atual. Mostra:
- Header: data + saudação (`Olá, Maria — terça-feira, 28 de maio`)
- KpiCards: consultas hoje / pendentes esta semana / próximas 24h
- **Fila do dia** (componente principal): tabela ordenada por hora — coluna profissional, especialidade, cidadão, status, ações (check-in, marcar realizada, marcar faltou)
- Botão "Marcar nova consulta" → `/medico/consultas/nova`
- Link "Ver agenda semanal" → `/medico/agenda`

**`/medico/agenda`** — grid semanal:
- 7 dias × faixa 7h-22h
- Slots desenhados na grid com cor da especialidade (`Especialidade.corDestaque`)
- Slot reservado = nome curto do cidadão dentro
- Slot bloqueado = listras diagonais
- Slot disponível = vazio claro
- Filtros: especialidade (multi) + profissional (single)

**`/medico/minha-agenda`** (profissional):
- "Meu template ativo": dia+horário+duração+especialidade
- "Criar novo template" (form)
- "Próximos slots gerados" (lista cronológica)
- Botão por slot disponível: "Bloquear" (modal: motivo)

**`/medico/consultas/nova`** (Maria, Regina, Raquel, Erick):
- Step 1: buscar cidadão (reutiliza componente atual de busca)
- Step 2: escolher especialidade
- Step 3: ver slots disponíveis nos próximos 30 dias filtrados por especialidade (lista cronológica com nome do profissional + dia/hora)
- Step 4: confirmar reserva (mostra resumo + campo "observação")
- Submit → `reservarSlot` action → redirect pra `/medico/consultas/[id]`

**`/medico/consultas/[id]`** — detalhe + ações:
- Cidadão + Profissional + Slot + Status
- Botões contextuais: Confirmar / Em atendimento / Realizada / Faltou / Cancelar
- Espaço reservado pra prontuário (F1.B.2)
- Histórico de transições (audit log)

**`/medico/profissionais`** — lista:
- Tabela: foto + nome + conselho + especialidades + ativo

**`/medico/profissionais/novo`** + `/medico/profissionais/[id]`:
- Form vincula User existente (busca) ou cria User novo + dados extras (conselho, especialidades many-to-many, bio)

**`/medico/especialidades`** — CRUD super_admin/gestor:
- Lista + criar + editar + ativar/desativar

## 6. Fluxos principais

### Fluxo A: Erick cadastra profissional voluntário
1. `/admin/users` → criar User (Dr. João, role `profissional`, unitScope `medico`)
2. `/medico/profissionais/novo` → busca por email → vincula → preenche `conselho=CRM-RJ`, `nroConselho=12345`, escolhe `[Clínico Geral, Pediatria]`
3. Dr. João recebe credenciais (email manual por ora; reset password automático = Plano 8)
4. Primeiro login → cai em `/medico/minha-agenda`

### Fluxo B: Profissional configura agenda
1. Dr. João em `/medico/minha-agenda` → "Criar template"
2. Form: dias=[ter, qui], inicio=14h, fim=18h, duração=30min, especialidade=Pediatria, válidoDe=2026-06-01, válidoAté=∞
3. Submit → `gerarSlots` cria slots dos próximos 90 dias
4. Slots aparecem na lista

### Fluxo C: Maria marca consulta
1. Maria em `/medico` vê fila do dia + botão "Marcar nova consulta"
2. Busca cidadão "João Almeida" → seleciona
3. Especialidade: "Pediatria"
4. Sistema mostra slots disponíveis: "Dr. João — terça 03/jun 14:30, 15:00, 15:30..." (cronológico)
5. Escolhe 03/jun 14:30 → confirma
6. `reservarSlot(slotId, cidadaoId)` em transação → cria Consulta status=agendada
7. Redirect `/medico/consultas/[id]` mostrando agendamento confirmado

### Fluxo D: Dia da consulta
1. 03/jun, 14:00 — Maria abre `/medico` → fila do dia mostra João Almeida 14:30 Dr. João Pediatria
2. 14:25 — Cidadão chega na recepção; Maria clica "Confirmar / Check-in" → status=`em_atendimento`
3. Dr. João abre `/medico/consultas/[id]` (será o prontuário no F1.B.2; por ora vê detalhe)
4. Atende, marca "Realizada" → status=`realizada`; slot.status=`realizado`
5. Audit log registra todas as transições

### Fluxo E: Profissional bloqueia slot (férias / atestado)
1. Dr. João em `/medico/minha-agenda` → próximos slots
2. Seleciona 10/jun 14:30-18:00 → "Bloquear" → motivo="Férias programadas"
3. Cada slot vira `status=bloqueado` + `motivoBloqueio="Férias programadas"`
4. Grid semanal mostra listras diagonais; `/medico/consultas/nova` não oferece esses slots

## 7. Sub-tasks (estimativa ~5 dias)

Não detalho aqui — vai pro plano de implementação. Lista alto nível:

1. Schema Prisma + migration (5 entidades + enums + índices)
2. Seed inicial (10 especialidades padrão + 3 profissionais demo + 1 template + 90 dias de slots)
3. `lib/medico/agenda.ts` puro — `gerarSlots`, `reservarSlot` (transação anti-overbooking), `liberarSlot`, `transicionarConsulta`, `slotsDisponiveis` (~12 unit tests)
4. `lib/medico/rbac.ts` — `podeGerenciarProfissional`, `podeConfigurarAgenda`, `podeMarcarConsulta`, etc.
5. `/medico/especialidades` (lista + CRUD)
6. `/medico/profissionais` (lista + novo + edit)
7. `/medico/minha-agenda` (profissional self-service)
8. `/medico` home com fila do dia (substitui placeholder atual)
9. `/medico/agenda` grid semanal
10. `/medico/consultas/nova` (wizard 4 steps)
11. `/medico/consultas/[id]` (detalhe + transições)
12. AppShell ajuste: nav links da unidade médica (Cidadãos / Agenda / Consultas / Profissionais / Especialidades)
13. E2e: 5 cenários (cadastro profissional, criar template, marcar consulta com anti-overbooking, fluxo dia da consulta, bloquear slot)

## 8. Não-objetivos (F1.B.1 NÃO entrega)

- **Prontuário** (3 colunas histórico/evolução/ações) → F1.B.2
- **Prescrição** (PDF) → F1.B.3
- **Encaminhamento entre profissionais/unidades** → F1.B.3
- **Atestado / declaração** → F1.B.3
- **Confirmação WhatsApp** (depende WhatsApp Business API) → Fase 3
- **Auto-agendamento público** (link Instagram) → Fase 2 (Funil refactor)
- **Telemedicina** → fora do roadmap atual
- **Integração Memed** → Plano 8
- **Reset password automático do profissional** → Plano 8
- **Foto do profissional via upload UI** → entrega como path em MinIO via `/admin/users` ou form; UI dedicada de upload futura

## 9. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Geração de slots fica lenta com muitos profissionais × longo período | Geração incremental (90 dias por padrão); job de "estender agenda" mensal; índices em `(profissionalId, dataHoraInicio)` |
| Overbooking concorrente | Transação `UPDATE...WHERE status='disponivel'` com checagem de linhas afetadas |
| Especialidade deletada com slots/consultas vinculadas | `onDelete: Restrict` no Prisma + soft-delete (`ativa=false`) |
| Profissional saí mas tem consultas futuras | Soft-delete (`ativo=false`); UI bloqueia novos agendamentos; consultas existentes preservadas pra histórico |
| Conflito com Vaga/Agendamento legacy | Modelos novos não tocam Vaga; rotas `/medico/consultas/*` distintas de `/app/vagas/*` |
| Profissional bloqueia slot que já tem consulta | Validar `slot.consulta == null` antes de bloquear; se tem consulta, oferecer "cancelar consulta + bloquear" |

## 10. Critérios de sucesso

- [ ] Erick cadastra 3 profissionais demo via `/medico/profissionais/novo`
- [ ] Cada profissional configura seu template em `/medico/minha-agenda`
- [ ] `gerarSlots` produz slots corretos respeitando dias da semana + duração + faixa
- [ ] Maria em `/medico/consultas/nova` consegue marcar consulta seguindo wizard
- [ ] Anti-overbooking: 2 consultas concorrentes no mesmo slot → 1 sucesso, 1 erro claro
- [ ] Profissional bloqueia slot e ele some de `/medico/consultas/nova`
- [ ] Fila do dia em `/medico` ordenada cronologicamente
- [ ] Grid semanal `/medico/agenda` renderiza com cores por especialidade
- [ ] RBAC: profissional só vê própria agenda em edição; outros profissionais só leitura
- [ ] Audit log captura todas as transições de status
- [ ] E2e Playwright 5+ cenários verdes
- [ ] Build prod sem warnings, `pnpm typecheck && pnpm lint && pnpm test` verdes

## 11. Dependências

- Spec multi-tenant + RBAC v2 (entregue em `352fd18`)
- Spec DS v2 (entregue em `81e0560`)
- Componentes universais já disponíveis: `Button`, `Input`, `Card`, `Badge`, `EmptyState`
- Existing: User, role `profissional`, `gestor_unidade`, `recepcao`, `social`
- Existing: ficha Cidadão + busca + lib `cidadao.ts`
- Existing: audit log + lib `audit.ts`
- Existing: MinIO pra fotos (caso fotos sejam upload)

## 12. Estimativa grossa

~5 dias úteis de trabalho focado TDD. Plano de implementação subsequente vai detalhar tasks. Próximos sub-módulos (F1.B.2 prontuário, F1.B.3 prescrição) constroem sobre F1.B.1 e ganham sua própria spec.
