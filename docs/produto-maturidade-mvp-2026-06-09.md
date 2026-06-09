# IFP Connect — Auditoria de Maturidade de Produto (rumo a um MVP crível)

**Data:** 2026-06-09
**Método:** workflow ECC multi-agente (`wf_26c2e7f8-79a`) — 5 auditores paralelos (clínico · programas · social/intake/cidadão · infra transversal · maturidade-UX) cruzando **estado atual × baseline de MVP** + síntese de Diretor de Produto. 6 agentes, ~920K tokens. **Contexto fixo:** instituição 100% filantrópica, **sem faturamento** — toda complexidade de cobrança/convênio/pagamento foi excluída do baseline.

---

## 1. Veredito honesto

Sim, o IFP Connect **é um MVP — mas um MVP de uma única unidade (o Centro Médico), fantasiado de plataforma multi-unidade**. O núcleo médico é genuinamente sólido e até **além de MVP**: agenda por slots com reserva anti-overbooking transacional (`src/lib/medico/agenda.ts:113-140`), máquina de estados de consulta, prontuário com CID-10, receita/atestado em PDF, painel TV com TTS, indicadores reais. Capacitação vem logo atrás (matrícula transacional, presença idempotente, evasão, certificado verificável).

O que faz parecer "cru" **não é falta de profundidade — é falta de largura e de espinha dorsal**:

- (a) metade das unidades (esportivo, recreativo, pôncio) são **stub literal** (`src/app/[unidade]/page.tsx`: "esta unidade ainda não tem painel próprio"; `poncio/page.tsx:59`: "Indicadores serão exibidos aqui");
- (b) o **motor de agenda** — a peça mais valiosa — está **algemado ao domínio médico** (`profissionalId`/`especialidadeId`/`Consulta`), então Social e Capacitação não conseguem agendar nada;
- (c) o **modelo beneficiário-cêntrico existe só como tabelas órfãs** — `Triagem`/`ElegibilidadeUnidade` estão no schema (`prisma/schema.prisma:377-412`) mas **nenhum fluxo de atendimento as lê**;
- (d) não há **"agenda do dia"** unificada, nem **comunicação proativa** (WhatsApp/lembrete = ausente), nem **exportação** (zero CSV).

> **Em uma frase: você tem uma excelente clínica e um esqueleto de plataforma — falta conectar o esqueleto.**

---

## 2. O modelo certo: beneficiário-cêntrico

Hoje o sistema é, na prática, **unidade-cêntrico** (cada unidade vê seus encaminhamentos isolados; a ficha do cidadão mostra só dados cadastrais). A visão do dono é o padrão clássico **intake → eligibility → enrollment** de case management social (CRAS/Prontuário SUAS, CiviCRM/Apricot): uma porta de entrada, uma decisão de elegibilidade **datada**, e acesso a N programas **sem re-entrevista**.

**Modelo de dados-alvo** (cidadão = hub):

```
Cidadao (hub, já existe: prisma/schema.prisma:195)
  └── Triagem (entrevista socioeconômica, já existe: :377)
        └── ElegibilidadeUnidade (já existe :399) + CAMPO NOVO: validoAte/expiraEm
              → é o "PASSE" que LIBERA operacionalmente cada unidade
  └── vínculos 360°: Consulta + Matricula + Presenca + Entrevistas (FKs já existem)
  └── AgendamentoEntrevistaSocial (NOVO): a visita à assistente social com slot real
```

| Hoje                                                                             | Alvo                                                                                |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `ElegibilidadeUnidade` = parecer arquivado sem validade                          | Elegibilidade **datada com vigência** (6-12 meses) que funciona como gate de acesso |
| Marcar consulta/matrícula ignora elegibilidade (`origemTriagemId` é campo morto) | Agendar/matricular **checa elegibilidade vigente** (gate soft no MVP, hard depois)  |
| `Triagem.dataEntrevista` é texto digitado (`:383`)                               | Entrevista social = **compromisso agendado** num calendário real                    |
| Ficha = só cadastro                                                              | Ficha = **visão 360** com timeline cross-unidade                                    |

**Migration?** Sim, mas **pequena e aditiva** (não destrutiva): (1) `validoAte` em `ElegibilidadeUnidade`; (2) generalizar o motor de slots. As FKs do beneficiário-cêntrico **já existem** — é trabalho de query + UI + uma coluna de vigência.

---

## 3. Os 3 buracos do dono, resolvidos

### Buraco 1 — "Agenda do dia"

Não existe board diário unificado — só grade **semanal** (`medico/agenda/page.tsx`) e 3 listas verticais que repetem a query do dia (landing/recepção/minha-fila). Fora do médico, **nenhuma visão "hoje"**.
**Construir:** extrair `lib/medico/agenda-dia.ts` (DRY) → rota `medico/agenda-dia` (grid diário: profissionais×horas, ocupado×livre×chegou) → generalizar pro `/inicio` (somar consultas + entrevistas + aulas do dia). **Esforço: M.**

### Buraco 2 — "Agendar a visita ao Serviço Social"

Não existe agenda da assistente social. `Triagem.dataEntrevista` é data digitada; o motor de slots só opera `Profissional` médico.
**Construir:** modelar a assistente social como recurso agendável → `AgendamentoEntrevistaSocial` ligado à `Triagem` → rota `social/agenda` alimentando a fila de triagens que já existe (`lib/triagem.ts:53`). **Esforço: M** (depois do core).

### Buraco 3 — "Agendamento dinâmico de consultas"

O agendamento **não é dinâmico** — depende 100% de slots pré-gerados por `AgendaTemplate`. Sem template → "sem horário" → impossível marcar. Sem walk-in, sem slot ad-hoc, sem ordem de chegada.
**Construir:** (1) **slot ad-hoc** dentro de `reservarSlot` (`agenda.ts:113`) respeitando o `@@unique`; (2) **walk-in/encaixe** (consulta sem slot de template → fila viva); (3) **desacoplar o motor** → `lib/agenda/core.ts` (recurso agendável = profissional | assistente social | turma/sala). **Esforço: L — é o multiplicador que resolve Buracos 1, 2 e o modelo §2 de uma vez.**

---

## 4. Roadmap priorizado

> Princípio: MVP crível = **largura mínima** (toda unidade tem casa) + **espinha beneficiário-cêntrica** (porta de entrada que funciona). Profundidade clínica já está acima do MVP — não se mexe.

### MVP-P0 — _sem isto não é MVP crível_

| Item                                                                                                 | Domínio     | Esforço | Depende de        |
| ---------------------------------------------------------------------------------------------------- | ----------- | ------- | ----------------- |
| **Desacoplar slot engine** → `lib/agenda/core.ts` (recurso agendável genérico)                       | Transversal | **L**   | —                 |
| **Agenda do dia médica** (board diário) + extrair `agenda-dia.ts`                                    | Médico      | M       | —                 |
| **Marcação dinâmica + slot ad-hoc** (marcar em horário livre, sem template)                          | Médico      | M       | core              |
| **Walk-in / ordem de chegada**                                                                       | Médico      | M       | slot ad-hoc       |
| **Agendar entrevista do Serviço Social** (calendário da assistente social)                           | Social      | M       | core              |
| **Elegibilidade com validade** (`validoAte`) + gate soft ao agendar/matricular                       | Social      | M       | migration aditiva |
| **Visão 360 do beneficiário** (`getCidadaoView` puxa consultas/matrículas/triagens + timeline)       | Social      | M       | —                 |
| **Cronograma de aulas/sessões** (`AulaSessao`) — destrava agenda-do-dia e frequência                 | Capacitação | M       | core              |
| **Tirar stubs do limbo:** Esportivo + Recreativo como turma-recorrente (reusa Turma/Presença/Sessão) | Esp./Recr.  | L       | sessão+core       |
| **Chrome canônico do kit** (sidebar agrupada + topbar + barra de ação + drawer mobile) — ver doc nav | Transversal | M       | —                 |

### P1 — _MVP maduro_

| Item                                                                                                | Domínio     | Esforço |
| --------------------------------------------------------------------------------------------------- | ----------- | ------- |
| Agenda do dia **transversal** (`/inicio`: consultas + aulas + entrevistas)                          | Transversal | M       |
| **Notificações / lembrete WhatsApp-first** (reduz no-show) — _preparar, não disparar sem aprovação_ | Transversal | L       |
| Gate de elegibilidade **hard** + referral loop fechado                                              | Social      | M       |
| Generalizar domínio **Turma** (curso-com-fim ∪ atividade-recorrente) — 1 núcleo p/ 3 unidades       | Capac./Esp. | M       |
| Triagem/priorização clínica na chegada (reordena a fila)                                            | Médico      | M       |
| **Busca global** cross-unidade                                                                      | Transversal | M       |
| Painel executivo Pôncio com **dados reais**                                                         | Pôncio      | M       |

### P2 — _depois_

Tela de auditoria consultável (LGPD) · Exportação CSV/Excel (prestação de contas à família) · Ficha de evolução do participante (atleta/criança) · Certificado p/ Esporte/Recreativo · Reavaliação periódica da situação social · Evasão em escala via job + refactor `consultas/[id]/page.tsx` (814 linhas).

### Cortado (filantropicamente desnecessário — não entra em fase nenhuma)

Faturamento/cobrança · convênio/plano/TISS · nota fiscal · gateway/PIX · tabela de preços/repasse/comissão · faturamento SUS (AIH/BPA/APAC) · cobrança de no-show · carteirinha paga/inadimplência. **Foco é atendimento social, não receita.**

---

## 5. O que JÁ está bom (não re-trabalhar)

- **Médico — núcleo acima de MVP:** anti-overbooking, máquina de estados, reagendar 1-passo, check-in, encaminhamento+encaixe, prontuário/CID-10, receita/atestado PDF, painel TV+TTS, indicadores reais.
- **Capacitação — maduro:** matrícula transacional com lock, lista de espera, presença idempotente com IDOR guard, evasão, certificado verificável, 7 suítes de teste.
- **Ficha cidadã:** CPF unique, LGPD/consentimento versionado, anexos categorizados, anonimização, RBAC, busca trigram com cursor.
- **Fundações:** `AuditLog` rico, RBAC+audit em todas as actions, busca em escala. **O motor de slots é excelente — o problema é só estar acoplado, não a qualidade.**

---

## 6. Conexão com o redesenho de navegação (chrome A kit-canônico)

Chrome e roadmap são **complementares, andam juntos**:

- **O chrome é P0, em paralelo ao slot engine** — é a **largura barata** que mata a sensação de "cru" mais rápido que qualquer feature: dá casa/identidade a TODAS as unidades, transformando stubs em "salas vazias bem-acabadas". Baixo risco, alto impacto de percepção.
- **O chrome é o esqueleto; o beneficiário-cêntrico é a espinha que passa por dentro** — a visão 360 + busca global são o que o chrome expõe (header com busca de beneficiário + ficha 360 de qualquer unidade).
- **A "agenda do dia" entra como aba "Hoje"** canônica em cada unidade (Médico já tem conteúdo; Social ganha com a agenda de entrevistas; Capacitação com `AulaSessao`); `/inicio` ganha a versão transversal (P1).

**Sequência recomendada:** chrome canônico + slot engine desacoplado **em paralelo no P0** → agendas-do-dia preenchem as abas "Hoje" → `/inicio` transversal + busca global no P1. É **largura (chrome) + espinha (beneficiário-cêntrico) + a peça que o dono nomeou (agenda/agendamento dinâmico)** que vira a resposta honesta: _hoje é um ótimo MVP de clínica; com o P0 vira um MVP crível de plataforma social do nosso porte._
