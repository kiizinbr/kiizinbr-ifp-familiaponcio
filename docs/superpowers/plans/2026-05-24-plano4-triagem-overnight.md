# Plano 4 — Núcleo de Triagem — Execução Overnight 2026-05-24

**Spec:** `docs/superpowers/specs/2026-05-24-plano4-triagem-estrutura-design.md`
**Contexto:** Erick autorizou execução autônoma da **fatia estrutural** enquanto dorme. Forks de produto fechados; o que dependia de domínio (Regina), chaves (WhatsApp) ou deploy (link público) está DEFERIDO e documentado na spec — NÃO executar.

## Regras de operação (BLOQUEANTES — herdadas do autopilot de 2026-05-24)

1. **Apenas tarefas T1–T9 abaixo.** Ideia nova → "Backlog descoberto", NÃO executar.
2. **Commit atômico por tarefa**, mensagem clara, rollback fácil.
3. **Push só fast-forward na `main`** — **via git NATIVO do Windows** (`git -C "C:\Users\Administrador\ifp-connect" push origin main` no PowerShell). O push de dentro do WSL trava (wslrelay). Nunca `--force`/rebase.
4. **Schema:** pode mexer em `schema.prisma` SE criar migration (`pnpm db:migrate --name ...`).
5. **Nunca tocar:** `auth.ts` (segurança), `.env.local`/`.env.example` (segredos), `docker-compose.dev.yml` (volumes), settings do GitHub, outros projetos do Erick.
6. **Pre-commit ritual OBRIGATÓRIO** antes de cada commit: `pnpm format && pnpm format:check && pnpm typecheck && pnpm lint && pnpm test`. Só commita se tudo verde.
7. **TDD onde há lógica:** teste primeiro pra função pura, ver falhar, implementar.
8. **Se confuso / decisão de produto aparecer**, PARAR e anotar em "Bloqueado". Não chutar.
9. Todos os comandos rodam DENTRO do WSL (`wsl -d Ubuntu -- bash -c "cd /mnt/c/... && ..."`). Só o `git push` é pelo Windows.

---

## Tarefas (ordem; parar à primeira que peça input)

### T1 — Schema + migration `add_triagem`

- Enums `StatusCadastro {rascunho ativo inativo}`, `StatusTriagem {aberta concluida}`, `StatusElegibilidade {pendente aprovado negado encaminhado}`.
- Model `Triagem` (cidadaoId, assistenteSocialId, dataEntrevista?, parecer? text, observacoes? text, situacaoSocio Json?, status default aberta, createdAt, closedAt?) + relations + `@@index([cidadaoId, createdAt])`, `@@index([status, createdAt])`.
- Model `ElegibilidadeUnidade` (triagemId, unidade, status default pendente, motivo? text, decididoPorId?, decididoEm?) + `@@unique([triagemId, unidade])`, `@@index([unidade, status])`.
- `Cidadao`: `statusCadastro StatusCadastro @default(ativo)` + relation `triagens Triagem[]`.
- `User`: back-relations `triagensConduzidas Triagem[]`, `elegibilidadesDecididas ElegibilidadeUnidade[]`.
- Migration `add_triagem`. **Verificar:** `\d "Triagem"`/`"ElegibilidadeUnidade"` + `pnpm build`.

### T2 — AuditAction + integração com a timeline

- `audit.ts`: `AuditAction` += `triagem_aberta | triagem_concluida | elegibilidade_decidida`.
- `cidadao-history.ts`: `HistoryEventAction` + `ACTION_LABELS` (ex.: "Triagem aberta", "Triagem concluída", "Elegibilidade decidida") + `detalheDe` (elegibilidade → "Centro X: aprovado").
- `historico/page.tsx`: `DOT_COLOR` pras 3 actions.
- **TDD:** estender `tests/unit/cidadao-history.test.ts` (labels + detalhe das novas actions).

### T3 — `lib/triagem.ts` (pure core + I/O shell)

- **Pure (TDD):** `deveAtivarCidadao(elegibilidades): boolean` — true se ≥1 `aprovado`. Teste `tests/unit/triagem.test.ts` primeiro.
- **I/O:** `getTriagem(id, session)`, `listTriagensPendentes(session)`, `getTriagemPorCidadao(cidadaoId, session)` com RBAC (social/super_admin/gestor_geral via `hasAnyRole`/`can`).

### T4 — Server actions `triagem-actions.ts`

- `abrirTriagem(cidadaoId)`, `salvarEntrevista(triagemId, {dataEntrevista, parecer, observacoes})`, `concluirTriagem(triagemId)`, `decidirElegibilidade(triagemId, unidade, status, motivo)`.
- Cada uma: RBAC + `logEvent` com `rootEntityType='cidadao'`, `rootEntityId=cidadaoId` (aparece na timeline).
- `decidirElegibilidade`: se `deveAtivarCidadao` → `cidadao.statusCadastro = ativo`.
- `revalidatePath` da ficha + triagem.

### T5 — UI da triagem

- Botão "Abrir triagem" no detalhe do cidadão (roles social) → cria + navega.
- Página `/app/cidadaos/[id]/triagem` (ou `[triagemId]`): form de entrevista (data, parecer, observações), botão Concluir, e grade de elegibilidade por unidade (4 unidades × select status + motivo).
- Read-only quando `concluida` exceto a elegibilidade.

### T6 — Dashboard social com dados reais

- Trocar os 4 `KpiCard` hardcoded de `/app/social/page.tsx` por: contagem real de triagens `aberta` + lista das pendentes (link pra ficha/triagem). KPIs sem dado real → ocultar ou marcar placeholder explícito.

### T7 — Gestor de unidade: elegibilidades da sua unidade (in-app)

- Em `/app/[unit]/page.tsx`: lista das `ElegibilidadeUnidade` `aprovado`/`encaminhado` da unidade do gestor (read-only). Substitui notificação por e-mail (deferida).

### T8 — e2e `tests/e2e/triagem.spec.ts`

- social abre triagem num cidadão seedado → preenche entrevista → conclui → aprova 1 unidade → cidadão fica `ativo` (verificar no detalhe/badge).
- RBAC: gestor de OUTRA unidade não vê aquela elegibilidade.

### T9 — Fechamento

- Atualizar `[[project-ifp-connect]]` + este log + "Relatório da manhã" abaixo.

---

## NÃO fazer (pedir ao acordar)

- ❌ WhatsApp API (provedor/credenciais) · ❌ Link público + auto-agendamento · ❌ Modelo Vaga/Agendamento · ❌ Regras de elegibilidade automáticas · ❌ Consentimento LGPD · ❌ Subir fora de localhost · ❌ Tocar em auth/.env/docker-compose/outros projetos.

## Bloqueado

_(vazio)_

## Backlog descoberto

_(vazio)_

## Log de execução

| Commit    | Task | Nota                                                      |
| --------- | ---- | --------------------------------------------------------- |
| `55ddb07` | spec | funil real + deferrals                                    |
| `0ff4132` | plan | este doc                                                  |
| `2f786f7` | T1   | schema Triagem/Elegibilidade + statusCadastro + migration |
| `7b0e803` | T2   | audit actions + timeline (2 testes)                       |
| `f156549` | T3   | lib triagem (deveAtivarCidadao 4 testes + leitura RBAC)   |
| `79e9931` | T4   | server actions abrir/entrevista/concluir/elegibilidade    |
| `ce7bc26` | T5   | UI triagem (página + form + link no detalhe)              |
| `597497b` | T8   | e2e (4 cenários) + data-testid · 31/31 e2e verdes         |
| `74a9646` | T6   | dashboard social com dados reais                          |
| `0518631` | T7   | gestor da unidade vê encaminhamentos                      |
| `27a0638` | —    | elevação visual da triagem (frontend-design) PREVIEW      |

## Relatório da manhã ✅

**Plano 4 fatia estrutural ENTREGUE e testada.** Tudo no `origin/main` (push via git Windows).

**Funciona de ponta a ponta:** assistente social abre triagem num cidadão → registra entrevista (parecer/observações) → conclui → decide elegibilidade por unidade (manual) → ao aprovar ≥1 unidade o cidadão vira `ativo`. Eventos aparecem na timeline do cidadão. Dashboard social mostra triagens pendentes reais; gestor de unidade vê os encaminhamentos da sua unidade.

**Verificação:** 36 testes unit + 31 e2e verdes; ritual pré-commit (format/typecheck/lint/test) + build OK em cada commit. Zero regressão nos specs antigos.

**Limitações conhecidas (honestas):**

- A transição `statusCadastro` rascunho→ativo está implementada + testada (unit `deveAtivarCidadao`), mas NÃO é observável na UI ainda porque todo cidadão nasce `ativo` por default (criação de rascunho é fatia futura).
- A **elevação visual (frontend-design) foi só na tela de triagem** — é um PREVIEW da direção. Os dashboards (social/unidade) ainda têm muito placeholder/fake fora dos painéis reais que troquei. Recomendo estender a direção visual a eles (ver recomendações).

## Recomendações (fluxos + design — pra decidirmos juntos)

**Fluxo:**

1. **Funil de vaga → agendamento:** modelar `Vaga` (por unidade, com nº de slots) + `Agendamento` (interessado escolhe horário). O agendamento "vira" uma triagem quando a entrevista acontece. Sugiro começar pela versão INTERNA (callcenter agenda em nome do interessado) antes da página pública.
2. **WhatsApp:** recomendo **Meta WhatsApp Cloud API** (oficial, grátis até volume alto, templates aprovados) sobre Z-API/Twilio pro caso de vocês (divulgação de link + confirmação de agendamento + lembrete). Desenhar como `NotificationChannel` abstrato → troca de provedor sem reescrever.
3. **Recepção cria rascunho:** fazer a criação nascer `rascunho` e só virar `ativo` pós-triagem dá sentido real ao ciclo de vida + ao funil.
4. **Elegibilidade automática:** quando a Regina passar os critérios, vira uma função pura `sugerirUnidades(cidadao)` que pré-preenche os status (ela só confirma) — fácil de plugar.

**Design (preview na triagem aponta a direção):**

5. Estender a linguagem da triagem (cantos 2xl, laranja institucional como fio, cor por unidade, jornada/stepper) aos **dashboards social e de unidade** — hoje são cards genéricos + dados fake. Um passe `frontend-design` neles unificaria o visual.
6. Badge de `statusCadastro` no detalhe do cidadão (Rascunho/Ativo) quando o ciclo de vida começar a variar.

## Próximas perguntas pro Erick

1. **WhatsApp API:** confirma Meta Cloud API? Tem número/conta Business pra vincular?
2. **Vaga/Agendamento:** vaga tem limite de slots? agenda da Regina é por horário fixo? quem confirma — callcenter?
3. **Regras de elegibilidade:** levantar com a Regina os critérios (renda/idade/vaga) por unidade.
4. **Design:** aprova a direção visual do preview da triagem? Estendo aos dashboards?
