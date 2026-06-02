# Escopo Visual Completo — IFP Connect

**Documento de briefing para designer externo**
Data: 2026-06-01 · Versão: 1.0 · Autor: Arquitetura de Produto + Direção de Design (IFP Connect)
Cliente: Instituto Família Pôncio (IFP) — Duque de Caxias / RJ

---

## Como ler este documento

Você (designer) **nunca viu o código** desta plataforma — este documento é deliberadamente **exaustivo e auto-suficiente**. Ele descreve TUDO: cada tela existente e planejada, cada papel de usuário, o login, a integração de WhatsApp, os módulos transversais e as restrições de marca.

O seu trabalho será **propor o escopo visual do webapp e sugerir ideias** — você recebe junto a paleta do brandbook. Leia primeiro as seções 1 a 3 (visão e contexto), depois mergulhe no **inventário de telas (seção 4)**, e termine no **guia para o designer (seção 11)**, que aponta por onde começar.

Termos de estado usados no inventário:

- **Pronta** — tela existe no código, funcional.
- **Backend pronto / UI pendente** — a lógica existe, mas a interface ainda precisa ser desenhada e construída.
- **Em construção** — parcialmente feita.
- **Spec-pronta** — desenho funcional definido (modelo de dados, rotas, regras), mas ainda não construída.
- **Planejada / ideia-inicial** — existe só como referência de mercado e posição no roadmap; sem desenho funcional ainda. **É aqui que mais precisamos da sua proposta visual.**

---

## 1. Visão & ambição

O **IFP Connect** é a **plataforma operacional única das 4 unidades do Instituto Família Pôncio**, um instituto social em Duque de Caxias / RJ. As unidades são:

1. **Centro Médico** — atendimento de saúde para a comunidade.
2. **Capacitação** — cursos e formação profissional (trilha CapacitaSUAS).
3. **Recreativo** — atividades para crianças (creche / contraturno).
4. **Esportivo** — modalidades esportivas para crianças e jovens.

Mais duas áreas de gestão que não são "unidades de atendimento" mas vivem na mesma plataforma:

5. **Pôncio Executivo** — painel da diretoria (visão agregada, read-only).
6. **Serviço Social** — equipe transversal que faz a triagem socioeconômica de todos os atendidos.

**A ambição declarada do dono:** elevar o instituto a um padrão de **"primeiro mundo / referência social regional"**. Em vez de um sistema administrativo genérico, cada unidade deve se sentir como **seu próprio produto premium** — espelhando um SaaS de referência de mercado por vertical (detalhe na seção 3). A camada estrutural (rotas, RBAC, login multi-tenant, design system v2 com a paleta do brandbook) **já está entregue**; o que falta é dar **"alma operacional"** a cada vertical.

**Princípio-guia do dono (Erick), de 2026-05-28:** _"primeiro o sistema operacional para as unidades; depois a visão executiva dos Pôncios."_ Operacionalmente: cada uma das 4 unidades "vira seu próprio produto" — com sua tela-âncora vertical, seus componentes-âncora e a sensação do SaaS de referência correspondente. A visão executiva (painel Pôncio) fica deliberadamente por último: _"sem produção, Pôncio executivo é maquete."_

**Por que o visual importa muito aqui:** é um **instituto social que atende público vulnerável** (saúde, crianças, famílias de baixa renda). O visual precisa transmitir **dignidade, confiança e seriedade**, ao mesmo tempo que é **denso, preciso e eficiente** para a equipe que usa todo dia. O dono pediu explicitamente fugir do "conservador" e buscar a sensação de **"ferramenta clínica premium"** (ver seção 10).

> Nota de procedência: as expressões "primeiro mundo", "referência social regional" e o enquadramento "4 unidades em Duque de Caxias/RJ" são o enquadramento estratégico do produto. O que está textualmente documentado é a ambição de **espelhar SaaS de referência premium por vertical** e o princípio "unidades antes de gestores".

---

## 2. Arquitetura técnica (resumo para contexto)

Você não precisa programar, mas entender estes pontos ajuda a desenhar coerente:

- **Stack:** Next.js (App Router, versão 16) no front e back, **PostgreSQL** via **Prisma** (ORM), autenticação via **NextAuth/Auth.js**, armazenamento de arquivos em **MinIO** (bucket de anexos do cidadão). Deploy real (HTTPS, domínio, backup) é o "Plano 8", ainda pendente.
- **Multi-tenant por PATH (caminho de URL), não por subdomínio.** Cada unidade é um segmento da URL: `/medico`, `/capacitacao`, `/esportivo`, `/recreativo`, `/poncio`, `/social`. O login é por unidade: `/[unidade]/login`. Isso significa que **a marca do IFP é única e compartilhada** — a diferenciação por unidade é **cerimonial e concentrada no login** (ver seção 7), não um rebranding por unidade no app autenticado.
- **RBAC v2 (controle de acesso por papel), multi-tenant.** 6 papéis de usuário. Um "porteiro" central (no arquivo `proxy.ts`) decide, a cada requisição, se o usuário pode entrar naquela unidade. Detalhe completo na seção 6.
- **Design System v2 já entregue:** tokens de cor/espaço/raio/sombra vivos em CSS, tipografia **Garet**, e 5 componentes universais já extraídos (Button, Input, Card, Badge, EmptyState). Você pode propor evoluir/substituir isso — desde que **mantenha a paleta do brandbook e os logos** (seção 10).
- **Banco de dados:** 21 entidades (models) + 8 enums, organizados por domínio: autenticação/RBAC, cidadão/família, triagem/elegibilidade, funil de captação, Centro Médico (agenda) e Prontuário, mais auditoria append-only. Você não precisa decorar isso, mas a seção 4 e 5 traduzem cada entidade em tela/fluxo.

**Implicação de design importante:** o app autenticado é **uma marca só** (IFP), com a cor da unidade entrando apenas como **sinal funcional discreto** (ex.: faixa de topo no card, cor de destaque na agenda). A "explosão de cor" da unidade acontece **no login** (a porta de entrada cerimonial). Não desenhe 4 apps diferentes — desenhe **1 app coeso** com sotaques de cor por contexto.

---

## 3. As 6 áreas e seus "produtos" (referências de mercado)

Cada unidade deve evocar a sensação de um SaaS de referência premium. Use estas referências como **inspiração de qualidade e densidade**, não para copiar o look.

| Área                 | O que é                                                            | Referência de mercado                          | Sensação-alvo                                                             |
| -------------------- | ------------------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------- |
| **Centro Médico**    | Clínica social: agenda, fila do dia, prontuário                    | **Doctolib** + **Elation Health**              | Clínica acolhedora **e** eficiente; ferramenta clínica densa e precisa    |
| **Capacitação**      | Cursos, turmas, matrícula, presença, certificado                   | **Disco** + **Hotmart Club**                   | Trilha curta com fim claro; **cerimonial no certificado** (momento "WOW") |
| **Recreativo**       | Creche/contraturno infantil: diário, check-in, mensagens à família | **Brightwheel** + **ClassDojo** + **ClassApp** | Instituto sério que **cuida com afeto**; captura de momento em 5-10s      |
| **Esportivo**        | Modalidades, treinos, presença, evolução do atleta                 | **TeamSnap** + **Heja** + **Tecnofit**         | Esporte social motivador, **transparente para a família**                 |
| **Pôncio Executivo** | Painel da diretoria, KPIs agregados                                | (Dashboard executivo de impacto social)        | Sobriedade, autoridade, visão de impacto                                  |
| **Serviço Social**   | Triagem socioeconômica transversal                                 | (Console de caseworker)                        | Transversal, organizado, foco em fila de trabalho                         |

**Maturidade atual (importante para calibrar esforço):**

- **Centro Médico:** o mais maduro. Agenda + fila **entregues**; prontuário com **backend pronto, UI pendente** (é uma das telas-flagship a desenhar).
- **Capacitação:** **spec-pronta** (catálogo + turmas + matrícula desenhados funcionalmente); presença e certificado são fase futura.
- **Esportivo e Recreativo:** apenas **ideia-inicial** (referência + posição no roadmap). **Campo aberto para a sua proposta visual.**
- **Pôncio Executivo e Social:** existem como telas reais simples (placeholders/KPIs); a versão rica é planejada.

---

## 4. INVENTÁRIO COMPLETO DE TELAS

Total atual no código: **28 telas (page.tsx)** + 2 APIs (sem UI). Abaixo está TUDO — existente E planejado — agrupado por área. Telas marcadas **(rota atual)** mostram o caminho de URL real.

### 4.0 Telas públicas / transversais (sem login ou de entrada)

| Tela                        | Rota                  | O que faz                                                                                                                                                                                                              | Estado                                                                     |
| --------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Landing institucional       | `/`                   | Página pública do instituto. Lista as 4 unidades de atendimento com link de login por unidade + link "Acesso executivo" para o login do Pôncio. Mostra o lockup/leão (uso cerimonial).                                 | **Pronta**                                                                 |
| Login global                | `/login`              | Login genérico (grupo de rota `(auth)`). Renderiza o formulário e mostra erro vindo da URL. Usa o lockup institucional.                                                                                                | **Pronta**                                                                 |
| Login por unidade           | `/[unidade]/login`    | Login **temático por unidade** (slug dinâmico): cobre `/medico/login`, `/capacitacao/login`, `/esportivo/login`, `/recreativo/login`, `/poncio/login`, `/social/login`. Cor/gradiente/mascote da unidade. Ver seção 7. | **Pronta**                                                                 |
| Home genérica da unidade    | `/[unidade]`          | Tela de boas-vindas pós-login para slugs ainda sem módulo próprio. Valida sessão + acesso à unidade; redireciona para login se não autenticado.                                                                        | **Pronta** (placeholder; será substituída pela home rica de cada vertical) |
| Recuperar senha             | `/reset`              | Formulário de e-mail que mostra mensagem de envio. **SMTP ainda é TODO (Plano 8)**; a tela `/reset/[token]` (definir nova senha) ainda **não existe**.                                                                 | **Em construção**                                                          |
| Página pública de inscrição | `/vaga/[slugPublico]` | **Funil público:** link compartilhável (Instagram/WhatsApp). Interessado **sem login** vê a vaga e horários, preenche dados mínimos e reserva. Ver seção 8.                                                            | **Planejada (F2.B)**                                                       |

### 4.1 Centro Médico (`/medico/*`) — referência Doctolib/Elation

| Tela                                         | Rota                               | O que faz                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Estado                                                                                     |
| -------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Home / Fila do dia                           | `/medico`                          | Header com data + saudação, KPIs do dia (consultas hoje / pendentes na semana / próximas 24h), **fila do dia** como tabela ordenada por hora (profissional, especialidade, cidadão, status, ações check-in/realizada/faltou), botão "Marcar nova consulta", link "Ver agenda semanal".                                                                                                                                                                                                         | **Pronta**                                                                                 |
| Agenda semanal                               | `/medico/agenda`                   | **Grid visual 7 dias × 07h–22h** (estilo Doctolib). Slots coloridos pela cor da especialidade; reservado = nome curto do cidadão; bloqueado = listras diagonais; disponível = vazio claro. Filtros: especialidade (multi) + profissional (single); navegação semana anterior/próxima.                                                                                                                                                                                                          | **Pronta**                                                                                 |
| Minha agenda (self-service)                  | `/medico/minha-agenda`             | Para o profissional: "meu template ativo", criar novo template de horário (dias da semana, início/fim, duração 30/45/50/60 min, especialidade, validade), lista de próximos slots gerados, botão "Bloquear" por slot (modal de motivo). Empty state para não-profissional.                                                                                                                                                                                                                     | **Pronta**                                                                                 |
| Especialidades (CRUD)                        | `/medico/especialidades`           | Catálogo de especialidades: criar, editar, ativar/desativar. A **cor da especialidade** define a linguagem visual da agenda. Lista cresce (clínico, enfermagem, pediatria, ginecologia, odonto, psicologia, fisio, fono, endo, neuro...).                                                                                                                                                                                                                                                      | **Pronta**                                                                                 |
| Profissionais (lista)                        | `/medico/profissionais`            | Tabela: foto + nome + conselho de classe + especialidades + contagem de slots/consultas + status ativo. Botão "Adicionar" se tiver permissão.                                                                                                                                                                                                                                                                                                                                                  | **Pronta**                                                                                 |
| Novo profissional                            | `/medico/profissionais/novo`       | Cadastro: vincula a um usuário existente (busca) ou cria novo, define conselho (CRM/CRO/CRP/COREN) + número, especialidades, bio, foto (MinIO).                                                                                                                                                                                                                                                                                                                                                | **Pronta**                                                                                 |
| Detalhe/edição do profissional               | `/medico/profissionais/[id]`       | Edita especialidades e templates de agenda; toggle ativo. Editável por gestor **ou pelo próprio** profissional.                                                                                                                                                                                                                                                                                                                                                                                | **Pronta**                                                                                 |
| Marcar consulta (wizard)                     | `/medico/consultas/nova`           | **Wizard 4 passos** (Stepper): (1) buscar cidadão → (2) escolher especialidade → (3) ver slots disponíveis nos próximos 30 dias → (4) confirmar reserva (resumo + observação). Reserva o slot ao confirmar.                                                                                                                                                                                                                                                                                    | **Pronta**                                                                                 |
| Detalhe da consulta + transições             | `/medico/consultas/[id]`           | Mostra paciente/profissional/especialidade/slot/status, linha de botões contextuais (Confirmar / Iniciar atendimento / Realizada / Faltou / Cancelar com motivo) e sidebar "ficha resumida".                                                                                                                                                                                                                                                                                                   | **Pronta** (a área de prontuário ainda mostra "Prontuário · Em breve" em layout 2 colunas) |
| **Prontuário 3 colunas (Elation)**           | dentro de `/medico/consultas/[id]` | **TELA-FLAGSHIP A DESENHAR.** Substitui o placeholder por um grid de **3 colunas**: **Esquerda = Contexto** (campos de saúde editáveis inline + timeline longitudinal cross-profissional de notas do cidadão); **Centro = Evolução** (form de nota: rascunho editável durante o atendimento → read-only após assinatura + adendos; sinais vitais opcionais; diagnósticos CID-10); **Direita = Ações** (placeholders inertes de Prescrição/Encaminhamento/Atestado, que chegam na fase F1.B.3). | **Backend pronto / UI pendente (F1.B.2)**                                                  |
| Prescrição / Encaminhamento / Atestado (PDF) | (futuro, na coluna Ações)          | Geração de PDF de prescrição, encaminhamento entre profissionais/unidades e atestado/declaração.                                                                                                                                                                                                                                                                                                                                                                                               | **Planejada (F1.B.3)**                                                                     |

### 4.2 Capacitação (`/capacitacao/*`) — referência Disco/Hotmart Club

| Tela                              | Rota                                                      | O que faz                                                                                                                                                                                             | Estado                                                         |
| --------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Catálogo de cursos                | `/capacitacao/cursos`                                     | Grade de cards estilo Disco (thumb + nome + área + carga horária + nº de turmas ativas), filtro por área/modalidade, botão "Novo curso" (gestor).                                                     | **Spec-pronta (F1.A.1)**                                       |
| Novo curso (CRUD)                 | `/capacitacao/cursos/novo`                                | Cadastro de curso: nome, ementa/descrição, área, carga horária total, modalidade (presencial/online/híbrido), capacidade padrão, thumb, ativo.                                                        | **Spec-pronta**                                                |
| Detalhe do curso                  | `/capacitacao/cursos/[id]`                                | Ementa + dados + lista de turmas + botão "Nova turma".                                                                                                                                                | **Spec-pronta**                                                |
| Turmas (lista)                    | `/capacitacao/turmas`                                     | Tabela filtrável por status/curso/período, com badge de ocupação ("12/20").                                                                                                                           | **Spec-pronta**                                                |
| Nova turma                        | `/capacitacao/turmas/nova`                                | Cria turma: curso, código único (ex.: "INFO-2026.1"), data início/fim, local (texto livre), instrutor (opcional), capacidade herdada do curso.                                                        | **Spec-pronta**                                                |
| Detalhe da turma                  | `/capacitacao/turmas/[id]`                                | Cabeçalho (curso/período/instrutor/local/ocupação) + lista de matriculados + ações. Status da turma: planejada → inscrições abertas → em andamento → concluída / cancelada.                           | **Spec-pronta**                                                |
| Matricular (wizard)               | `/capacitacao/turmas/[id]/matricular`                     | Wizard: (1) buscar cidadão (reutiliza a busca do médico) → (2) confirmar (turma, vagas restantes, **aviso se for menor de idade**) → submit. Bloqueia dupla matrícula.                                | **Spec-pronta**                                                |
| Instrutores (lista + CRUD)        | `/capacitacao/instrutores`                                | Lista + criar/editar instrutor (nome, bio). O vínculo com login de usuário é fase futura.                                                                                                             | **Spec-pronta (CRUD); login do instrutor = planejado F1.A.2)** |
| **Presença mobile-first**         | (rota a definir, ex. `/capacitacao/turmas/[id]/presenca`) | **A DESENHAR.** Tela do dia mobile-first: foto da turma, lista de alunos com **toggle de presença em 1 toque**, foto + observação, **offline-tolerante** (instrutora marcando presença na aula).      | **Planejada (F1.A.2)**                                         |
| **Trilha do aluno + Certificado** | (rota a definir)                                          | **A DESENHAR — momento "WOW".** Regra CapacitaSUAS: **80% de presença → certificado em PDF com QR + compartilhar no WhatsApp em 1 clique + confetti** (primeiro certificado da vida do beneficiário). | **Planejada (F1.A.3)**                                         |

### 4.3 Esportivo (`/esportivo/*`) — referência TeamSnap/Heja

Sem nenhuma tela construída ainda. Tudo abaixo é **planejado / ideia-inicial** — **campo aberto para sua proposta**. Nav sugerida (máx. 6 itens): Turmas, Calendário, Presença, Evolução, Eventos, Galeria.

| Tela (proposta)                  | O que faz                                                                                                                                                             | Estado                 |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Modalidades + Turmas + Matrícula | Cadastro de modalidades e turmas; matrícula do aluno-atleta em **wizard 3 passos**: dados do menor → responsável → modalidade/turma, com **consentimento explícito**. | **Planejada (F1.C.1)** |
| Calendário de treinos + Presença | Vista semanal/mensal estilo Google Calendar; presença em 1 toque pelo celular do coach (reusa o padrão de presença da Capacitação).                                   | **Planejada (F1.C.2)** |
| Evolução do atleta               | Perfil esportivo: gráfico de presença + **radar de atributos (escala 1–5)**; a **família vê uma versão simplificada** via portal.                                     | **Planejada (F1.C.3)** |

### 4.4 Recreativo (`/recreativo/*`) — referência Brightwheel/ClassDojo (o mais complexo)

Nenhuma tela construída. Tudo **planejado / ideia-inicial**. É a vertical mais complexa por causa de **LGPD de criança + autorização de imagem + portal do responsável**.

| Tela (proposta)                                | O que faz                                                                                                                                         | Estado                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Ficha da criança + responsáveis + autorizações | Ficha de menor robusta: responsáveis múltiplos, **autorizações granulares** (foto, alergias, contatos de emergência, lista de quem pode retirar). | **Planejada (F1.D.1)** |
| Daily report ("Como foi o dia")                | Educador captura em **5–10s**: foto + 2 tags + nota curta; vira feed para o responsável.                                                          | **Planejada (F1.D.2)** |
| Feed do responsável (timeline)                 | Linha do tempo do dia da criança para a família.                                                                                                  | **Planejada (F1.D.3)** |
| Check-in / Check-out                           | Por responsável (QR / assinatura no tablet): carimbo de horário + notifica + **registra QUEM retirou**.                                           | **Planejada (F1.D.4)** |
| Mensagem família ↔ instituto                   | Chat 1:1 que **protege o número de telefone do staff** (problema de privacidade conhecido).                                                       | **Planejada (F1.D.5)** |

### 4.5 Serviço Social (`/social`) — transversal

| Tela                       | Rota                         | O que faz                                                                                                         | Estado               |
| -------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------- |
| Painel do Serviço Social   | `/social`                    | KPIs (triagens pendentes / cidadãos ativos), **lista de triagens pendentes** e distribuição de casos por unidade. | **Pronta**           |
| (Triagem do cidadão)       | `/app/cidadaos/[id]/triagem` | Ver em 4.7 — a triagem em si vive na ficha do cidadão.                                                            | **Pronta**           |
| Relatórios socioeconômicos | (planejada)                  | Exportação CSV/PDF para o governo; plano de ação por cidadão; encaminhamento ativo entre unidades com log.        | **Planejada (F3.C)** |

### 4.6 Pôncio Executivo (`/poncio`) — diretoria

| Tela                      | Rota                 | O que faz                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Estado                          |
| ------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Painel executivo          | `/poncio`            | Hoje: visão geral das 4 unidades com **cards placeholder** de indicadores.                                                                                                                                                                                                                                                                                                                                                                                        | **Em construção (placeholder)** |
| **Painel executivo rico** | `/poncio` (evolução) | **TELA-FLAGSHIP A DESENHAR.** KPIs reais agregados (cidadãos ativos por unidade, triagens pendentes, taxa de conclusão da capacitação, presença média do esportivo), visão financeira/orçamentária, **mapa de impacto social** (geolocalização das famílias), relatórios institucionais (anual/mensal/doadores) e **drill-down inline** (clicar num KPI → ver detalhe sem sair de `/poncio`). **Sem drill-down até a ficha individual** (privacidade do cidadão). | **Planejada (F4.A)**            |

### 4.7 Núcleo operacional compartilhado (`/app/*`) — cidadãos, vagas, dashboards

Este é o "esqueleto" usado por todas as unidades. Ele convive com os módulos verticais.

| Tela                        | Rota                           | O que faz                                                                                                                   | Estado                                                                    |
| --------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Dashboard global            | `/app`                         | KPIs de cidadãos (total/ativos/excluídos), triagens pendentes, tiles por unidade e feed de atividade recente (audit log).   | **Pronta**                                                                |
| Dashboard por unidade       | `/app/[unit]`                  | KPIs/agenda/destaques de **exemplo** + painel real de encaminhamentos da triagem (medico/capacitacao/esportivo/recreativo). | **Pronta** (dados de exemplo; será absorvido pelas homes verticais ricas) |
| Cidadãos (lista)            | `/app/cidadaos`                | Listagem com busca, filtros (unidade/status/ciclo) e paginação por cursor; tabela com status colorido.                      | **Pronta**                                                                |
| Novo cidadão                | `/app/cidadaos/novo`           | Cadastro de ficha; pré-preenche nome/telefone se vier de um agendamento.                                                    | **Pronta**                                                                |
| Detalhe da ficha do cidadão | `/app/cidadaos/[id]`           | Dados pessoais/endereço/benefícios formatados (CPF/CEP), badge de status, **uploader de anexos** (MinIO).                   | **Pronta**                                                                |
| Editar ficha                | `/app/cidadaos/[id]/editar`    | Edição da ficha (reusa o form de novo cidadão).                                                                             | **Pronta**                                                                |
| Histórico do cidadão        | `/app/cidadaos/[id]/historico` | **Linha do tempo** de eventos (ficha criada/atualizada, anexos, triagem, elegibilidade, agendamentos) com pontos coloridos. | **Pronta**                                                                |
| Triagem socioeconômica      | `/app/cidadaos/[id]/triagem`   | Entrevista (só quem pode fazer triagem): abrir/preencher entrevista, parecer e **elegibilidades por unidade**.              | **Pronta**                                                                |
| Vagas (lista)               | `/app/vagas`                   | Lista de vagas/slots de captação por unidade, badge de status (aberta/pausada/encerrada), botão criar se permitido.         | **Pronta**                                                                |
| Nova vaga                   | `/app/vagas/nova`              | Cria vaga; seletor de unidade limitado às unidades acessíveis do usuário.                                                   | **Pronta**                                                                |
| Detalhe da vaga             | `/app/vagas/[id]`              | Slots disponíveis + painel de agendamentos (interessados/telefone/horário/status, vínculo a cidadão).                       | **Pronta**                                                                |

### 4.8 Administração (`/admin/*`)

| Tela           | Rota                       | O que faz                                                                              | Estado                                       |
| -------------- | -------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------- |
| Usuários       | `/admin/users`             | Tabela: nome / e-mail / papel principal / unidade(s) / status.                         | **Pronta** (edição ainda em desenvolvimento) |
| Audit explorer | `/admin/audit` (planejada) | Explorador do log de auditoria com filtros + exportação (o log já existe; falta a UI). | **Planejada (F3.C)**                         |

### 4.9 APIs (sem UI — listadas só para completude)

- `/api/auth/[...nextauth]` — handler de autenticação/sessão (NextAuth).
- `/api/cidadao-anexo/[id]` — gera URL assinada (MinIO) e redireciona para download do anexo; exige acesso à unidade do cidadão.

---

## 5. Funções & fluxos por módulo

Estes são os fluxos que a interface precisa servir bem. Alguns têm requisitos visuais fortes — marcados com 🎨.

### 5.1 Centro Médico

- **Agendamento anti-overbooking (transacional).** Reservar um slot é atômico: o sistema só reserva se o slot ainda estiver "disponível"; duas pessoas tentando o mesmo slot → uma vence, a outra recebe **erro claro** ("este horário acabou de ser reservado"). 🎨 **Desenhe o estado de erro de corrida com elegância** (não um alerta cru).
- **Máquina de estados da consulta.** `agendada → confirmada → em atendimento → realizada / faltou / cancelada`. Cada transição é um **botão contextual** (só aparecem as transições válidas) e é auditada. A transição "em atendimento → realizada" tem a semântica de **assinar o prontuário** (não deixa fechar sem nota assinada).
- 🎨 **Evolução + assinatura + adendo (prontuário).** A nota clínica é **híbrida**: texto livre + sinais vitais opcionais (PA, FC, FR, temperatura, peso, altura, SpO2; IMC calculado na tela, não salvo). Enquanto a consulta está "em atendimento", a nota é um **rascunho editável só pelo profissional dono**. Ao **assinar**, a nota fica **imutável** (carimbo de quem/quando) e a consulta vira "realizada". Correções depois da assinatura só por **adendo append-only** (nunca reescreve o original). **A assinatura é lógica** (carimbo), não ICP-Brasil. **Diagnósticos CID-10** por nota (autocomplete com fallback de texto livre).
  - **Layout 3 colunas (Elation):** Contexto (esquerda) | Evolução (centro, a coluna principal) | Ações (direita). A coluna central é a estrela — é onde o profissional escreve.

### 5.2 Capacitação

- **Matrícula + máquina de estados.** `inscrito → confirmado → cursando → (concluído / reprovado / desistente)`, + `lista de espera` e `cancelado`. Ao lotar a turma, a matrícula nova é bloqueada com erro claro e oferece **lista de espera**; ao liberar vaga, promove o 1º da fila.
- 🎨 **Presença mobile-first.** Toggle de presença em 1 toque, com foto da turma, offline-tolerante. Pensada para o **celular da instrutora na sala de aula**.
- 🎨 **Certificado (momento WOW).** 80% de presença → PDF com QR + compartilhar no WhatsApp + **confetti**. É o primeiro certificado da vida de muitos beneficiários — precisa ser **cerimonial**, com o leão coroado em escala grande.

### 5.3 Esportivo / Recreativo

- 🎨 **Daily report (Recreativo):** captura de momento em **5–10 segundos** (foto + 2 tags + nota). A velocidade da captura é um requisito de UX duro.
- 🎨 **Check-in/Check-out (Recreativo):** QR ou assinatura no tablet; **registrar quem retirou a criança** é crítico (segurança).
- 🎨 **Evolução do atleta (Esportivo):** radar de atributos 1–5 + gráfico de presença; versão simplificada para a família.

### 5.4 Funil (transversal)

- **Funil real:** IFP libera vagas numa unidade → divulga (Instagram, link compartilhável) → interessado agenda a entrevista → na entrevista define apto/não (triagem) → marcação presencial + WhatsApp pelo callcenter. **O interessado ainda não é cidadão** — é um _lead_; a ficha nasce como rascunho **só na entrevista** (para não sujar a base com leads que não comparecem).
- 🎨 **Funil público (ver seção 8):** página sem login, mínima, dignificada.

### 5.5 Serviço Social

- **Triagem:** entrevista da assistente social → parecer + observações + situação socioeconômica (flexível) → decide **elegibilidade por unidade** (pendente/aprovado/negado/encaminhado). Quando aprova ≥1 unidade, a ficha do cidadão vira "ativo".

---

## 6. Modelo de PERMISSÕES (RBAC)

A plataforma tem **6 papéis**. Importante para o design porque **cada papel vê telas diferentes e cai numa landing diferente** ao logar — você vai desenhar empty states, navegação e densidade pensando em quem está logado.

### 6.1 Conceito multi-tenant

- **Papéis globais** (sem unidade): `super_admin`, `presidencia`, `social`.
- **Papéis escopados por unidade** (exigem uma unidade): `gestor_unidade`, `profissional`, `recepcao`. Ex.: "gestor da unidade médica" é o par `{gestor_unidade, medico}`.
- O "porteiro" central confere, a cada acesso, se o papel do usuário aceita aquela unidade. **`super_admin` é o único que vê todas e tem um seletor de unidade (UnitSwitcher).**
- **Presidência é segregada:** Saulo, Simone e Sarah Pôncio acessam **só o painel `/poncio` agregado** — não entram em unidades individuais nem fazem drill-down até a ficha de um cidadão (privacidade > visibilidade executiva).

### 6.2 Tabela papel × o que vê/faz × landing

| Papel              | Quem (exemplo)                      | O que vê / faz                                                                                                                                                                                                                                                                     | Landing (onde cai ao logar) |
| ------------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| **super_admin**    | Erick (TI)                          | **Tudo.** Todas as unidades, todos os módulos, admin. Único com UnitSwitcher e sessão cross-unidade. **Não** edita/assina nota clínica de outro profissional (ato pessoal).                                                                                                        | `/app` (→ normalizado)      |
| **presidencia**    | Saulo / Simone / Sarah              | **Só `/poncio`** (visão global read-only agregada). `/admin` read-only (exceto audit). Ficha do cidadão: só visualizar. **Não entra** em médico/capacitação/esportivo/recreativo/social.                                                                                           | `/poncio`                   |
| **gestor_unidade** | Luciana, Lívia, Danielle, Raquel    | Coordena **uma** unidade: ficha do cidadão da sua unidade (ver/criar/editar/**deletar** — único não-admin que deleta). Vê a Saúde do cidadão da sua unidade, **não** o socioeconômico. Gerencia profissionais/agenda/especialidade da unidade. **Não** edita/assina nota de outro. | `/[unidade]` da sua unidade |
| **social**         | Regina                              | **Cross-unidade.** Faz a triagem socioeconômica de todos. Ficha: ver + editar (triagem); não cria/deleta. Pode marcar consulta. **Não vê** prontuário clínico.                                                                                                                     | `/social`                   |
| **profissional**   | médicos, enfermeiros, psicólogos... | Atende numa unidade: ficha (ver/criar/editar, não deleta), configura **só a própria** agenda, vê prontuário, atualiza Saúde do cidadão. **Único que edita** a própria nota (só em rascunho) e **assina** a própria nota (ato pessoal, sem bypass de admin).                        | `/[unidade]` da sua unidade |
| **recepcao**       | Maria (callcenter)                  | Recepção de uma unidade: ficha (ver/criar/editar, não deleta), **marca consulta**, faz check-in e transições de recepção (confirmar/faltou/cancelar). **Não vê** prontuário clínico.                                                                                               | `/[unidade]` da sua unidade |

> Histórico: o papel `gestor_geral` foi **removido** — só existem estes 6.

### 6.3 Implicações de design

- **Empty states variam por papel** (ex.: "Você ainda não tem cidadãos cadastrados" vs. "Sem triagens pendentes" para a Regina vs. "Nenhuma vaga aberta no mês").
- **Atos clínicos pessoais** (editar/assinar nota) **nunca** têm bypass de admin — visualmente, deixe claro quando um botão de assinar está disponível só para o dono.
- **Presidência read-only:** todo o `/poncio` é "só olhar" — nada de ações de escrita; o visual pode reforçar isso (sem CTAs de edição).

---

## 7. Experiência de LOGIN (temática por unidade)

O login é o **único lugar cerimonial onde a cor da unidade domina**. É a "porta de entrada" e o momento de marca mais forte.

### 7.1 Anatomia da shell de login

Camadas (todas existentes no código, abertas a redesenho):

1. **Fundo:** foto institucional da unidade (drone/local) **ou** gradiente de fallback. **Hoje todas as fotos estão ausentes** → o gradiente é o que aparece. (Pendência operacional: o dono vai fornecer fotos.)
2. **Overlay temático:** a cor-filtro da unidade com opacidade ~0.55 sobre o fundo.
3. **Card central:** branco translúcido (95%) com leve blur, raio grande, sombra forte. Cabeçalho com o **mascote leão** (símbolo `ifp-symbol.png`), o nome da unidade em marrom (`#752C05`) e o subtítulo "Instituto Família Pôncio". Form e-mail/senha, estado "Entrando...", erro com `role=alert`, links "Esqueci a senha" e "← Voltar".

### 7.2 Cor / gradiente por unidade (do brandbook)

| Unidade              | Cor-filtro                   | Gradiente fallback       | Semântica                     |
| -------------------- | ---------------------------- | ------------------------ | ----------------------------- |
| **Centro Médico**    | `#007571` (teal escuro)      | `135° #007571 → #10C2BB` | saúde / cuidado               |
| **Capacitação**      | `#FF772E` (laranja vibrante) | `#FF772E → #C24D0F`      | aprendizado / energia         |
| **Esportivo**        | `#C24D0F` (laranja escuro)   | `#C24D0F → #752C05`      | movimento / fogo              |
| **Recreativo**       | `#10C2BB` (teal claro)       | `#10C2BB → #007571`      | alegria / leveza              |
| **Pôncio Executivo** | `#752C05` (marrom)           | `#752C05 → #4A4A49`      | sobriedade / autoridade       |
| **Serviço Social**   | `#4A4A49` (cinza)            | `#4A4A49 → #6B6B6B`      | transversal (atravessa todas) |

A página `/[unidade]` (home pós-login) também **ecoa a cor** via uma borda lateral discreta.

### 7.3 Uso cerimonial do logo / mascote

Dois assets em `/public/logo/`: **`ifp-symbol.png`** (o leão coroado) e **`ifp-lockup.png`** (logo composto com texto).

- **Mascote SIM em:** login (~56px no card), landing pública (~48px no header), empty states (~96px a 30% de opacidade), **certificado de conclusão (escala grande)**, telas 404/500, boas-vindas pós-primeiro-login.
- **Mascote NÃO em:** sidebar permanente (lá usa só o símbolo a ~32px no topo), headers de páginas operacionais, modais de confirmação, toasts, documentos administrativos.
- **Lockup composto** aparece no **login institucional global** (a porta de entrada principal).

---

## 8. Integração WhatsApp + funil público

### 8.1 Funil público (telas sem login)

- **Página pública de inscrição** (`/vaga/[slugPublico]`): o link vem de um identificador não-sequencial (não vaza contagem/ordem). Vai para Instagram e é repassado por WhatsApp. O interessado, **sem login**, vê título/descrição da vaga e horários disponíveis, preenche **dados mínimos (nome + telefone + horário + aceite)** e reserva. 🎨 **Minimização de dados:** **nada de CPF nem dados socioeconômicos na rota pública** — só o essencial; CPF só na entrevista presencial. O visual deve ser **simples, dignificado, acolhedor**, mobile-first (a maioria vem do celular via Instagram).
- **Agendamento interno** (dentro do app, papel recepção): callcenter cria o agendamento em nome do interessado. É a primeira etapa a entrar em produção (não depende de credenciais externas).

### 8.2 Fluxos de mensagem WhatsApp

Provider sugerido: **Meta WhatsApp Cloud API** (decisão a confirmar). Mensagens:

- **Confirmação de agendamento** (template "utility").
- **Lembrete de véspera** (template "utility").
- **Troca de horário / comunicação geral** (lembretes, comunicação com a família, reset de senha futuro).
- Regra Meta: fora da janela de 24h, **só template aprovado**; texto livre só dentro de 24h após a última mensagem do usuário.

### 8.3 Opt-in LGPD

O aceite de contato é registrado **no ato do agendamento** (consentimento mínimo para mandar confirmação/lembrete). Quando o consentimento versionado existir (módulo transversal), esse aceite vira uma instância dele com finalidade "contato/agendamento". 🎨 **A caixa de consentimento na página pública precisa ser clara e honesta** (não um dark pattern) — é instituto social.

---

## 9. Transversais (LGPD, notificações, relatórios, executivo)

- **LGPD / ROPA / consentimento (F3.A):** consentimento versionado, registro de operações de tratamento (ROPA), direito ao esquecimento (anonimização). Cuidados especiais: **dado de saúde (art. 11)** e **dado de menor (art. 14)**. A anonimização do cidadão **não apaga o prontuário** dentro do prazo legal de guarda (≥20 anos, CFM) — só desvincula PII do cabeçalho. 🎨 No Recreativo, a **autorização granular de imagem** (interno OK / redes do IFP não / imprensa não, revogável) precisa de UI clara.
- **Notificações (F3.B):** toast in-app + e-mail + WhatsApp. 🎨 Desenhe o **sistema de toast** (sucesso/erro/info/aviso) coerente com a paleta.
- **Relatórios / indicadores sociais (F3.C):** audit log explorer (filtros + exportação), relatórios socioeconômicos (CSV/PDF para o governo), indicadores agregados.
- **Dashboard executivo `/poncio` (F4.A):** KPIs reais agregados, visão financeira, **mapa de impacto social** (geolocalização das famílias), relatórios institucionais (anual/mensal/doadores), drill-down inline. 🎨 **Tela-flagship** — deve transmitir impacto e sobriedade.

---

## 10. SISTEMA DE DESIGN a propor

### 10.1 O que MANTER (restrições duras de marca)

- **Paleta do brandbook** (apêndice A) — é canônica. Você pode propor como **usar** as cores, não trocá-las.
- **Logos:** leão coroado — `ifp-symbol.png` (símbolo) e `ifp-lockup.png` (com texto). Uso cerimonial conforme seção 7.3.
- **Tipografia atual de marca:** **Garet**. Você pode propor pares tipográficos novos (a Garet hoje só tem 2 pesos reais disponíveis — Book e Heavy; Light/Regular/Bold estão faltando, o que é uma pendência operacional). Se propuser uma fonte de apoio, justifique e respeite a sensação "clínica premium".

### 10.2 O que NÃO fazer (anti-requisitos)

- ❌ **NÃO** usar o tema "Editorial" abandonado: **serifa Fraunces, fundo creme, tinta quente** estão fora. Tema novo do zero.
- ❌ **NÃO** ir para o "conservador" / genérico / "cara de sistema público antigo".
- ❌ **NÃO** criar 4 apps com marcas diferentes — é **1 marca IFP** com sotaques de cor por contexto (a cor da unidade é **sinal funcional discreto**, exceto no login).
- ❌ **NÃO** usar dark patterns no consentimento (instituto social, público vulnerável).

### 10.3 Direção pretendida: "FERRAMENTA CLÍNICA PREMIUM"

Densa, precisa, **cor como sinal funcional**, tipografia afiada, sensação "primeiro mundo / referência regional". Pense em **Doctolib/Elation/Linear** — não em portal de governo. Ao mesmo tempo, **dignidade e confiança** (é gente vulnerável do outro lado). O equilíbrio é: **eficiente para a equipe, acolhedor para o cidadão.**

### 10.4 Componentes a cobrir (lista mínima)

Universais já existentes (a redesenhar/evoluir): **Button** (primary/secondary/ghost/danger × sm/md/lg), **Input** (com label + erro + a11y), **Card** (com faixa de accent por unidade), **Badge** (default/success/warning/danger/info), **EmptyState** (com mascote a 30%).

A propor/expandir:

- **Navegação:** sidebar lateral (256px) com o símbolo no topo; navegação por papel; UnitSwitcher (só super_admin).
- **Tabelas densas** (cidadãos, profissionais, usuários) — paginação por cursor, status colorido, filtros.
- **Grid de agenda** (7 dias × horas) com slots coloridos por especialidade, estados disponível/reservado/bloqueado.
- **Wizard/Stepper** (marcar consulta, matrícula, matrícula esportiva).
- **Timeline / linha do tempo** (histórico do cidadão, prontuário longitudinal, feed do Recreativo).
- **KPI cards** + **drill-down inline** (dashboards e `/poncio`).
- **Toast / notificações** (4 níveis).
- **Modais** (motivo de cancelamento, bloqueio de slot, confirmações).
- **Upload de anexos** (drag-drop, PDF/JPG/PNG ≤10MB).
- **Formulário de prontuário 3 colunas** (o mais importante).
- **Toggle de presença em 1 toque** (mobile-first, offline).
- **Certificado** (layout cerimonial para PDF).
- **Estados:** loading/skeleton, erro de corrida, vazio, sem permissão, offline.
- **Tokens:** já existem espaçamento/raio/sombra/transição; faltam tokens tipográficos formais (oportunidade).

### 10.5 Densidade e estados

- **Densidade alta** nas telas de equipe (agenda, fila, tabelas, prontuário) — informação por pixel importa.
- **Densidade baixa / acolhedora** nas telas voltadas ao cidadão/família (login, funil público, certificado, feed do Recreativo, portal da família).
- Desenhe **todos os estados** de cada componente: default, hover, focus (a11y!), disabled, loading, erro, vazio.

---

## 11. Guia para o designer

### 11.1 Telas-flagship para atacar primeiro

1. 🏆 **Prontuário 3 colunas (Centro Médico)** — a tela mais densa e a mais "WOW" para apresentar. Define a linguagem "clínica premium". Backend pronto, só falta a UI. Coluna central (Evolução) é a estrela.
2. 🏆 **Fila do dia (`/medico`)** — o que a equipe abre todo dia. Define o padrão de "home de unidade".
3. 🏆 **Login temático** — a porta de entrada, momento de marca máximo (cor + leão + foto/gradiente).
4. 🏆 **Dashboard executivo `/poncio`** — KPIs + mapa de impacto + drill-down; define a "sensação de referência regional".

Depois: certificado da Capacitação (momento WOW), daily report/check-in do Recreativo (velocidade + afeto + segurança), grid de agenda.

### 11.2 O que explorar / propor

- Um **par tipográfico** "afiado" (Garet + apoio, se fizer sentido) e uma **escala tipográfica** formal.
- Como a **cor da unidade** entra como sinal funcional sem virar 4 marcas.
- A **linguagem de densidade** (equipe) vs **acolhimento** (cidadão/família).
- Tratamento dos **estados de saúde/menor** com dignidade (não estigmatizar).
- O **certificado** como peça cerimonial.
- Padrão de **mobile-first offline** para presença/daily report.

### 11.3 Perguntas abertas (precisam de decisão do cliente)

- Fotos de fundo do login (todas ausentes hoje) — drone/institucional?
- Pesos faltantes da Garet (Light/Regular/Bold) — adotar fonte de apoio?
- Modelo de slots do funil (horário livre vs. grade fixa).
- Provider de WhatsApp (Meta direto vs. BSP).
- Base legal LGPD do prontuário e do contato WhatsApp.
- Escopo da lista de espera na Capacitação (já no F1.A.1 ou depois).

---

## Apêndice A — Paleta hex completa

**Laranja (ação / accent principal)**

- `#FF772E` — laranja 500 (ação primária, CTAs, estados ativos)
- `#C24D0F` — laranja 700 (forte / hover)
- `#752C05` — marrom 900 (headlines, manchetes, mascote)

**Teal (saúde / cuidado / sucesso)**

- `#10C2BB` — teal 500 (claro, success/info)
- `#007571` — teal 700 (escuro = saúde/médico, success strong)

**Neutros**

- `#4A4A49` — tinta (body text, cinza institucional)
- `#6B6B6B` — secundário (texto muted)
- `#FFFFFF` — branco (surface/canvas)
- `#FAFAF9` — superfície 50 (fundo de página)
- `#F4F4F2` — superfície 100 (fundo de card sutil)
- `#E5E4E1` — superfície 200 (bordas/divisores)

**Estados (não-brandbook, usar com parcimônia)**

- `#BA1A1A` — erro
- `#B45309` — alerta (laranja escuro)

**Filtro por unidade (login)**

- medico `#007571` · capacitacao `#FF772E` · esportivo `#C24D0F` · recreativo `#10C2BB` · poncio `#752C05` · social `#4A4A49`

## Apêndice B — Logos

- `/public/logo/ifp-symbol.png` — leão coroado (símbolo, uso cerimonial).
- `/public/logo/ifp-lockup.png` — logo composto com texto (login institucional global).
- Tipografia de marca: **Garet** em `/public/fonts/garet/` (hoje só `Garet-Book.woff` e `Garet-Heavy.woff`).

## Apêndice C — Todas as rotas (lista enxuta)

**Públicas / entrada**

- `/` — landing
- `/login` — login global
- `/[unidade]/login` — login temático (medico/capacitacao/esportivo/recreativo/poncio/social)
- `/[unidade]` — home genérica da unidade
- `/reset` — recuperar senha (`/reset/[token]` planejada)
- `/vaga/[slugPublico]` — inscrição pública (planejada)

**Núcleo operacional `/app`**

- `/app` — dashboard global
- `/app/[unit]` — dashboard por unidade
- `/app/cidadaos` · `/novo` · `/[id]` · `/[id]/editar` · `/[id]/historico` · `/[id]/triagem`
- `/app/vagas` · `/nova` · `/[id]`

**Centro Médico `/medico`**

- `/medico` · `/agenda` · `/minha-agenda` · `/especialidades`
- `/profissionais` · `/profissionais/novo` · `/profissionais/[id]`
- `/consultas/nova` · `/consultas/[id]` (contém o prontuário 3-col, UI pendente)

**Capacitação `/capacitacao`** (spec-pronta / planejada)

- `/cursos` · `/cursos/novo` · `/cursos/[id]`
- `/turmas` · `/turmas/nova` · `/turmas/[id]` · `/turmas/[id]/matricular`
- `/instrutores` · (presença e certificado: planejados)

**Esportivo `/esportivo`** (planejado) · **Recreativo `/recreativo`** (planejado)

**Gestão**

- `/social` — painel do Serviço Social
- `/poncio` — painel executivo
- `/admin/users` · `/admin/audit` (planejada)

**APIs (sem UI)**

- `/api/auth/[...nextauth]` · `/api/cidadao-anexo/[id]`

---

_Fim do documento. Procedência das fontes: roadmap de produto (2026-05-28), spec RBAC v2 (2026-05-28), spec Médico Agenda+Fila (2026-05-28) e Prontuário (2026-05-31), spec Capacitação F1.A.1 (2026-05-31), design do funil/WhatsApp (2026-05-25), spec do Design System v2 (2026-05-28) e o código vivo em `C:/Users/Administrador/ifp-connect/src`._
