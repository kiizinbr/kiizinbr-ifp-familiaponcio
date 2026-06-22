# Auditoria pré-lançamento — IFP Connect (QA consolidado)

**Data:** 2026-06-22 · **Branch:** `claude/continue-projetoifp-section-10-RKC1n`
**Modo:** revisão estática (app não rodando) — 8 agentes ECC por dimensão + verificação adversarial de cada achado.
**Resultado:** 31 achados confirmados → **P0=0 · P1=4 · P2=15 · P3=12**
**Status:** os **4 P1 foram CORRIGIDOS e verificados** (commit `09dd655`) — ver "✅ Correção dos P1" no fim.
Restam os P2/P3 + o contraste a11y do portal da família.

> ⚠️ **Ressalva de cobertura:** o servidor aplicou rate-limit (não é limite de uso da conta) durante a fase
> de verificação. As dimensões **a11y, test-gaps e silent-failures** tiveram muitas verificações abortadas, e
> achados não-verificados foram descartados. Logo: a cobertura de **segurança / LGPD / corretude está sólida**;
> a de **acessibilidade ficou subcoberta** nesta rodada — rodar de novo (ou na Camada 2, ao vivo com axe).

---

## Veredito de prontidão

**Quase-pronto-com-ressalvas — NÃO lançar antes de fechar os 4 P1.** Não há bloqueador P0: nenhuma parede de
tenant furada, nenhum IDOR de família aberto, nenhum endpoint público vazando dado em massa. Mas os 4 P1 tocam
exatamente o que dói para a primeira pessoa real: corrupção silenciosa de prontuário/membro de menor, leitura
de dossiê de segurança física de criança sem trilha, listagem de toda a base de famílias (CPF/renda) sem
registro de quem acessou, e bloqueio indevido de responsável por bug de timezone. Recomendação: resolver os
**4 P1 + os 2 P2 de segurança de borda mais baratos** (open redirect e middleware `/presidencia`) antes do
primeiro usuário; o resto entra em sprint de hardening pós-piloto controlado.

---

## 🔴 Bloqueadores (P0)

Nenhum P0 confirmado. As paredes de tenant (`resolverPorUser`), ownership de família (`fichaCidadaId`) e os 3
endpoints públicos de verificação resistiram à revisão adversarial. **Tratar os P1 abaixo como bloqueadores de
fato para o piloto** — em especial o de corrupção de prontuário de menor.

---

## 🟠 Corrigir antes (P1)

1. **`replaceMembros` apaga e recria filhos, quebrando vínculo de prontuário de menor**
   `apps/api/src/fichas-cidadas/fichas-cidadas.service.ts:186-219`
   Trocar delete+recreate por reconciliação por diff (atualiza por id, cria só novos, bloqueia remoção de
   membro com histórico clínico/educacional); adicionar soft-delete em `MembroFamiliar`.
   *O mais grave: 500 sem explicação na recepção, ou prontuário órfão silencioso.*

2. **Listagem de toda a base de famílias sem auditar o ator**
   `apps/api/src/fichas-cidadas/fichas-cidadas.controller.ts` (+ `findAll` no service)
   Controller deve passar `@CurrentUser() user` para `findAll(query, user.id)` e o service registrar
   `AcaoAuditoria.READ` com `userId`.

3. **Leitura do dossiê de autorizados (restrição judicial) sem audit READ**
   `apps/api/src/educacional/criancas.service.ts:85-93` (`listarAutorizados`)
   Adicionar `audit READ` (entidade `ResponsavelAutorizado`/`MembroFamiliar`, metadados `{ membroId }`).

4. **Timezone errado em `vigenteAte` bloqueia responsável 3h cedo**
   `apps/api/src/educacional/rotina.service.ts:77`
   Salvar/comparar `vigenteAte` como fim do dia em America/Sao_Paulo (`T23:59:59-03:00`).
   *Mesma raiz no P2 de `criancas.service.ts:107` — corrigir junto.*

---

## 🟡 Importante mas não bloqueia (P2)

- Sem rate limiting no login (brute-force) · `apps/api/src/app.module.ts`
- Swagger UI exposto em produção sem proteção · `apps/api/src/main.ts`
- Sem audit READ em `GET /medico/indicadores` · `apps/api/src/medico/beneficiarios.service.ts`
- `GET /fichas-cidadas` sem audit READ (lista de PII) · `apps/api/src/fichas-cidadas/fichas-cidadas.service.ts`
- Agenda do dia e fila da unidade sem audit READ (PII de menores) · `apps/api/src/medico/agenda.service.ts:91-105,356-369`
- Diário do dia do menor lido pelo educador sem audit READ · `apps/api/src/educacional/rotina.service.ts:220-235`
- Prancha expõe elegibilidades cross-vertical da família (minimização) · `apps/api/src/medico/agenda.service.ts:51-67`
- Race no check-in/check-out de criança (duplo registro) · `apps/api/src/educacional/rotina.service.ts:83-116`
- Race na graduação esportiva: P2002 → HTTP 500 · `apps/api/src/esportivo/graduacoes.service.ts:56-72`
- `vigenteAte` em UTC (mesmo bug do P1, vertical creche) · `apps/api/src/educacional/criancas.service.ts:107`
- Encerramento de turma ignora matrícula TRANCADA (status órfão) · `apps/api/src/capacitacao/turmas.service.ts:357-365`
- Open redirect via `callbackUrl` não validado no login · `apps/web/app/login/page.tsx:19`
- Middleware não cobre `/presidencia` em `mustChangePassword` · `apps/web/middleware.ts:26-36`
- Token de 8h sem renovação → tela em branco na sessão morta · `apps/web/lib/auth.ts:19`
- 403 em vez de 404 em `fecharDiario` vaza existência de diário · `apps/api/src/educacional/rotina.service.ts`

---

## 🟡 Nice-to-have (P3)

- 403 em vez de 404 vaza existência de crianças de outra unidade · `criancas.service.ts` (`assertCriancaDaUnidade`)
- AuditService fire-and-forget sem observabilidade/serialização da falha · `audit.service.ts:26-40`
- JWT 8h sem refresh/revogação (token roubado vale 8h) · `auth.module.ts`
- Certificados em loop sequencial dentro da transação (timeout em turma grande) · `turmas.service.ts:354-392`
- Autorizações de imagem gravadas FORA da transação de matrícula · `turmas-infantis.service.ts:127-187`
- `useConversa` invalida lista a cada fetch sem debounce (gasto de dados/bateria) · `use-mensagens.ts:99-104`
- `setTimeout` de redirect pós-selo pode vazar em componente desmontado · `medico/atendimento/[agendamentoId]/page.tsx:136-137`
- Falta `@@index([fichaId])` em `ConversaFamilia` / `MensagemFamilia` · `packages/database/schema.prisma`
- Falta `@@index([unidadeId, concedidaEm])` em `Graduacao` · `packages/database/schema.prisma`
- Falta `@@index([unidadeId, emitidoEm])` em `Certificado` + `emitidoPor` sem FK tipada · `packages/database/schema.prisma`
- (+2 nitpicks menores)

---

## 🧪 Plano de teste como usuário real (Camada 2 — app no ar)

Para cada perfil: a jornada feliz **+ as bordas de segurança** (é onde mora o risco real).

- **Médico:** agenda do dia → prancha do paciente → SOAP → selar prontuário.
  *Bordas:* (1) abrir paciente de OUTRA unidade pela URL/ID → **404, nunca 403** + audit; (2) prancha aberta >8h
  e salvar → não pode tela branca (P2 `auth.ts`); (3) prancha NÃO deve mostrar elegibilidades de outras
  verticais (P2 minimização); (4) `listarDia`/`filaUnidade`/`indicadores` devem gerar audit READ.
- **Educadora (creche):** check-in na chegada → diário do dia → check-out com responsável.
  *Bordas:* (1) dois check-ins simultâneos da mesma criança (P2 race) — estado não pode corromper; (2)
  responsável "válido até hoje" às 21h → **deve liberar** (P1 timezone); (3) restrição judicial/revogado/vencido
  → **403 COM auditoria da tentativa**; (4) criança/diário de outra unidade → **404**; (5) audit READ em
  `listarAutorizados` e `diarioDoDia`.
- **Família (responsável):** ver só a própria criança → abrir conversa → enviar mensagem.
  *Bordas:* (1) **IDOR** — trocar `fichaCidadaId`/`conversaId` na URL → bloqueado e auditado; (2) login com
  `?callbackUrl=` para domínio externo → **não redirecionar pra fora** (P2 open redirect).
- **Gestora / Serviço Social:** listar fichas (CPF/renda/vulnerabilidade) → editar composição familiar →
  publicar comunicado.
  *Bordas:* (1) editar composição removendo membro com histórico clínico → **não pode dar 500/órfão** (P1 #1);
  (2) `findAll` deve registrar audit READ do ator (P1 #2); (3) comunicado por turma com confirmação de leitura.
- **Instrutor (capacitação/esporte):** criar turma → matricular por busca → chamada → encerrar / emitir
  certificado / graduação.
  *Bordas:* (1) 2 matrículas simultâneas na última vaga (race); (2) selar chamada 2x (idempotência); (3)
  encerrar turma com aluno TRANCADO (P2 status órfão); (4) graduar 2x simultâneo (P2 P2002→500); (5) verificar
  certificado/graduação no endpoint público.
- **Admin:** criar usuário → senha provisória → troca forçada no 1º acesso.
  *Bordas:* (1) perfil X acessando rota de perfil Y → bloqueado; (2) `/presidencia` com `mustChangePassword`
  pendente → deve forçar troca (P2 gap no middleware); (3) sessão expira em 8h → não pode tela branca.

### Lacunas de automação

- **Não há suíte E2E de navegador** — só `scripts/valida-*.mjs` (nível de API). Faltam as 6 jornadas acima
  automatizadas por perfil.
- Faltam casos **negativos/abuso** automatizados: cross-tenant 404, IDOR de família, anti-enumeração, revogação
  de autorização, races de matrícula, idempotência de selo.
- **Acessibilidade sem cobertura** (nenhum axe/WCAG automatizado) — e subcoberta nesta auditoria por rate-limit.

---

*Gerado pela auditoria multi-agente `ifp-prelaunch-qa` (8 dimensões × verificação adversarial). Achados crus
em JSON disponíveis no retorno do workflow.*

---

# Camada 2 — Teste como usuário real (executado 2026-06-22)

Testado ao vivo no navegador (chrome-devtools-mcp) com o app rodando e banco re-seedado.

### Ajustes de ambiente feitos (workstation)
- **Web do IFP roda na `:3001`** nesta máquina (o `:3000` é do **RAÍZ**/Time Pôncio). Subi `next dev --port 3001`.
- **`.env`: adicionei `:3001` ao `WEB_ORIGIN`** (antes só `:3000`) — sem isso, todas as chamadas client-side
  morrem em CORS ("Failed to fetch"). ⚠️ **Checklist de deploy:** garantir que `WEB_ORIGIN` de CADA ambiente
  inclua a porta/host reais do web (no servidor o web é :3001 via Tailscale).
- **Re-seedei o banco** (`pnpm db:seed`) — dados de dev recriados (3 agendamentos hoje, João c/ alergia GRAVE,
  Caio = criança fora da unidade, 1 autorizado revogado).
- API (:3333) e web (:3001) deixados rodando como **processos Windows destacados** (o background do shell os derrubava).

### ✅ Confirmado FUNCIONANDO (com dado real)
- **Login autentica + redireciona** pro hub `/` por perfil (médico, família).
- **Portão de perfil**: médica em `/presidencia` → "Acesso restrito".
- **Parede de tenant SÓLIDA**: médica (PROFISSIONAL/MEDICO) → `esportivo/turmas`, `presidencia/jornada`,
  `presidencia/familias`, `fichas-cidadas`, `educacional/criancas/:id` = **todos 403**; controles da própria
  unidade (`medico/agenda`, `medico/beneficiarios`) = **200**. Valida empiricamente o "sem vazamento P0".
- **IDOR da família SÓLIDO**: Sandra vê a própria filha (Ana, ficha 200 / diário 200); qualquer ID não-dela
  → **403 uniforme** (sem vazar existência); conversa de outro → **404**; rota da equipe → **403**.
- **Portal da Família renderiza limpo** com empty state amigável (sem tela branca).

### 🔍 Dois "achados" investigados = FALSOS-POSITIVOS (não bug de produto)
- "Login não redirecionou" → era o **CORS** do meu setup (:3001). Corrigido o CORS, redireciona certo.
- "403 na ficha da própria filha" → eu mandei o **id da matrícula** no lugar do `crianca.id`. Com o id certo = 200.
  *(Bom exemplo da regra: verificar o achado no código antes de reportar.)*

### ✅ 2ª passada de Camada 2 (executada na sequência)

**Anti-enumeração (educadora):** `educacional/criancas/<Ana, unidade dela>` = **200**;
`<Caio, outra unidade>` = **403**; `<id inexistente>` = **403 também**. Como existente-de-outra-unidade e
inexistente respondem IGUAL, **não há vazamento de existência** → o P3 da Camada 1 **não se confirma como
vulnerabilidade** (é só convenção diferente do endpoint de conversa, que usa 404). Não-bug.

**Segurança física do menor — check-in/out (área P1) — FUNCIONA:**
- Check-in/out com autorizado **revogado** (Roberto) → **403** "autorização revogada pelo responsável legal"
  (bloqueado nos DOIS sentidos; código audita a tentativa).
- Check-in/out com autorizado **válido** (Maria) → **201**.

**Jornada clínica (médico):** agenda do dia com os 3 agendamentos seedados; prancha do João abre com o
**alerta de alergia em destaque ("Dipirona (grave)" + "Asma · J45")** e o fluxo SOAP de 5 passos
(Resumo→Queixa→Exame→Conduta→Selo). Segurança clínica visível pro médico. ✅

**Presidência (Sala de Comando):** renderiza com **KPIs cross-unidade reais** (5 famílias atendidas,
11 pessoas impactadas, 4 fichas/mês) — sem erro/tela branca. ✅

**Acessibilidade (Lighthouse mobile) — preenche o gap da Camada 1:**
- Tela de **login: A11y 100/100**, Best Practices 100.
- **Portal da Família (ficha da criança): A11y 96/100** — 1 falha real: **contraste de cor**. O token
  `text-muted-foreground` (#737373) fica **4.43 no fundo creme** (precisa 4.5 — borderline) e **1.17 sobre o
  header teal** (#007571 — quase invisível); `opacity-85` em texto 11px no header = 4.46. **Fix:** escurecer o
  token muted p/ ≥4.5:1 no creme e **nunca** usá-lo sobre header colorido (usar token claro lá). Afeta o
  público mais frágil (celular/baixa literacia).

### ⏳ Restante (mesmos padrões já validados — baixo risco)
- Smoke visual: instrutor (capacitação), esporte, gestora, admin, serviço social.
- SOAP completo preenchendo→**selando** + bloqueio de prescrição por alergia (já coberto por testes em
  `ifp-prescricao-feature`, 16/16).
- Race de matrícula na última vaga + idempotência de selo — melhor via script de carga que via clique.

---

# ✅ Correção dos P1 (2026-06-22 · commit `09dd655`)

Todos os 4 P1 corrigidos com fix mínimo, **sem migração de schema**, e verificados ponta-a-ponta
(`scripts/valida-fichas-cidadas.mjs` 8/8 + regressão educacional verde: tenant, educacional, mensagens 29/29).

| P1 | Arquivo | Correção | Verificação |
|---|---|---|---|
| #1 prontuário órfão | `fichas-cidadas.service.ts` | `replaceMembros` reconcilia por identidade natural (CPF; ou nome+nascimento p/ menores); **409** ao remover membro com histórico; quem fica mantém o id | remover Ana→409; reconciliar→Ana mantém id + cria novo→200 |
| #2 lista sem audit | `fichas-cidadas.{service,controller}.ts` | `findAll(query, leitorId)` grava audit READ `FichaCidada.lista` | audit gravado no banco c/ `userId` |
| #3 dossiê sem audit | `educacional/criancas.service.ts` | `listarAutorizados` grava audit READ `ResponsavelAutorizado` | audit gravado c/ contexto |
| #4 vigência timezone | `educacional/criancas.service.ts` + `dia-util.ts` (`fimDoDiaSP`) | `vigenteAte` salvo como fim do dia em America/Sao_Paulo | `2026-06-22` → `2026-06-23T02:59:59.999Z` |

**Não-regressão verificada:** as 2 falhas em `valida-gestao-educacional` (16/18) são **pré-existentes** —
o seed dá à `educadora@ifp.local` o perfil `GESTOR_UNIDADE`, então ela passa nos casos de RBAC que o teste
esperava bloquear. Não tem relação com estes fixes (nenhum guard/perfil foi tocado). *Follow-up:* decidir se o
seed deveria separar educadora de gestora, ou atualizar a expectativa do teste.

**Pendências de pré-lançamento que sobram:** P2/P3 da Camada 1 + contraste a11y do portal da família.
