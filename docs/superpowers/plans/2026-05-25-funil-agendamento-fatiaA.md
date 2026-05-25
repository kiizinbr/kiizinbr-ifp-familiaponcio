# Funil — Fatia A (Agendamento interno) — Execução 2026-05-25

**Spec:** `docs/superpowers/specs/2026-05-25-funnel-agendamento-whatsapp-design.md`
**Decisões (Erick 2026-05-25):** Vaga com **limite de slots** (`slotsTotais` + janela); **horário livre** dentro da janela. Nasce `agendado` → callcenter confirma. Dados mínimos: nome + telefone (+ vaga + horário). CPF só na entrevista. 1 agendamento ativo por telefone+vaga. "faltou" não libera slot. Criar vaga = gestor_unidade/gestor_geral/super_admin; agendar = + social + recepcao. WhatsApp/página pública = Fatia B (fora).

**Regras:** ritual pré-commit antes de cada commit; commit atômico por tarefa; push via git Windows; comandos no WSL; TDD na lógica pura.

## Tarefas

### T1 — Schema + migration `add_funil`

- Enums `StatusVaga {aberta pausada encerrada}`, `StatusAgendamento {agendado confirmado realizado cancelado faltou}`.
- `Vaga`: id, unidade String, titulo, descricao? Text, slotsTotais Int, abreEm? / fechaEm? DateTime, status @default(aberta), criadoPorId (User), timestamps; `agendamentos Agendamento[]`; `@@index([unidade, status])`.
- `Agendamento`: id, vagaId (FK Vaga onDelete Cascade), nomeInteressado, telefone, horario DateTime, status @default(agendado), consenteContato Boolean @default(false), observacoes? Text, criadoPorId? (User), cidadaoId? (FK Cidadao, set na materialização), timestamps; `@@index([vagaId, status])`, `@@index([cidadaoId])`.
- User back-relations; Cidadao `agendamentos Agendamento[]`. Migration + `pnpm build`.

### T2 — Audit actions + timeline

- `audit.ts` `AuditAction` += `agendamento_criado | agendamento_confirmado | agendamento_realizado | agendamento_cancelado | agendamento_faltou` + `vaga_criada`.
- `cidadao-history.ts`: labels p/ as actions de agendamento (aparecem na timeline do cidadão quando `cidadaoId` setado, via rootEntityType='cidadao').

### T3 — `lib/funil.ts` (pure core + I/O)

- **Pure (TDD `tests/unit/funil.test.ts`):** `slotsDisponiveis(slotsTotais, agendamentos)` = slotsTotais − count(status ∈ {agendado,confirmado,realizado}); `vagaAceitaAgendamento(vaga, ocupados)` = status==aberta && (sem fechaEm OU agora<fechaEm) && ocupados<slotsTotais.
- `podeGerenciarVaga(session)` = super_admin/gestor_geral/gestor_unidade; `podeAgendar(session)` = +social +recepcao.
- I/O com RBAC: `listVagas(session)` (gestor_unidade só sua unidade), `getVaga(id, session)`, `listAgendamentos(vagaId, session)`.

### T4 — Server actions `funil-actions.ts`

- `criarVaga`/`editarVaga`/`encerrarVaga` (RBAC podeGerenciarVaga + unitScope).
- `criarAgendamento(vagaId, {nome, telefone, horario, consente, obs})`: dentro de `db.$transaction`, recontar ocupados e checar capacidade (anti-overbooking); checar 1 ativo por telefone+vaga; cria `agendado`; logEvent `agendamento_criado`.
- `confirmarAgendamento`/`cancelarAgendamento`/`marcarFaltou`/`realizarAgendamento` (transições + audit). `realizar` só marca `realizado` (a ficha vem pela ponte abaixo).
- **Ponte→ficha:** `vincularCidadao(agendamentoId, cidadaoId)` seta `cidadaoId` + audit com `rootEntityType='cidadao'`. (Chamado quando a ficha é criada a partir do agendamento.)

### T5 — UI

- `/app/vagas` (lista de vagas com slots disponíveis + botão criar) + `/app/vagas/nova` (form: unidade/título/slots/janela).
- `/app/vagas/[id]` (detalhe da vaga + lista de agendamentos + form "Novo agendamento": nome/telefone/horário/consente + ações confirmar/cancelar/faltou/realizar).
- Do agendamento: link "Criar ficha do interessado" → `/app/cidadaos/novo?nome=…&telefone=…&agendamento=ID` (form lê query e pré-preenche; ao salvar, chama `vincularCidadao`).
- Item "Vagas" na `SidebarNav` (roles que gerenciam/agendam). Tudo no `.ifp-card` premium.

### T6 — e2e `tests/e2e/funil.spec.ts`

- coordenação cria vaga (slots=2) → callcenter agenda 2 → 3º bloqueado (capacidade) → confirma 1 → cancela 1 (libera? não, default) ; RBAC (quem não pode agendar não vê o form).

### T7 — Fechamento: memórias + relatório + perguntas pendentes (WhatsApp/Fatia B).

## Verificação

Unit (slotsDisponiveis/vagaAceita) + e2e + ritual + build. Manual: como gestor cria vaga, como recepção agenda, capacidade trava, realizar→criar ficha prefilled→vincula→timeline do cidadão mostra o agendamento.

## ✅ Concluído (2026-05-25)

Commits `5a738a0`→`5cfff89` (pushados). T1 schema+migration, T2 audit/timeline, T3 lib (slots puros 7 testes + RBAC), T4 actions (capacidade tx + transições + vincular), T5 UI (vagas/nova/detalhe + painel agendamentos + nav + prefill), T6 e2e (4 cenários). **11 unit + 40 e2e verdes.**

**Limitação conhecida (ponte parcial):** a action `vincularCidadaoAoAgendamento` existe e registra na timeline do cidadão, mas o link "Criar ficha do interessado" só **pré-preenche** o form (nome/telefone via query) — NÃO auto-vincula o cidadão criado de volta ao agendamento (o form não recebe o id do agendamento). Wiring do auto-vínculo = follow rápido (passar `?agendamento=ID` → form chama `vincularCidadaoAoAgendamento` no sucesso).

**Fatia B (deferida, depende de você + deploy):** WhatsApp (Meta Cloud API — confirmar provedor/número), página pública de auto-agendamento (Plano 8), grade fixa de horários, lembretes.
