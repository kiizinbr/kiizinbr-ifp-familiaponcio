# IFP Connect — Plano 4 (fatia estrutural): Núcleo de Triagem Social — Design

**Data:** 2026-05-24
**Autor:** Erick Ramos (kiizinbr) · em colaboração com Claude
**Status:** Design aprovado nos forks — aguardando revisão da spec antes do plano de implementação
**Base:** `docs/superpowers/specs/2026-05-23-ifp-connect-mvp-design.md` §5.1 (golden path triagem)
**Depende de:** Plano 3 (Ficha Cidadã) ✅ 100%

## Context

O Plano 4 do MVP é a **Triagem Social + Fluxo de aprovação multi-unidade** — o workflow da Regina (Serviço Social): entrevista o cidadão, registra parecer socioeconômico, e libera/encaminha pra cada unidade. Hoje o dashboard social (`/app/social`) mostra KPIs **hardcoded** (números fake); não existe nenhuma estrutura de triagem no banco.

### Funil real (contexto do Erick 2026-05-24)

O fluxo de ponta a ponta, como o IFP opera:

1. IFP **libera vagas** numa unidade.
2. Divulga — **Instagram** principalmente, mas sem regra rígida: o **link é compartilhável** (alguém repassa via WhatsApp pra outro, tudo bem).
3. Interessado **acessa o link** e **agenda a entrevista** — esse é o **primeiro contato** dele com a assistente social (Regina + equipe).
4. **Na entrevista**, a assistente social define se a pessoa está **apta ou não** → é a **triagem**.
5. Marcação de consulta normalmente **presencial + via WhatsApp**, conduzida pelo **time de callcenter** (role `recepcao`/callcenter — ex.: `maria.callcenter`).

Daí a importância do **WhatsApp API** que o Erick citou no início do projeto: link de divulgação, lembrete/confirmação de agendamento, marcação de consulta.

### Recorte desta spec

O Plano 4 inteiro é grande e parte dele depende de coisas que NÃO podem ser decididas/construídas sem o Erick: **WhatsApp API** (provedor + credenciais), **link público + auto-agendamento** (exige app público — só no deploy/Plano 8), e **regras de elegibilidade** (domínio da Regina). Por decisão do Erick (2026-05-24), esta spec cobre a **fatia estrutural construível agora sem essas dependências**: o **núcleo da triagem** = a *entrevista* da Regina sobre uma ficha existente (mesmo que rascunho). O funil upstream (vaga → link → agendamento) e o WhatsApp encaixam por cima depois, sem invalidar este núcleo.

**Resultado esperado:** a Regina consegue abrir uma triagem num cidadão, registrar a entrevista, concluir, e decidir manualmente a elegibilidade por unidade; o gestor da unidade vê as aprovações da sua unidade; tudo aparece na timeline do cidadão (via aggregate root do Plano 3).

## Escopo

### No escopo (fatia estrutural)
- Models `Triagem` + `ElegibilidadeUnidade`.
- Campo `statusCadastro` no `Cidadao` (rascunho/ativo/inativo).
- UI: abrir triagem num cidadão, formulário de entrevista, concluir, decidir elegibilidade por unidade (manual).
- Transição de status do cidadão (→ `ativo` ao aprovar ≥1 unidade).
- Integração com a timeline/audit (eventos de triagem na linha do tempo do cidadão).
- Dashboard social: trocar KPIs fake por contagem/lista real de triagens pendentes.
- Gestor de unidade: lista in-app das elegibilidades aprovadas/encaminhadas da sua unidade.

### Fora do escopo (fatias/planos seguintes)
- **Regras de elegibilidade automáticas** (renda/faixa etária/vaga) — espera domínio da Regina.
- **Consentimento LGPD versionado** (golden path passo 2) — é Plano 5.
- **Notificação por e-mail/push** — sem infra ainda; só in-app por ora.
- **Recepção cria rascunho mínimo** (mudança no fluxo de criação atual) — fatia posterior; por ora `statusCadastro` default `ativo`.
- **Importador CSV** — Plano 6.

## Decisões (fechadas com Erick 2026-05-24)

1. **Fatiar estrutura primeiro** — sem chutar domínio da Regina.
2. **Situação socioeconômica = parecer + observações livres** na triagem; os campos socioeconômicos *estruturados* (renda, pessoas na casa, benefício) continuam no `Cidadao` como fonte única. A triagem NÃO duplica esses campos — guarda o parecer, observações e um `Json?` flexível pra extras futuros. Evita dado divergindo em dois lugares.
3. **Notificação in-app** — gestor vê aprovações da sua unidade numa lista/badge no dashboard. E-mail fica pro plano de notificações.

## Data model (sketch Prisma)

```prisma
enum StatusCadastro { rascunho ativo inativo }
enum StatusTriagem { aberta concluida }
enum StatusElegibilidade { pendente aprovado negado encaminhado }

model Triagem {
  id                 String   @id @default(cuid())
  cidadaoId          String
  assistenteSocialId String                    // User (role social)
  dataEntrevista     DateTime?
  parecer            String?  @db.Text
  observacoes        String?  @db.Text
  situacaoSocio      Json?                      // extras flexíveis (estruturado fica no Cidadao)
  status             StatusTriagem @default(aberta)
  createdAt          DateTime @default(now())
  closedAt           DateTime?

  cidadao            Cidadao  @relation(fields: [cidadaoId], references: [id])
  assistenteSocial   User     @relation(fields: [assistenteSocialId], references: [id])
  elegibilidades     ElegibilidadeUnidade[]

  @@index([cidadaoId, createdAt])
  @@index([status, createdAt])
}

model ElegibilidadeUnidade {
  id           String   @id @default(cuid())
  triagemId    String
  unidade      String                          // 'medico' | 'capacitacao' | 'esportivo' | 'recreativo'
  status       StatusElegibilidade @default(pendente)
  motivo       String?  @db.Text
  decididoPorId String?
  decididoEm   DateTime?

  triagem      Triagem  @relation(fields: [triagemId], references: [id], onDelete: Cascade)
  decididoPor  User?    @relation(fields: [decididoPorId], references: [id])

  @@unique([triagemId, unidade])
  @@index([unidade, status])
}
```

`Cidadao` ganha `statusCadastro StatusCadastro @default(ativo)` (não quebra existentes/seedados).

## Fluxo

1. Social (Regina/equipe) abre a ficha de um cidadão → botão **"Abrir triagem"** → cria `Triagem` (status `aberta`).
2. Formulário de **entrevista**: `dataEntrevista`, `parecer`, `observacoes` (+ `situacaoSocio` Json opcional). Salva.
3. **Concluir triagem** → status `concluida`, `closedAt`.
4. Na triagem concluída, social define **elegibilidade por unidade** manualmente (pendente/aprovado/negado/encaminhado + motivo). Sem auto-sugestão (Regina pendente).
5. Ao aprovar ≥1 unidade → `Cidadao.statusCadastro = ativo`.
6. Gestor da unidade vê as elegibilidades `aprovado`/`encaminhado` da SUA unidade numa lista no dashboard (in-app).

## Integração com a timeline (aggregate root do Plano 3)

Eventos logam via `logEvent` com `rootEntityType='cidadao'`, `rootEntityId=<cidadaoId>` → aparecem na timeline `/app/cidadaos/[id]/historico` **sem query nova**. Novas `AuditAction`: `triagem_aberta`, `triagem_concluida`, `elegibilidade_decidida`. Labels pt-BR em `cidadao-history.ts` (ACTION_LABELS).

## RBAC

- **Abrir/editar/concluir triagem + decidir elegibilidade:** `social`, `super_admin`, `gestor_geral`.
- **Ver elegibilidades da própria unidade:** `gestor_unidade`, `profissional`, `recepcao` da unidade (read-only).
- Reusar `can()`/`hasAnyRole()` de `rbac.ts`; filtro por unidade igual ao `getCidadao`.

## Dashboard social (real)

Trocar os 4 `KpiCard` hardcoded de `/app/social/page.tsx` por dados reais: contagem de triagens `aberta`, lista das pendentes (link pra ficha). KPIs sem dado real ainda (visitas domiciliares) ficam ocultos ou marcados como placeholder explícito.

## Testing

- **Unit (Vitest):** lógica pura de transição — ex.: `deveAtivarCidadao(elegibilidades)` (ativa se ≥1 aprovado), label/mapeamento de eventos de triagem na timeline. Padrão "pure core, I/O shell" do Plano 3.
- **e2e (Playwright):** social abre triagem → entrevista → conclui → aprova unidade → cidadão vira ativo; gestor da unidade vê a aprovação; gestor de outra unidade NÃO vê (RBAC).

## Verificação

1. Migration aplica (`pnpm db:migrate --name add_triagem`); `\d "Triagem"`/`"ElegibilidadeUnidade"` no psql.
2. Unit + e2e verdes; ritual pré-commit (format/typecheck/lint/test).
3. Manual: como `regina@familiaponcio.org.br`, abrir triagem num cidadão seedado, concluir, aprovar unidade; confirmar evento na timeline e `statusCadastro=ativo` no psql.
4. **Push via git nativo do Windows** (wslrelay trava push do WSL — ver [[feedback-wslrelay-postgres]]).

## Aberto / próximas fatias (precisam de decisão do Erick / domínio / deploy)

Tudo abaixo é o **upstream do funil** e integrações — fora desta fatia estrutural por dependerem de coisas que não dá pra decidir/construir sozinho:

- **WhatsApp API** — escolher provedor (Meta WhatsApp Cloud API / Twilio / Z-API), obter credenciais + número aprovado. Usos: link de divulgação, confirmação/lembrete de agendamento, marcação de consulta (callcenter). Desenhar como um *channel* abstrato (interface `NotificationChannel`) pra plugar sem reescrever.
- **Link público de vaga + auto-agendamento** — página pública onde o interessado agenda a entrevista. Exige app público (HTTPS/domínio = Plano 8) + decisão de segurança (rate-limit, captcha, dados mínimos coletados).
- **Modelo `Vaga` + `Agendamento`** — gestão de vagas liberadas por unidade e agendamento de entrevista (com slot/horário). Semântica a fechar com Erick (vaga tem limite? agenda da Regina? quem confirma?). Modelo esboçado quando ele confirmar.
- **Regras de elegibilidade automáticas** (renda/idade/vaga) — **precisa Regina** passar os critérios.
- **Consentimento LGPD** versionado (golden path passo 2) — Plano 5.
- **Recepção cria rascunho mínimo** — muda o fluxo de criação atual; por ora `statusCadastro` default `ativo`.
