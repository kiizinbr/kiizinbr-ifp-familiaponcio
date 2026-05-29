# Roadmap de Produto — IFP Connect

**Data:** 2026-05-28
**Status:** prefácio de visão. Cada módulo abaixo vira sua própria spec → plano → impl quando aprovado.
**Research base:** `docs/superpowers/research/2026-05-28-saas-references-por-vertical.md`
**Princípio guia (Erick, 2026-05-28):** primeiro o sistema operacional para as unidades; depois a visão executiva dos Pôncios.

---

## 1. Visão geral

A pesquisa de SaaS de referência por vertical define o que cada unidade do IFP **pode parecer** quando o produto amadurecer:

| Unidade | Referência principal | Tela-âncora | Sensação |
|---|---|---|---|
| **Centro Médico** | Doctolib + Elation Health | Agenda semanal + fila do dia + prontuário 3 colunas | Clínica acolhedora, eficiente |
| **Capacitação** | Disco + Hotmart Club | Trilha do aluno + grade de turmas + presença mobile | Trilha curta com fim claro, cerimonial no certificado |
| **Recreativo** | Brightwheel + ClassDojo + ClassApp | Daily report 5s + check-in + mensagem família | Instituto sério que cuida com afeto |
| **Esportivo** | TeamSnap + Heja + Tecnofit | Calendário treinos + evolução radar + galeria | Esporte social motivador, transparente pra família |

A camada estrutural (rotas, RBAC, login multi-tenant) e a camada visual (DS v2 com paleta brandbook) **já estão entregues**. O que falta é dar ALMA OPERACIONAL a cada vertical.

## 2. O que cada unidade pode ter (componentes-âncora)

Cada item abaixo vira módulo aprovável. Os ✅ marcam o que já existe.

### 2.1 Centro Médico
- ✅ Ficha cidadã (compartilhada)
- ⏳ **Agenda semanal do consultório** (grid semanal, drag-to-create, profissional × dia)
- ⏳ **Fila do dia** (próximos atendimentos + presença/falta + check-in)
- ⏳ **Prontuário de atendimento** (3 colunas: histórico esquerda, evolução centro, prescrição+encaminhamento direita)
- ⏳ **Prescrição** (autocomplete medicamento + checagem interação inline + PDF)
- ⏳ **Encaminhamento** (entre profissionais e entre unidades sociais)
- ⏳ **Atestado / declaração** (PDF assinado)
- 🔮 (Plano 8) Integração Memed (prescrição digital nacional)

### 2.2 Capacitação
- ✅ Ficha cidadã (compartilhada)
- ⏳ **Catálogo de cursos / trilhas** (grade de cards com thumb + nome + vagas + horário)
- ⏳ **Turma / Cohort** (data início+fim + sala + professor + lista de alunos)
- ⏳ **Matrícula** (do beneficiário, com 3 campos mínimos)
- ⏳ **Trilha do aluno** (módulos verticais numerados, check verde, % progresso)
- ⏳ **Presença na aula** (mobile-first toggle 1 toque, lista da turma)
- ⏳ **Conteúdo da aula** (apostila PDF, vídeo de apoio, descrição)
- ⏳ **Certificado** (regra CapacitaSUAS 80% presença → PDF com QR + share WhatsApp 1-clique)
- ⏳ **Histórico do aluno** (cursos passados, certificados emitidos)

### 2.3 Recreativo
- ⏳ **Ficha da criança** (subset da cidadã + responsáveis múltiplos + autorizações granulares)
- ⏳ **Autorização de imagem** (granular: interno OK / redes sim ou não / imprensa sim ou não, revogável, assinada digital)
- ⏳ **Lista de quem pode retirar** (responsáveis autorizados + foto)
- ⏳ **Daily report ("Como foi o dia")** (educador captura foto + 2 tags + nota curta em 5–10s)
- ⏳ **Feed do responsável** (timeline de daily reports do filho, ordenado por data)
- ⏳ **Check-in / Check-out** (QR ou assinatura tablet recepção → carimbo + notifica turma + registra quem retirou)
- ⏳ **Mensagem direta família ↔ instituto** (1:1 dentro do app, substitui WhatsApp pessoal)
- ⏳ **Atividades / Eventos** (calendário de atividades recreativas, festas, passeios)
- 🔮 (futuro) App mobile do responsável (PWA simples ou nativo)

### 2.4 Esportivo
- ⏳ **Modalidades + Turmas** (futebol, vôlei, etc.; horário, vaga, professor)
- ⏳ **Matrícula aluno-atleta** (wizard 3 passos: dados do menor → responsável → modalidade)
- ⏳ **Calendário de treinos** (vista semanal + filtro por modalidade)
- ⏳ **Presença no treino** (1 toque pelo coach, similar à capacitação)
- ⏳ **Evolução do atleta** (radar/barras com atributos físico/técnico/comportamental, escala 1–5)
- ⏳ **Eventos / Competições** (calendário + inscrição + lista de participantes)
- ⏳ **Galeria** (fotos de eventos com consentimento)
- ⏳ **Portal família** (presença + próximo treino + evolução em linguagem clara)

### 2.5 Funil de entrada (cross-unidade, alimenta todas as 4)
- ✅ Vaga (modelo + status, fatia A) com horário livre
- ⏳ **Vaga com SLOTS materializados** (refactor da fatia A: cada slot = linha no banco com status disponível/reservado/bloqueado)
- ⏳ **Template de agenda recorrente** (gera slots do período num clique)
- ⏳ **Página pública de inscrição** (link compartilhável Instagram → cidadão escolhe slot → reserva)
- ⏳ **Integração WhatsApp Business** (lembrete, confirmação, troca de horário)
- ✅ Ficha cidadã (rascunho)
- ✅ Triagem socioeconômica básica
- ⏳ **Triagem refinada** (critérios de elegibilidade por unidade decididos com Regina)
- ⏳ **Encaminhamento entre unidades** (cidadão chega no /medico, vai pra /capacitacao, etc.)

### 2.6 Serviço Social (Regina)
- ✅ Painel cross-unidade
- ✅ Triagens pendentes
- ⏳ **Plano de ação por cidadão** (visit / follow-up / observações longitudinais)
- ⏳ **Encaminhamento ativo** (mover cidadão entre unidades + log)
- ⏳ **Relatórios socioeconômicos** (exportação CSV/PDF pro governo)

### 2.7 Dashboard executivo /poncio (Saulo / Simone / Sarah)
- ⏳ **KPIs reais agregados** (cidadãos ativos por unidade, triagens pendentes, taxa conclusão de capacitação, presença média esportivo, etc.)
- ⏳ **Visão financeira / orçamentária** (se o IFP tiver alguma)
- ⏳ **Mapa de impacto social** (geolocalização das famílias, indicadores territoriais)
- ⏳ **Relatórios institucionais** (anual, mensal, para doadores)
- ⏳ **Drill-down inline** (clica num KPI → ver detalhe sem sair de /poncio)

### 2.8 Cross-cutting (transversais)
- ⏳ **LGPD operacional** (consentimento versionado, ROPA, direito ao esquecimento — anonimização já parcial)
- ⏳ **WhatsApp Business** integração geral (lembretes, comunicação família, reset senha)
- ⏳ **Sistema de notificações** (toast in-app, email, WhatsApp)
- ⏳ **Audit log explorer** (filtros, exportação) — já tem audit log, falta UI
- ⏳ **Backup automatizado** (Plano 8)
- ⏳ **Deploy produção** (VM Hyper-V + Caddy + HTTPS + RLS Postgres — Plano 8)

## 3. Ordem proposta (respeitando "unidades antes de gestores")

```
FASE 1 — Verticalização operacional (4 unidades viram "produtos" próprios)
  F1.A — Capacitação  (Disco-like)        ★ recomendo começar
  F1.B — Médico       (Doctolib-like)
  F1.C — Esportivo    (TeamSnap-like)
  F1.D — Recreativo   (Brightwheel-like)  — mais complexo, fim da Fase 1

FASE 2 — Funil de entrada (refactor + integração WhatsApp)
  F2.A — Slots materializados + template recorrente (refactor Vaga)
  F2.B — Página pública de inscrição
  F2.C — WhatsApp Business integração

FASE 3 — Cross-cutting (LGPD + notificações + relatórios)
  F3.A — LGPD operacional completo
  F3.B — Sistema de notificações
  F3.C — Audit log explorer + relatórios

FASE 4 — Executivo & Deploy
  F4.A — /poncio com KPIs reais + drill-down
  F4.B — Plano 8: deploy + backup + RLS + HTTPS
```

### Por que essa ordem?

**Fase 1 antes de tudo** porque a parte funcional é o que a equipe usa todo dia e o que a diretoria vai julgar. Sem isso, o resto perde escala.

**Capacitação como F1.A** (e não Médico como instinto sugeriria):
- Menor escopo (turmas + presença + certificado < agenda + prontuário + prescrição)
- Valida o padrão "tela-âncora vertical" em ~3 dias antes de atacar o caro
- Luciana (gestora capacitação) é construção parceira; entrega pequena que dá tração emocional
- Certificado cerimonial = momento "WOW" pra famílias (primeiro certificado da vida do beneficiário, como a research apontou)
- Se algo der errado no padrão, descobrimos em escala pequena

**Médico como F1.B** logo depois:
- Doctolib é a referência mais "WOW" da pesquisa — tela impressionante pra apresentar
- Atende Raquel (a que criticou "muito simples") — grande win de PR interno
- Hoje usam Amplimed externo; trazer pra IFP Connect = ganho operacional real
- Já testou o padrão F1.A, sabe o que esperar

**Recreativo por último na Fase 1**:
- O mais complexo (LGPD criança + autorização imagem + app responsável + ficha criança ≠ cidadã)
- Daniel (gestora) precisa de mais discovery
- LGPD aqui é módulo transversal (F3.A) — melhor decidir LGPD antes (Fase 3)

**Fase 2 antes de Fase 3** porque funil de entrada é a porta. Sem funil novo, as 4 unidades operam mas dependem do callcenter pra agendar.

**Fase 4 (Pôncio + Deploy) por último** — exatamente o que você disse: "primeiro quero sistema funcionando, depois pensar a visão final dos Pôncios". E sem produção (Plano 8), Pôncio executivo é maquete.

## 4. Sobre cada vertical — micro-spec orientativa

Cada vertical, quando aprovada, vai brainstormar 6–10 decisões abertas. Aqui só o esqueleto:

### F1.A — Capacitação (3 sub-módulos, ~3 dias)
- **F1.A.1 Catálogo + Turma + Matrícula** (CRUD básico)
- **F1.A.2 Presença mobile-first** (lista da turma com toggle 1 toque + offline-tolerante)
- **F1.A.3 Trilha do aluno + Certificado** (progressão visual + PDF QR + share)

### F1.B — Médico (3 sub-módulos, ~4 dias)
- **F1.B.1 Agenda + fila do dia** (semanal Doctolib-like + painel lateral)
- **F1.B.2 Prontuário 3 colunas** (histórico ≤ evolução ≤ ações)
- **F1.B.3 Prescrição + encaminhamento** (PDF; sem Memed por ora)

### F1.C — Esportivo (3 sub-módulos, ~3 dias)
- **F1.C.1 Modalidades + Turmas + Matrícula** (similar capacitação, com responsável)
- **F1.C.2 Presença + calendário treinos** (reusa muito da F1.A.2)
- **F1.C.3 Evolução do atleta** (radar/barras + portal família)

### F1.D — Recreativo (5 sub-módulos, ~5 dias)
- **F1.D.1 Ficha da criança + responsáveis + autorizações** (mais complexa)
- **F1.D.2 Daily report** (captura rápida 5–10s; foto + tags + nota)
- **F1.D.3 Feed do responsável** (timeline)
- **F1.D.4 Check-in/Check-out + lista de quem retira**
- **F1.D.5 Mensagem família ↔ instituto**

## 5. Estimativa grossa

- **Fase 1 completa**: ~15 dias úteis (3 semanas) de trabalho focado
- **Fase 2**: ~5 dias (1 semana)
- **Fase 3**: ~5 dias (1 semana)
- **Fase 4**: ~3 dias (~1 semana incluindo deploy real)

**Total: ~5 semanas** de trabalho contínuo pra ter um sistema operacionalmente completo nas 4 unidades + funil + LGPD + executivo + produção.

## 6. O que NÃO está aqui

- App mobile nativo (PWA cobre 95% dos casos por ora)
- Integrações fora do escopo IFP (Memed, gov.br Educa, etc.)
- Sistema financeiro/contábil (IFP usa outros)
- Recursos humanos (folha de pagamento da equipe)
- ERP de doações / captação de recursos (frente separada se o IFP precisar)

## 7. Próximo passo

Aprovar a primeira fatia. Eu recomendo **F1.A — Capacitação** começando pelo sub-módulo **F1.A.1 (Catálogo + Turma + Matrícula)**, mas você pode escolher diferente baseado em:
- Qual gestora você quer atender primeiro
- Qual unidade tem demo iminente
- Qual módulo te parece mais arriscado e quer derrubar primeiro
- Outra ordem que eu não vi
