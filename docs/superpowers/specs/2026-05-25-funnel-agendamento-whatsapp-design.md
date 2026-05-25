# IFP Connect — Funil de Captação: Vaga → Agendamento → WhatsApp — Design

**Data:** 2026-05-25
**Autor:** Erick Ramos (kiizinbr) · em colaboração com Claude
**Status:** Design em discussão — várias decisões dependem do Erick (marcadas **precisa do Erick**)
**Base:** `docs/superpowers/specs/2026-05-23-ifp-connect-mvp-design.md` §5.1 (golden path) + `docs/superpowers/specs/2026-05-24-plano4-triagem-estrutura-design.md` (núcleo de triagem; seção "Aberto / próximas fatias")
**Depende de:** Plano 4 (Triagem) ✅ fatia estrutural construída · Plano 5 (Consentimento LGPD versionado) ⏳ · Plano 8 (deploy público / HTTPS / domínio) ⏳

> Este é um **design spec, não plano de implementação**. Nenhum código/schema/migration foi escrito. O objetivo é fechar as decisões com o Erick antes de qualquer fatia entrar em código.

---

## 1. Context

O funil de captação é o **upstream** da triagem que o Plano 4 deixou explicitamente em aberto. Recapitulando o funil real (contexto do Erick, 2026-05-24/25):

1. IFP **libera vagas** numa unidade.
2. **Divulga** — Instagram principalmente, mas sem regra rígida: o **link é compartilhável** (alguém repassa via WhatsApp pra outro, tudo bem).
3. Interessado **acessa o link** e **agenda a entrevista** — esse é o **primeiro contato** dele com a assistente social.
4. **Na entrevista**, a assistente social define se a pessoa está **apta ou não** → é a **triagem** (já existe — Plano 4).
5. Marcação de consulta normalmente **presencial + via WhatsApp**, conduzida pelo **time de callcenter** (role `recepcao`).

Hoje o sistema cobre o passo 4 (triagem sobre uma ficha existente). Faltam os passos 1–3 (vaga, divulgação, agendamento) e o canal de comunicação (WhatsApp) que costura tudo. O `Cidadao` já tem `statusCadastro` (`rascunho`/`ativo`/`inativo`) e `whatsappConsente Boolean` — peças pensadas exatamente pra encaixar aqui.

### Recorte e ordem recomendada

Há uma dependência dura: a **página pública de auto-agendamento** exige app exposto na internet (HTTPS + domínio = **Plano 8**) e decisões de segurança (rate-limit, captcha, dados mínimos). O **WhatsApp Cloud API** de produção exige credenciais Meta, número aprovado e webhook público.

Por isso a recomendação central deste design é **fatiar em duas camadas**:

- **Fatia A — Agendamento INTERNO (construível agora):** callcenter/social agenda a entrevista **em nome do interessado**, dentro do app autenticado. Usa o `NotificationChannel` em modo **log/no-op** (dev). Não depende de deploy público nem de credenciais Meta. Entrega valor real (o IFP já agenda hoje "na mão"; isto estrutura).
- **Fatia B — Página pública + WhatsApp de produção (depende de deploy):** página pública de auto-agendamento (Plano 8) + `NotificationChannel` em modo **WhatsApp Cloud API** (credenciais Meta). Plugada por cima da Fatia A **sem reescrever** — só troca a implementação do channel e adiciona a rota pública.

A abstração `NotificationChannel` (seção 6) é o que permite construir A agora e ligar B depois sem refazer.

---

## 2. Escopo

### 2.1 No escopo deste design (a especificar para as duas fatias)

- Modelos **`Vaga`** e **`Agendamento`** (sketch Prisma, sem migration).
- Como o `Agendamento` "vira" `Triagem` quando a entrevista acontece e como conecta ao `Cidadao.statusCadastro = rascunho`.
- Fluxo **interno** (Fatia A) detalhado + fluxo **público** (Fatia B) detalhado.
- Abstração **`NotificationChannel`** (interface + 2 implementações: WhatsApp Cloud API e log/no-op).
- Integração concreta com **WhatsApp Cloud API (Meta)**: envio de template, webhook de mensagens recebidas/status, autenticação, limites/aprovação de template.
- Integração com a **timeline** via aggregate root (`rootEntityType='cidadao'`).
- **RBAC** (quem agenda, quem vê).
- **LGPD** (dados mínimos no agendamento, consentimento, cruzamento com Plano 5).

### 2.2 Fora do escopo (planos/fatias seguintes)

- **Deploy público / HTTPS / domínio** — Plano 8. A Fatia B fica bloqueada por ele.
- **Consentimento LGPD versionado** (modelo `Consentimento` + termo versionado) — Plano 5. Aqui usamos o `whatsappConsente Boolean` que já existe + um aceite mínimo na página pública, e cruzamos com Plano 5 quando ele chegar.
- **Agenda/calendário rico da Regina** (disponibilidade real, recorrência, bloqueios) — começamos com **slots simples** (seção 5.4). Calendário avançado é fatia futura.
- **Regras de elegibilidade automáticas** — continua dependendo do domínio da Regina (Plano 4 já registrou).
- **WhatsApp Flows / mensagens interativas ricas** (listas, botões além de quick-reply de confirmação) — fatia futura; começamos com template + texto simples.
- **Fila/worker assíncrono** para envio de mensagens — MVP é envio inline best-effort (igual ao `logEvent`, não quebra o fluxo de negócio). Worker entra se volume justificar.

---

## 3. Decisões em aberto (numeradas — **precisa do Erick** salvo indicação)

1. **Provedor WhatsApp confirmado?** O Plano 4 listou Meta Cloud API / Twilio / Z-API. Este design assume **Meta WhatsApp Cloud API** (gratuito p/ a API em si, sem intermediário, doc oficial — seção 7). **precisa do Erick:** confirmar Meta, ou se prefere um BSP (Twilio/Z-API) por causa de onboarding/suporte em pt-BR. A abstração `NotificationChannel` protege a decisão, mas a implementação concreta muda.
2. **Quem é o "remetente" oficial?** Número de WhatsApp Business do IFP — já existe um número comercial que possa virar o número da API, ou vão registrar um novo? (Registrar na Meta "queima" o número pra uso normal no app WhatsApp.) **precisa do Erick.**
3. **Limite de slots por vaga?** Vaga tem um nº fixo de entrevistas que ela libera (ex.: 10 slots) ou é só uma janela de tempo com agenda aberta? **precisa do Erick** (e talvez da Regina, pra capacidade de atendimento). Default proposto: vaga tem `slotsTotais` + janela `[abreEm, fechaEm]`; agendamentos contam contra `slotsTotais`.
4. **Quem confirma o agendamento?** O agendamento criado já entra como `confirmado`, ou nasce `agendado` e alguém (callcenter) confirma depois (ex.: após o lembrete)? **precisa do Erick.** Default proposto: nasce `agendado`; callcenter confirma; lembrete automático no dia anterior.
5. **Quais dados mínimos na página pública?** Proposta enxuta (LGPD): **nome** + **telefone (WhatsApp)** + **unidade/vaga** + **horário** + **aceite de contato**. CPF **não** na página pública (coletado na entrevista). **precisa do Erick** confirmar se nome+telefone bastam ou se ele quer também e-mail/bairro pra triagem prévia.
6. **Um interessado pode ter vários agendamentos?** (ex.: remarcou, ou quer 2 unidades). Default proposto: 1 agendamento "ativo" por telefone+vaga; remarcação cria novo e cancela o anterior. **precisa do Erick.**
7. **No-show:** o que acontece quando falta (`faltou`)? Libera o slot de volta? Reagenda automático? Default proposto: marca `faltou`, **não** libera slot automaticamente (callcenter decide). **precisa do Erick.**
8. **Idioma/locale do template:** `pt_BR`. Confirmar com o Erick que os templates serão redigidos em pt-BR (afeta aprovação na Meta).
9. **Ordem das fatias confirmada?** Este design recomenda Fatia A (interno) antes da B (público). **precisa do Erick** ratificar — se ele quiser o público primeiro, a dependência de Plano 8 vira bloqueio imediato.

---

## 4. Data model (sketch Prisma — sem migration)

> Convenções seguidas: `cuid()` em `id`, enums minúsculos como os já existentes (`StatusCadastro`, `StatusTriagem`), `@db.Text` em campos longos, índices explícitos, reverse-relations no `User` quando houver FK pra ele. **Não** dupliquei dados socioeconômicos (mesma disciplina do Plano 4: fonte única no `Cidadao`).

```prisma
enum StatusVaga {
  aberta      // recebendo agendamentos
  pausada     // divulgada mas não aceita novos (slots cheios ou pausa manual)
  encerrada   // janela fechada / preenchida
}

enum StatusAgendamento {
  agendado    // criado, aguardando a entrevista
  confirmado  // confirmado (callcenter ou quick-reply do interessado)
  realizado   // entrevista aconteceu → virou Triagem
  cancelado   // cancelado por qualquer parte
  faltou      // no-show
}

/// Vaga liberada por uma unidade. Define capacidade (slots) e janela de divulgação.
/// O "link compartilhável" do funil aponta para a página pública desta vaga (Fatia B).
model Vaga {
  id          String     @id @default(cuid())
  unidade     String     // 'medico' | 'capacitacao' | 'esportivo' | 'recreativo' (UnitScope)
  titulo      String     // ex: "Turma de capacitação - Informática Básica (jun/2026)"
  descricao   String?    @db.Text
  slotsTotais Int        // capacidade de entrevistas (decisão #3)
  abreEm      DateTime   // início da janela de agendamento
  fechaEm     DateTime   // fim da janela
  status      StatusVaga @default(aberta)

  /// Slug público estável e não-sequencial pro link compartilhável (Fatia B).
  /// Não usar o id direto pra não vazar contagem/ordem. Indexado único.
  slugPublico String     @unique @default(cuid())

  criadaPorId String
  criadaPor   User       @relation("VagaCriadaPor", fields: [criadaPorId], references: [id])

  agendamentos Agendamento[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([unidade, status])
  @@index([status, abreEm])
}

/// Agendamento da ENTREVISTA (1º contato). O interessado pode ainda NÃO ser Cidadao:
/// guardamos os dados mínimos (nome + telefone). Quando a entrevista acontece, a recepção
/// cria/vincula um Cidadao (statusCadastro='rascunho') e o agendamento "vira" uma Triagem.
model Agendamento {
  id      String @id @default(cuid())
  vagaId  String
  vaga    Vaga   @relation(fields: [vagaId], references: [id], onDelete: Cascade)

  // Dados mínimos do interessado (decisão #5) — antes de existir Cidadao
  nomeInteressado     String
  telefoneInteressado String // WhatsApp normalizado (E.164 sem '+', ex: 5521999998888)
  emailInteressado    String? // opcional, só se decisão #5 incluir

  horario DateTime          // slot escolhido
  status  StatusAgendamento @default(agendado)

  // Origem: por onde entrou (auditoria + métrica de divulgação)
  origem  String @default("interno") // 'interno' (Fatia A) | 'publico' (Fatia B)

  // Vínculo tardio com Cidadao — preenchido quando a recepção materializa a ficha.
  // Null enquanto o interessado é só um "lead".
  cidadaoId String?
  cidadao   Cidadao? @relation(fields: [cidadaoId], references: [id], onDelete: SetNull)

  // Vínculo com a Triagem gerada quando a entrevista acontece (status -> realizado).
  triagemId String?  @unique
  triagem   Triagem? @relation(fields: [triagemId], references: [id], onDelete: SetNull)

  // LGPD: aceite de contato registrado no momento do agendamento público.
  // Cruza com whatsappConsente do Cidadao depois; vira Consentimento versionado no Plano 5.
  consenteContato Boolean  @default(false)
  consenteEm      DateTime?

  criadoPorId String?  // null quando origem='publico' (auto-agendamento)
  criadoPor   User?    @relation("AgendamentoCriadoPor", fields: [criadoPorId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([vagaId, status])
  @@index([telefoneInteressado])
  @@index([cidadaoId])
  @@index([horario])
}
```

**Adições reversas necessárias (sketch, não aplicar):**

- `User`: `vagasCriadas Vaga[] @relation("VagaCriadaPor")` e `agendamentosCriados Agendamento[] @relation("AgendamentoCriadoPor")`.
- `Cidadao`: `agendamentos Agendamento[]`.
- `Triagem`: `agendamento Agendamento?` (lado oposto do `@unique triagemId`).

**Notas de modelagem:**

- **`telefoneInteressado` em E.164 sem `+`** porque é o formato que a Cloud API usa no campo `to` (seção 7). Reusa o estilo de normalização do `cpf`/`cep` (dígitos limpos).
- **Slot vs. capacidade:** começamos simples — `slotsTotais` na vaga + contagem de agendamentos não-cancelados. Não há tabela de "slots" pré-materializados; o `horario` é livre dentro da janela (ou de uma grade fixa definida na UI). Calendário rico = fatia futura (decisão #3).
- **Por que `Agendamento` não exige `cidadaoId`:** o ponto central do funil é que o interessado **ainda não é cidadão**. Materializar uma ficha cedo demais sujaria a base com leads que nunca compareceram. A ficha nasce (como `rascunho`) **na entrevista**, pela recepção.

---

## 5. Fluxo

### 5.1 Ciclo de vida (estado da máquina)

```
Vaga: aberta → (slots cheios | fechaEm passou) → pausada/encerrada

Agendamento:
  agendado ──confirma──▶ confirmado ──entrevista acontece──▶ realizado
     │                        │
     └────cancela─────────────┴──────▶ cancelado
     │
     └────não compareceu────────────▶ faltou
```

Quando `Agendamento → realizado`: cria-se (ou vincula-se) `Cidadao` com `statusCadastro='rascunho'` e abre-se uma `Triagem` (status `aberta`) vinculada via `triagemId`. A partir daí o fluxo é exatamente o **Plano 4** (entrevista → parecer → elegibilidade → `statusCadastro=ativo` ao aprovar ≥1 unidade).

### 5.2 Fatia A — Agendamento INTERNO (construível agora, recomendado primeiro)

1. **Gestor/coordenação cria a Vaga** (unidade, título, `slotsTotais`, janela). Status `aberta`.
2. Interessado liga / chega / manda mensagem no WhatsApp do IFP. **Callcenter (`recepcao`) abre "Novo agendamento"** dentro do app, escolhe a vaga, digita **nome + telefone** do interessado, escolhe o **horário**. `origem='interno'`, `criadoPor=<user callcenter>`.
3. Sistema dispara, via `NotificationChannel` (em dev: **log/no-op**; em prod: WhatsApp), uma **confirmação de agendamento** pro telefone do interessado.
4. **Véspera:** lembrete automático (mesma abstração). _(Disparo agendado — ver nota em 5.5.)_
5. **No dia da entrevista**, a recepção/assistente social marca o agendamento como `realizado`: o sistema **cria a ficha `rascunho`** (ou vincula a um `Cidadao` existente por CPF/telefone) e **abre a `Triagem`**. Segue Plano 4.
6. Cancelamento/no-show: `cancelado`/`faltou` (decisão #7).

> Fatia A **não depende** de deploy público nem de credenciais Meta — roda inteira com o channel em modo log. É o que recomendo construir primeiro.

### 5.3 Fatia B — Página pública + auto-agendamento (depende de Plano 8)

1. Gestor cria a Vaga (igual A). O sistema gera o **link público** a partir de `slugPublico` (ex.: `https://app.<dominio-ifp>/vaga/<slugPublico>`). Esse é o link que vai pro Instagram e é repassado por WhatsApp.
2. Interessado acessa o link (sem login). Vê título/descrição da vaga e os **horários disponíveis** (janela − slots ocupados).
3. Preenche **dados mínimos** (decisão #5: nome + telefone + horário + **aceite de contato** LGPD). Submete.
4. Server Action valida (Zod), checa **capacidade** (slots restantes) e **rate-limit/anti-abuso** (ver LGPD/segurança, seção 9), cria `Agendamento` com `origem='publico'`, `criadoPor=null`, `consenteContato=true`, `consenteEm=now()`.
5. Dispara confirmação via WhatsApp (channel em modo produção).
6. Daí em diante = igual à Fatia A (lembrete, entrevista → `realizado` → ficha rascunho + triagem).

> Dependências de B: domínio + HTTPS (Plano 8), credenciais Meta (decisão #1/#2), webhook público (seção 7.3), decisões de segurança da rota pública (seção 9).

### 5.4 Slots — abordagem inicial

- A vaga tem `slotsTotais`. "Slots ocupados" = `count(Agendamento where status in [agendado, confirmado, realizado])`. "Disponíveis" = `slotsTotais − ocupados`.
- A UI oferece horários dentro de `[abreEm, fechaEm]`. Versão 1: grade fixa simples (ex.: blocos definidos pela coordenação) **ou** horário livre — **precisa do Erick/Regina** (decisão #3). Não materializamos uma tabela de slots agora.
- Concorrência (dois agendamentos pro último slot, sobretudo na rota pública): a verificação de capacidade roda **dentro de uma transação** (`db.$transaction`) com recontagem antes de inserir, para evitar overbooking.

### 5.5 Disparo de lembrete (vésperas)

- MVP: **sem worker dedicado.** Opções, em ordem de simplicidade: (a) endpoint interno acionado por cron do host (o ambiente CLEAN já tem agendador) que varre agendamentos do dia seguinte e dispara lembretes; (b) Next.js scheduled/route handler. Como o app é um modular monolith sem fila (decisão do MVP §3.2/§2.2), **(a) cron → rota protegida** é o caminho mais barato.
- Idempotência: marcar `lembreteEnviadoEm` (campo a adicionar quando esta sub-fatia entrar) pra não disparar duas vezes. **Fora do escopo de schema agora** — anotado como dívida quando o lembrete for implementado.

---

## 6. `NotificationChannel` — abstração de canal

A peça que permite **construir a Fatia A agora** (sem Meta) e **ligar a Fatia B depois** (com Meta) **sem reescrever** o código de negócio. O código de agendamento depende **só da interface**, nunca de uma implementação concreta.

### 6.1 Interface (sketch TypeScript — não implementar agora)

```ts
// src/lib/notifications/channel.ts  (sketch)

export interface NotificationResult {
  ok: boolean;
  /** id da mensagem no provedor (wamid no caso da Meta), pra correlacionar status. */
  providerMessageId?: string;
  error?: string;
}

export interface TemplateParams {
  /** nome do template aprovado na Meta (ex.: 'confirmacao_agendamento'). */
  templateName: string;
  /** locale do template (ex.: 'pt_BR'). */
  language: string;
  /** parâmetros posicionais do corpo do template, na ordem. */
  bodyParams: string[];
}

export interface NotificationChannel {
  /** Mensagem iniciada pelo IFP fora da janela de 24h → exige TEMPLATE aprovado. */
  sendTemplate(toPhoneE164: string, params: TemplateParams): Promise<NotificationResult>;
  /** Texto livre — só válido DENTRO da janela de 24h (resposta a uma msg do usuário). */
  sendText(toPhoneE164: string, body: string): Promise<NotificationResult>;
}
```

### 6.2 Implementações

- **`LogNotificationChannel` (dev / no-op):** loga o que enviaria (`console.info`) e retorna `{ ok: true, providerMessageId: 'log:<uuid>' }`. **Default em desenvolvimento e em testes.** Permite construir e testar todo o funil sem credenciais nem internet.
- **`WhatsAppCloudChannel` (produção):** fala com a Graph API da Meta (seção 7). Lê credenciais de env (`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_API_VERSION`). Envio **best-effort**: erro de envio **não** quebra o fluxo de negócio (mesma filosofia do `logEvent`); registra no audit log um evento de falha pra observabilidade.

### 6.3 Seleção da implementação

- Um **factory** (`getNotificationChannel()`) decide pela env: se `WHATSAPP_ACCESS_TOKEN` estiver presente → `WhatsAppCloudChannel`; senão → `LogNotificationChannel`. Validado via `src/lib/env.ts` (padrão já usado no projeto).
- **Trocar de provedor** (ex.: migrar Meta → Twilio) = escrever uma nova classe que implementa `NotificationChannel` e mudar o factory. Zero mudança no código de agendamento. É exatamente o ponto de extensão que o Plano 4 pediu ("desenhar como um channel abstrato pra plugar sem reescrever").

### 6.4 Usos no funil

| Momento                                                    | Método         | Janela                  | Template?                   |
| ---------------------------------------------------------- | -------------- | ----------------------- | --------------------------- |
| Link de divulgação (se enviado ativamente pelo callcenter) | `sendTemplate` | fora de 24h             | **sim** (marketing/utility) |
| Confirmação de agendamento                                 | `sendTemplate` | normalmente fora de 24h | **sim** (utility)           |
| Lembrete de véspera                                        | `sendTemplate` | fora de 24h             | **sim** (utility)           |
| Resposta a uma dúvida do interessado                       | `sendText`     | dentro de 24h           | não                         |

> Regra de ouro da Meta: **fora da janela de 24h só template aprovado**. Texto livre só vale como resposta dentro de 24h após a última mensagem do usuário (seção 7.4). A interface separa os dois métodos justamente pra isso ficar explícito no call site.

---

## 7. WhatsApp Cloud API (Meta) — integração concreta

> Pesquisado em 2026-05-25 via context7 (doc oficial `developers.facebook.com`) + web. Versão da Graph API citada: **v23.0** (a doc oficial usa essa nas chamadas atuais; manter em env `WHATSAPP_API_VERSION` pra versionar sem editar código).

### 7.1 Autenticação

- **Dois identificadores + um token:**
  - **Phone Number ID** — identificador do número de origem **na API** (≠ do número de telefone em si). Vai na URL.
  - **WhatsApp Business Account ID (WABA ID)** — guardar pra gerenciamento de templates.
  - **Access Token** no header `Authorization: Bearer <token>`. Dois tipos:
    - **Temporário** — gerado no painel Meta for Developers, dura **24h**, só pra teste.
    - **Permanente** — criar um **System User** no Meta Business Suite, dar permissão no app de WhatsApp e gerar o token do System User. **É o que vai pra produção.**
- **App Secret** — usado pra validar a assinatura do webhook (`X-Hub-Signature-256`, seção 7.3). Guardar em env.
- Envs propostas: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WABA_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_API_VERSION` (default `v23.0`). Nunca commitar; entrar no `.env` + `env.ts`.

### 7.2 Enviar message template

`POST https://graph.facebook.com/<API_VERSION>/<PHONE_NUMBER_ID>/messages`

```bash
curl 'https://graph.facebook.com/v23.0/<PHONE_NUMBER_ID>/messages' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "5521999998888",
    "type": "template",
    "template": {
      "name": "confirmacao_agendamento",
      "language": { "code": "pt_BR" },
      "components": [
        {
          "type": "body",
          "parameters": [
            { "type": "text", "text": "Maria" },
            { "type": "text", "text": "Centro de Capacitação" },
            { "type": "text", "text": "27/05 às 14h" }
          ]
        }
      ]
    }
  }'
```

- `to` = telefone do destinatário em **E.164 sem `+`** (ex.: `5521999998888`) — bate com `Agendamento.telefoneInteressado`.
- `components[].parameters` preenchem os placeholders (`{{1}}`, `{{2}}`, …) **na ordem** do corpo do template aprovado.
- **Texto livre** (dentro de 24h) usa `"type": "text"` com `text.body` em vez de `template` — é o `sendText` da interface.
- A resposta traz o **`wamid`** (id da mensagem), guardado como `providerMessageId` pra casar com os status do webhook.

### 7.3 Webhook (mensagens recebidas + status)

**Handshake de verificação (GET):** ao configurar o webhook, a Meta faz um `GET` na rota com os query params `hub.mode`, `hub.verify_token`, `hub.challenge`. O endpoint deve checar que `hub.mode === 'subscribe'` e que `hub.verify_token` bate com `WHATSAPP_VERIFY_TOKEN`, e **responder com o valor de `hub.challenge`** (texto puro, 200).

**Assinatura do payload (POST):** cada notificação `POST` vem com header `X-Hub-Signature-256: sha256=<hmac>`. Validar calculando **HMAC-SHA256 do corpo RAW** (antes de qualquer parse JSON) com o **App Secret**, e comparar com timing-safe (`crypto.timingSafeEqual`). **Crítico:** sem isso o endpoint aceita payloads forjados. No Next.js App Router, ler o corpo cru via `await req.text()` no Route Handler antes de `JSON.parse`.

**Payload de mensagem recebida (POST):**

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "<WABA_ID>",
      "changes": [
        {
          "field": "messages",
          "value": {
            "messaging_product": "whatsapp",
            "metadata": { "display_phone_number": "...", "phone_number_id": "..." },
            "contacts": [{ "profile": { "name": "Maria" }, "wa_id": "5521999998888" }],
            "messages": [
              {
                "from": "5521999998888",
                "id": "wamid....",
                "timestamp": "1758254144",
                "type": "text",
                "text": { "body": "Quero agendar" }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

- **Status de mensagens** chegam no mesmo formato, mas em `value.statuses[]` (cada um com `id` = wamid, `status` = `sent`/`delivered`/`read`/`failed`). Usar `statuses[].id` pra atualizar o estado da mensagem enviada.
- **Idempotência obrigatória:** a Meta entrega **at-least-once** → duplicatas são normais. Deduplicar por `messages[].id` / `statuses[].id`.
- A rota do webhook **precisa ser pública** (HTTPS) → **depende do Plano 8**. Em dev usa-se túnel (ex.: ngrok/cloudflared) só pra testar, mas a produção real é Fatia B.

### 7.4 Limites, janela de 24h e aprovação de template

- **Janela de atendimento de 24h:** disparada quando o usuário manda uma mensagem; dentro dela o IFP pode mandar **texto livre**. Fora dela, **só template aprovado**.
- **Categorias de template:** **Marketing**, **Utility** (transacional — confirmação/lembrete caem aqui) e **Authentication**. Templates passam por **aprovação da Meta** (categorização + revisão) via Meta Business Manager / Template API. Redigir em **`pt_BR`** (decisão #8). Aprovação pode levar de minutos a ~horas; planejar criar os templates **antes** do go-live da Fatia B.
- **Pricing/tiers:** o modelo é por conversa/categoria (marketing × utility × auth × service). Há um volume de mensagens de serviço gratuitas; marketing/utility são cobradas conforme tabela da Meta (varia por país). **precisa do Erick** validar custo estimado pelo volume do IFP antes do go-live — não bloqueia a Fatia A (que não envia nada real).
- Templates planejados para o IFP (rascunho, a aprovar): `confirmacao_agendamento` (utility), `lembrete_entrevista` (utility), e opcionalmente `divulgacao_vaga` (marketing/utility — depende de como será usado).

---

## 8. Integração com a timeline (aggregate root)

Reusa **exatamente** o mecanismo do Plano 3/4: `logEvent` com `rootEntityType='cidadao'` + `rootEntityId=<cidadaoId>` → aparece na timeline `/app/cidadaos/[id]/historico` **sem query nova** (a query já varre por aggregate root e captura sub-entidades).

**Desafio específico do funil:** boa parte do funil acontece **antes de existir um `Cidadao`**. Estratégia:

- **Enquanto não há `cidadaoId`** (lead puro): os eventos vão pro audit log com `entityType='agendamento'`, `entityId=<agendamentoId>`, **sem** `rootEntityType='cidadao'` (não há raiz ainda). Ficam auditáveis (quem agendou, quando), só não entram na timeline de nenhuma ficha — porque ficha não existe.
- **No momento `realizado`** (recepção materializa a ficha rascunho): a partir daí os eventos do agendamento passam a logar com `rootEntityType='cidadao'`/`rootEntityId=<cidadaoId>`. Opcional: um "backfill" leve do evento `agendamento_criado` referenciando agora a ficha, pra timeline contar a história desde o agendamento. **Decisão menor** — pode ficar pra implementação.

**Novas `AuditAction` propostas** (adicionar ao union em `src/lib/audit.ts`):

- `vaga_criada`, `vaga_encerrada`
- `agendamento_criado`, `agendamento_confirmado`, `agendamento_realizado`, `agendamento_cancelado`, `agendamento_faltou`
- `notificacao_enviada`, `notificacao_falhou` (do `NotificationChannel`, pra observabilidade)

**Labels pt-BR:** adicionar a `ACTION_LABELS` em `src/lib/cidadao-history.ts` (ex.: `agendamento_criado: "Entrevista agendada"`, `agendamento_realizado: "Entrevista realizada"`). Manter `HistoryEventAction` e `KNOWN_ACTIONS` em sincronia (mesmo padrão já usado pra triagem).

---

## 9. RBAC

Reusa `can()`/`hasAnyRole()`/`canAccessUnit()`/`getUserUnits()` de `src/lib/rbac.ts` e o filtro por unidade do `triagem.ts`. Proposta de capacidades:

| Ação                                                 | Quem pode                                                                                                                                                                   |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Criar/editar/encerrar Vaga**                       | `gestor_unidade` (da sua unidade), `gestor_geral`, `super_admin`. `social` pode ver todas (cross-unit), criar **precisa do Erick** decidir.                                 |
| **Criar agendamento interno**                        | `recepcao` (callcenter, da unidade da vaga), `social`, `gestor_unidade`, `gestor_geral`, `super_admin`.                                                                     |
| **Confirmar / marcar realizado / cancelar / faltou** | mesmos acima (quem opera o callcenter + social + coordenação).                                                                                                              |
| **Materializar ficha rascunho + abrir triagem**      | `recepcao` cria o rascunho (alinhado ao golden path §5.1 do MVP); abrir/conduzir a triagem é `social`/`gestor_geral`/`super_admin` (regra do Plano 4 — `podeFazerTriagem`). |
| **Ver vagas/agendamentos da própria unidade**        | `gestor_unidade`, `profissional`, `recepcao` da unidade (read). `social`, `gestor_geral`, `presidencia`, `super_admin` veem todas.                                          |
| **Página pública de auto-agendamento**               | **sem autenticação** (é o ponto). Protegida por capacidade da vaga + anti-abuso, não por RBAC.                                                                              |

- Helper proposto `podeAgendar(session, unidade)` e `podeGerenciarVaga(session, unidade)` em um `src/lib/agendamento.ts` (espelhando `podeFazerTriagem`), mantendo a lógica centralizada.
- Filtro por unidade idêntico ao `listEncaminhamentosUnidade`: `canAccessUnit(session, vaga.unidade)`.

---

## 10. LGPD (Lei 13.709/2018)

- **Minimização na página pública (decisão #5):** coletar só **nome + telefone + horário + aceite**. **Sem CPF, sem dados socioeconômicos** na rota pública — isso só na entrevista presencial, com a assistente social, onde o consentimento versionado é coletado (golden path §5.1 passo 2).
- **Base legal do contato por WhatsApp:** o `Agendamento.consenteContato` registra o aceite no ato do agendamento (com `consenteEm`). É o aceite **mínimo** pra mandar confirmação/lembrete. Quando a ficha é materializada, isso reflete no `Cidadao.whatsappConsente` (já existe no schema). **Cruzamento com Plano 5:** quando o `Consentimento` versionado existir, este aceite mínimo vira uma instância dele (finalidade "contato/agendamento", base legal a definir — consentimento ou execução de política pública). Anotar como ponte Plano 5.
- **Dados de "lead" sem comparecimento:** agendamentos que viram `cancelado`/`faltou` e nunca materializam ficha guardam nome+telefone. **Retenção:** definir purga (ex.: anonimizar leads não-comparecidos após N meses). **precisa do Erick/jurídico** — não bloqueia construção, mas entra na política de retenção (alinhar com a regra de 5 anos do MVP, que é pra beneficiário ativo, não pra lead).
- **Segurança da rota pública (Fatia B):** rate-limit por IP/telefone, captcha ou honeypot anti-bot, validação Zod estrita, e **nunca** ecoar dados de outros agendamentos. Isso é pré-requisito de segurança do Plano 8.
- **Audit:** todo agendamento (mesmo público) gera evento no audit log com IP/UserAgent (o `logEvent` já captura), atendendo ao "audit by default" do MVP.

---

## 11. Testing (como eu testaria)

Mesmo padrão "pure core, I/O shell" do Plano 3/4.

- **Unit (Vitest) — lógica pura, sem banco:**
  - `slotsDisponiveis(vaga, agendamentos)` → capacidade restante.
  - `podeAgendar` / `podeGerenciarVaga` (RBAC) com sessões fabricadas (igual aos testes de `rbac`).
  - Máquina de estados do `Agendamento`: transições válidas/inválidas (`agendado→realizado` ok; `cancelado→realizado` proibido).
  - `LogNotificationChannel` retorna `ok` e loga (sem rede).
  - **Validação de assinatura do webhook**: HMAC-SHA256 com timing-safe — testar payload válido vs. adulterado vs. assinatura errada. (Caso de segurança = teste de regressão obrigatório.)
  - Mapeamento de `AuditAction` do funil → labels pt-BR na timeline.
- **Integração / e2e (Playwright):**
  - **Fatia A:** callcenter cria vaga → agenda interessado → confirma → marca realizado → confirma que nasceu `Cidadao` rascunho + `Triagem` aberta + eventos na timeline. Gestor de outra unidade **não** vê a vaga (RBAC).
  - **Fatia B (quando Plano 8):** acesso público ao link → agenda → vê confirmação; overbooking bloqueado (transação); rate-limit dispara.
- **WhatsApp em testes:** sempre o `LogNotificationChannel` (sem rede). A `WhatsAppCloudChannel` real é testada manualmente contra o número de teste da Meta (sandbox), fora do CI.
- **Verificação manual / migration:** quando virar plano de implementação, `pnpm db:migrate --name add_vaga_agendamento` + `\d "Vaga"`/`"Agendamento"` no psql; **push via git nativo do Windows** (o wslrelay trava push do WSL — ver feedback-wslrelay-postgres). _(Nada disso roda neste design — só anotado pro plano futuro.)_

---

## 12. UI/UX (direção, sem código)

- **Modo denso** pro callcenter/social (criar agendamento em poucos cliques, tabela de agenda do dia). **Mobile-first** porque a recepção opera em tablet.
- Cor da vaga segue a **unidade** (tokens já em `globals.css`: `--ifp-medico`, `--ifp-capacitacao`, etc.), Garet como fonte. Página pública usa o laranja institucional `--ifp-laranja` + identidade IFP.
- Badge de status do agendamento reusa o padrão `StatusTone` de `cidadao-status.ts` (ex.: `agendado`=slate, `confirmado`=emerald, `faltou`/`cancelado`=red, `realizado`=emerald).
- Skill `frontend-design` invocada na implementação da UI (página pública sobretudo) pra evitar estética genérica.

---

## 13. Perguntas pro Erick (consolidado das decisões abertas)

1. **Provedor WhatsApp:** confirma **Meta Cloud API** (assumido aqui) ou prefere BSP (Twilio/Z-API) pelo onboarding/suporte? (decisão #1)
2. **Número remetente:** já existe um número WhatsApp Business do IFP pra virar a API, ou registramos um novo? (registrar "queima" o número pro app normal) (decisão #2)
3. **Slots por vaga:** nº fixo de entrevistas (ex.: 10) ou só janela com agenda aberta? Horário livre ou grade fixa? (decisão #3 — talvez precise da Regina)
4. **Quem confirma o agendamento:** nasce `agendado` e o callcenter confirma, ou já entra `confirmado`? (decisão #4)
5. **Dados mínimos no link público:** nome + telefone bastam, ou quer e-mail/bairro pra triagem prévia? (CPF fica pra entrevista) (decisão #5)
6. **Múltiplos agendamentos** por interessado (remarcação / duas unidades)? (decisão #6)
7. **No-show:** libera o slot de volta? reagenda automático? (decisão #7)
8. **Idioma do template:** confirma `pt_BR`? (decisão #8)
9. **Ordem das fatias:** ratifica **interno primeiro, público depois** (recomendado), ou quer o público logo (puxa Plano 8 como bloqueio imediato)? (decisão #9)
10. **Retenção de leads** não-comparecidos (LGPD): por quanto tempo guardar nome+telefone de quem nunca virou ficha? (seção 10)
11. **Custo WhatsApp:** validar custo estimado (marketing/utility) pelo volume esperado antes do go-live da Fatia B. (seção 7.4)

---

## 14. Resumo executivo

- **Construir agora (Fatia A):** `Vaga` + `Agendamento` + agendamento **interno** pelo callcenter + `NotificationChannel` em modo **log** + integração com triagem/timeline/RBAC. Não depende de deploy nem de Meta.
- **Ligar depois (Fatia B):** página **pública** de auto-agendamento + `WhatsAppCloudChannel` real. Depende de **Plano 8** (HTTPS/domínio/webhook público) e das **credenciais Meta**.
- **A abstração `NotificationChannel`** é o que torna isso possível sem retrabalho: troca-se a implementação, não o fluxo.
- **Bloqueios reais hoje:** decisões do Erick (seção 13) + Plano 8 (público) + Plano 5 (consentimento versionado, que este design "ponteia" com o aceite mínimo + `whatsappConsente`).
